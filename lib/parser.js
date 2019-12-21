const uuid = require('uuid/v4')
const yielded = Symbol('yielded')
const labelRegex = /^[a-z$][a-z_0-9]*$/
const cypherParser = require('cypher-parser')
const sqlParser = require('pg-query-parser')
const { EventEmitter } = require('events')
const id = Symbol('id')
const queryKeys = {
  _skip: true,
  _limit: true,
  _order: true,
  _where: true,
  _sqlWhere: true,
  _id: true,
  _label: true
}
function isPrimitive (value) {
  return (
    typeof value !== 'object' ||
    (typeof value === 'object' && value && value._json === true) ||
    (Array.isArray(value) && value.some(item => isPrimitive(item))) ||
    value instanceof Date
  )
}

function * iterateJson (child, key, parent, metadata) {
  if (child && typeof child === 'object' && !Array.isArray(child)) {
    child[id] = child[id] || uuid()
    const result = {
      [id]: child[id],
      _label: child._label
    }

    const reference = result[id]
    const nextIteration = []
    for (const [key, value] of Object.entries(child)) {
      if (queryKeys[key]) {
        result[key] = value
        continue
      }
      if (key.startsWith('_')) {
        continue
      }
      validateLabel(key)
      if (isPrimitive(value)) {
        result[key] = value
        continue
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          nextIteration.push({
            child: item,
            key,
            parent: reference,
            metadata: { is_array: true }
          })
        }
      } else {
        nextIteration.push({
          child: value,
          key,
          parent: reference
        })
      }
    }
    yield {
      object: child,
      child: result,
      key,
      parent,
      metadata
    }

    if (!child[yielded]) {
      child[yielded] = true
      for (const iteration of nextIteration) {
        yield * iterateJson(iteration.child, iteration.key, iteration.parent, iteration.metadata)
      }
    }
    delete child[yielded]
    delete child[id]
  }
}

function getNodesAndRelationships (json) {
  const nodes = {}
  const objects = {}
  const relationships = []
  for (const item of iterateJson(json)) {
    nodes[item.child[id]] = item.child
    objects[item.child[id]] = item.object
    const r = {
      from: item.parent,
      name: item.key,
      to: item.child[id],
      metadata: item.metadata
    }
    r.metadata = r.metadata || {}
    r.metadata._label = item.key
    relationships.push(r)
  }
  const root = nodes[relationships.shift().to]
  return {
    objects,
    rootObject: json,
    root,
    nodes,
    relationships
  }
}

function getIndexesPerNode (nodes) {
  const indexesPerNode = {}
  const nodeIds = Object.keys(nodes)
  for (let index = 0; index < nodeIds.length; index++) {
    const nodeId = nodeIds[index]
    indexesPerNode[nodeId] = index + 1
  }
  return indexesPerNode
}

function parseCypherNode (node) {
  const operators = {
    equal: '=',
    'not-equal': '<>',
    or: 'OR',
    and: 'AND',
    not: 'NOT',
    in: 'IN',
    plus: '+',
    minus: '-',
    mult: '*',
    div: '/',
    pow: '^',
    mod: '%',
    'less-than-equal': '<=',
    'less-than': '<',
    'greater-than-equal': '>=',
    'greater-than': '>',
    'starts-with': 'STARTS WITH',
    'ends-with': 'ENDS WITH',
    contains: 'CONTAINS',
    'is-null': 'IS NULL',
    'is-not-null': 'IS NOT NULL'
  }
  if (node.op === 'unary-minus') {
    return `-${parseCypherNode(node.arg)}`
  }
  if (node.op === 'not') {
    return `${operators[node.op]} ${parseCypherNode(node.arg)}`
  }
  if (node.type === 'unary-operator') {
    return `${parseCypherNode(node.arg)} ${operators[node.op]}`
  }
  if (node.type === 'binary-operator') {
    return `${parseCypherNode(node.arg1)} ${operators[node.op]} ${parseCypherNode(node.arg2)}`
  }
  if (node.type === 'comparison') {
    let result = ''
    for (let i = 0; i < node.args.length - 1; i += 2) {
      result += `${parseCypherNode(node.args[i])} ${operators[node.ops[i]]} ${parseCypherNode(node.args[i + 1])}`
    }
    return result
  }
  if (node.type === 'property-operator') {
    return `${node.expression.name}.${node.propName.value}`
  }
  if (node.type === 'apply-operator') {
    return `${node.funcName.value}(${node.args.map(a => parseCypherNode(a)).join(',')})`
  }
  if (node.type === 'identifier') {
    return node.name
  }
  if (node.type === 'integer') {
    return node.value
  }
  if (node.type === 'float') {
    return node.value
  }
  if (node.type === 'string') {
    return `'${node.value}'`
  }
  if (node.type === 'false') {
    return 'false'
  }
  if (node.type === 'true') {
    return 'true'
  }

  if (node.type === 'parameter') {
    return `$${node.name}`
  }

  throw new Error('not implemented cypher parser')
}

async function getWhereCypher (params, json, variableName) {
  const whereQuery = []
  if (json._label) {
    let whereLabels
    if (typeof json._label === 'string') {
      whereLabels = [json._label]
    } else {
      whereLabels = json._label
    }
    whereLabels = whereLabels.map(l => `label(${variableName}) = '${l}'`).join(' OR ')
    whereQuery.push(whereLabels)
  }
  if (json._where) {
    if (json._label) {
      whereQuery.push('AND')
    }
    const ast = await cypherParser.parse(
      `MATCH (${variableName}) WHERE ${json._where.filter
        .replace(/\{this\}/g, variableName)
        .replace(/\s+:(\w+)\b/g, (a, b) => {
          if (typeof json._where.params[b] === 'string') {
            return `$${params.push(`"${json._where.params[b]}"`)}`
          } else {
            return `$${params.push(json._where.params[b])}`
          }
        })}`
    )
    whereQuery.push(parseCypherNode(ast.roots[0].body.clauses[0].predicate))
  }
  if (whereQuery.length > 0) {
    return whereQuery.join(' ')
  }
  return ''
}

function parseSqlNode (node) {
  const boolOperatorMap = {
    0: 'AND',
    1: 'OR'
  }

  if (node.BoolExpr) {
    if (node.BoolExpr.boolop === 2) {
      return `(NOT (${parseSqlNode(node.BoolExpr.args[0])}))`
    }
    return `(${parseSqlNode(node.BoolExpr.args[0])} ${boolOperatorMap[node.BoolExpr.boolop]} ${parseSqlNode(
      node.BoolExpr.args[1]
    )})`
  }

  if (node.FuncCall) {
    return `${node.FuncCall.funcname[0].String.str}(${node.FuncCall.args.map(a => parseSqlNode(a)).join(', ')})`
  }

  if (node.TypeCast) {
    return `${parseSqlNode(node.TypeCast.arg)}::${node.TypeCast.typeName.TypeName.names
      .map(n => n.String.str)
      .join('.')}`
  }

  if (node.A_Const) {
    return parseSqlNode(node.A_Const.val)
  }

  if (node.String) {
    return `'${node.String.str}'`
  }

  if (node.Integer) {
    return node.Integer.ival
  }

  if (node.ColumnRef) {
    return `${node.ColumnRef.fields.map(f => f.String.str).join('.')}`
  }

  if (node.A_Expr) {
    if (node.A_Expr.kind === 0) {
      return `(${parseSqlNode(node.A_Expr.lexpr)} ${node.A_Expr.name[0].String.str} ${parseSqlNode(node.A_Expr.rexpr)})`
    }
    if (node.A_Expr.kind === 10) {
      return `(${parseSqlNode(node.A_Expr.lexpr)} BETWEEN ${parseSqlNode(node.A_Expr.rexpr[0])} AND ${parseSqlNode(
        node.A_Expr.rexpr[1]
      )})`
    }
  }

  if (node.ParamRef) {
    return `$${node.ParamRef.number}`
  }

  throw new Error('not implemented sql node parser')
}

function getWhereSql (params, json, variableName) {
  if (json._sqlWhere) {
    const ast = sqlParser.parse(
      `SELECT * FROM placeholder WHERE ${json._sqlWhere.filter
        .replace(/\{this\}/g, variableName)
        .replace(/\s+:(\w+)\b/g, (a, b) => `$${params.push(json._sqlWhere.params[b])}`)}`
    )
    return parseSqlNode(ast.query[0].SelectStmt.whereClause)
  }
  return ''
}

function getOrderCypher (json, variable) {
  if (json._order) {
    let orderBy
    if (typeof json._order === 'string') {
      orderBy = [json._order]
    } else {
      orderBy = json._order
    }
    const cypherOrder = orderBy
      .map(o => (o.startsWith('!') ? `${variable}.${o.slice(1)} DESC` : `${variable}.${o} ASC`))
      .join(', ')
    return `ORDER BY ${cypherOrder}`
  }
  return ''
}

function getPaginationCypher (json, params) {
  const query = []
  if (json._skip > 0) {
    const paramIndex = params.push(json._skip)
    query.push(`SKIP $${paramIndex}`)
  }
  if (json._limit > 0) {
    const paramIndex = params.push(json._limit)
    query.push(`LIMIT $${paramIndex}`)
  }
  return query.join(' ')
}

async function getMatchSufix (json, variable, queryEnd) {
  const query = []
  const params = []
  const where = []
  const cypherWhere = await getWhereCypher(params, json, variable)
  const sqlWhereQuery = getWhereSql(params, json, variable)
  const orderQuery = getOrderCypher(json, variable)
  const paginationQuery = getPaginationCypher(json, params)
  if (cypherWhere) {
    where.push(cypherWhere)
  }
  if (sqlWhereQuery) {
    if (where.length) {
      where.push(' AND ')
    }
    where.push(
      `(SELECT count(_id) FROM ${json._sqlWhere.table} WHERE _id = ${variable}->>'_id' AND ${sqlWhereQuery}) > 0`
    )
  }
  if (where.length) {
    where.unshift('WHERE')
    query.push(where.join(' '))
  }
  query.push(queryEnd)
  if (orderQuery) {
    query.push(orderQuery)
  }
  if (paginationQuery) {
    query.push(paginationQuery)
  }

  return {
    query: query.join(' '),
    params
  }
}

function getWith (variables) {
  return `WITH ${[...variables].join(', ')}`
}

function validateLabel (label) {
  if (!Array.isArray(label)) {
    label = [label]
  }
  for (const l of label) {
    if (!l) {
      throw new Error('Every object in the json must have a label defined')
    }
    if (!labelRegex.test(l)) {
      throw new Error(`Invalid label: ${l}`)
    }
  }
}

function getCypher (queries, params, graph) {
  return {
    rootKey: 'v1',
    query: queries.join('\n'),
    params,
    graph
  }
}

function _getFinalQuery (options, cypher, nodes) {
  const selectPart = ['json_agg(cypher.*) as cypher_info']
  const joinPart = []
  const joinFilter = nodes.map(n => `_id = cypher.${n}->>'_id'`).join(' OR ')
  if (options._sql) {
    const sqlColumns = []
    const sqlMappings = options._sql
    for (const item of sqlMappings) {
      const out = Object.keys(item.mappings).reduce((json, k) => {
        json[k] = `${item.table}.${item.mappings[k]}`
        return json
      }, {})
      if (options.projections && options.projections[item.table]) {
        for (const projection of Object.keys(options.projections[item.table])) {
          out[projection] = `${options.projections[item.table][projection].replace(
            /\{(.+)\}/g,
            (a, b) => `${item.table}.${item.mappings[b]}`
          )}`
        }
      }
      const columns = [`'_id', ${item.table}._id`, ...Object.entries(out).map(([k, v]) => `'${k}', ${v}`)]
      sqlColumns.push(columns.join(', '))
      joinPart.push(`INNER JOIN ${item.table} ON (${joinFilter})`)
    }
    selectPart.push(`json_agg(json_build_object(${sqlColumns.join(', ')})) as sql_info`)
  }
  return `SELECT ${selectPart.join(', ')} FROM (${cypher}) as cypher ${joinPart.join(' ')}`
}

async function queryObjectToCypher (queryObject, options, eventEmitter, getQueryEnd) {
  const { nodes, relationships, root } = getNodesAndRelationships(queryObject)
  if (!relationships.length) {
    const rootMatchSufix = await getMatchSufix(root, 'v1', getQueryEnd(new Set(['v1'])))
    const statement = {
      query: `MATCH (v1) ${rootMatchSufix.query}`,
      params: rootMatchSufix.params,
      rootKey: 'v1'
    }
    statement.query = _getFinalQuery(options, statement.query, ['v1'])
    return statement
  }

  const indexesPerNode = getIndexesPerNode(nodes)
  const statements = []
  const variables = new Set(['v1'])
  const rootMatchSufix = await getMatchSufix(root, 'v1', getWith(variables))
  const rootStatement = {
    query: `MATCH (v1) ${rootMatchSufix.query}`,
    params: rootMatchSufix.params
  }
  eventEmitter.emit('queryBuildRoot', rootStatement, ['v1'])
  statements.push(rootStatement)
  for (let rIndex = 0; rIndex < relationships.length; rIndex++) {
    const r = relationships[rIndex]
    const toNode = nodes[r.to]
    const fromIndex = indexesPerNode[r.from]
    const toIndex = indexesPerNode[r.to]
    variables.add(`v${fromIndex}`)
    variables.add(`r${rIndex}`)
    variables.add(`v${toIndex}`)

    const relationshipMatchSufix = await getMatchSufix(toNode, `v${toIndex}`, getWith(variables))
    const relationshipStatement = {
      query: `MATCH (v${fromIndex})-[r${rIndex}:${r.name}]->(v${toIndex}) ${relationshipMatchSufix.query}`,
      params: relationshipMatchSufix.params
    }
    if (Object.keys(queryKeys).some(k => toNode[k])) {
      toNode.mandatory = true
    }
    if (!toNode.mandatory) {
      relationshipStatement.query = `OPTIONAL ${relationshipStatement.query}`
    }
    eventEmitter.emit('queryBuildRelationship', relationshipStatement, [`v${toIndex}`, `r${rIndex}`, `v${fromIndex}`])
    statements.push(relationshipStatement)
  }
  statements.push({ query: getQueryEnd(variables), params: [] })
  const finalStatement = statements.reduce(
    (result, statement) => {
      result.query += `\n${statement.query}`
      result.params.push(...statement.params)
      return result
    },
    { query: '', params: [], rootKey: 'v1' }
  )
  finalStatement.query = _getFinalQuery(
    options,
    finalStatement.query,
    [...variables].filter(v => v.startsWith('v'))
  )
  eventEmitter.emit('queryBuildEnd', finalStatement, [...variables])
  return finalStatement
}

async function handleColumn (column, nodes, nodesPerKonektoId, relationships, options) {
  const item = parseColumn(column)
  if (item.isRelationship) {
    relationships[item.value[id]] = item.value
  } else {
    const node = item.value
    const object = options.graph && options.graph.objects[node._id]
    if (options.hooks && options.hooks.beforeRead) {
      if (!(await options.hooks.beforeRead(node, object))) {
        return
      }
    }
    nodes[node[id]] = node
    nodesPerKonektoId[node._id] = node
    return node
  }
}

function parseColumn (column) {
  if (column.start && column.end) {
    return {
      isRelationship: true,
      value: {
        [id]: column.id,
        from: column.start,
        to: column.end,
        metadata: column.properties
      }
    }
  }
  const node = column.properties
  node[id] = column.id
  return {
    isNode: true,
    value: node
  }
}

function sqlInsert (options, node, sqlParams) {
  if (options.sqlMappings && options.sqlMappings[node._label]) {
    const sqlMappings = options.sqlMappings
    const sqlColumns = ['_id']
    const sqlValues = [`$${sqlParams.push(node[id])}`]

    for (const k of Object.keys(sqlMappings[node._label].mappings)) {
      const value = node[k]
      delete node[k]
      sqlColumns.push(sqlMappings[node._label].mappings[k])
      const param = sqlParams.push(value)
      if (options.projections && options.projections[node._label][k]) {
        const projection = options.projections[node._label][k].replace(/\{this\}/g, `$${param}`)
        sqlValues.push(projection)
      } else {
        sqlValues.push(`$${param}`)
      }
    }
    return `INSERT INTO ${sqlMappings[node._label].table} (${sqlColumns.join(', ')}) VALUES (${sqlValues.join(', ')})`
  }
}

function sqlUpdate (options, node, sqlParams) {
  if (options.sqlMappings && options.sqlMappings[node._label]) {
    const sqlMappings = options.sqlMappings
    const sqlColumns = []
    const idParamIndex = sqlParams.push(node._id)
    for (const mapping of sqlMappings[node._label].mappings) {
      const value = node[mapping.key]
      delete node[mapping.key]
      const param = sqlParams.push(value)
      if (options.projections && options.projections[node._label][mapping.key]) {
        const projection = options.projections[node._label][mapping.key].replace(/\{this\}/g, `$${param}`)
        sqlColumns.push(`${mapping.column} = ${projection}`)
      } else {
        sqlColumns.push(`${mapping.column} = $${param}`)
      }
    }
    return `UPDATE ${sqlMappings[node._label].table} (${sqlColumns.join(', ')}) WHERE _id = $${idParamIndex}`
  }
}

function handleSql (options, node, sqlQuery, sqlParams) {
  let sqlPartialQuery
  if (!node._id) {
    sqlPartialQuery = sqlInsert(options, node, sqlParams)
  } else {
    sqlPartialQuery = sqlUpdate(options, node, sqlParams)
  }
  if (sqlPartialQuery) {
    sqlQuery.push(sqlPartialQuery)
  }
}

module.exports = {
  Parser: class extends EventEmitter {
    async jsonToCypherWrite (json, options = {}) {
      const graph = getNodesAndRelationships(json)
      const params = [graph.root]
      const indexesPerNode = getIndexesPerNode(graph.nodes)
      const queries = []
      const variables = new Set(['v1'])
      const sqlQuery = []
      const sqlParams = []

      validateLabel(graph.root._label)

      if (options.hooks && options.hooks.beforeSave) {
        if (!(await options.hooks.beforeSave(graph.root, graph.rootObject))) {
          throw new Error(`beforeSave hook didn't return truthy value for node ${JSON.stringify(graph.root, null, 2)}`)
        }
      }
      handleSql(options, graph.root, sqlQuery, sqlParams)
      graph.root._id = graph.root._id || graph.root[id]
      this.emit('save', graph.root, graph.rootObject)
      queries.push(
        `MERGE (v1:${graph.root._label} {_id: '${graph.root._id}' }) ON MATCH SET v1 = $1 ON CREATE SET v1 = $1`
      )
      for (let rIndex = 0; rIndex < graph.relationships.length; rIndex++) {
        const r = graph.relationships[rIndex]
        const fromIndex = indexesPerNode[r.from]
        const toIndex = indexesPerNode[r.to]
        validateLabel(graph.nodes[r.to]._label)
        params[toIndex - 1] = graph.nodes[r.to]
        variables.add(`v${fromIndex}`)
        variables.add(`r${rIndex}`)
        handleSql(options, graph.nodes[r.to], sqlQuery, sqlParams)
        graph.nodes[r.to]._id = graph.nodes[r.to]._id || graph.nodes[r.to][id]
        if (options.hooks && options.hooks.beforeUpdate) {
          const ok = await options.hooks.beforeUpdate(graph.nodes[r.to], graph.objects[r.to])
          if (!ok) {
            throw new Error(
              `beforeUpdate hook didn't return truthy value for node ${JSON.stringify(graph.nodes[r.to], null, 2)}`
            )
          }
        }
        this.emit('update', graph.nodes[r.to], graph.objects[r.to])
        if (!variables.has(`v${toIndex}`)) {
          queries.push(
            `MERGE (v${toIndex}:${graph.nodes[r.to]._label} {_id: '${
              graph.nodes[r.to]._id
            }'}) ON MATCH SET v${toIndex} = $${toIndex} ON CREATE SET v${toIndex} = $${toIndex}`
          )
        }
        queries.push(
          `MERGE (v${fromIndex})-[r${rIndex}:${r.name}${JSON.stringify(r.metadata).replace(/"/g, "'")}]->(v${toIndex})`
        )
      }
      return {
        cypher: getCypher(queries, params, graph),
        sql: {
          query: sqlQuery.join('\n'),
          params: sqlParams
        }
      }
    }

    getFinalQuery (queryObject, options, cypher, nodes) {
      return _getFinalQuery(options, cypher, nodes)
    }

    async jsonToCypherRead (json, options) {
      return queryObjectToCypher(json, options, this, () => 'RETURN *')
    }

    async jsonToCypherDelete (json, options) {
      return queryObjectToCypher(json, options, this, variables => {
        const nodes = [...variables].filter(v => v.startsWith('v'))
        return `DETACH DELETE ${nodes.join(',')} WITH ${nodes.join(',')} RETURN *`
      })
    }

    async jsonToCypherRelationshipDelete (json, options) {
      return queryObjectToCypher(json, options, this, variables => {
        const relationships = [...variables].filter(v => v.startsWith('r'))
        return `DELETE ${relationships.join(',')}`
      })
    }

    getSchema (json) {
      const { nodes, relationships } = getNodesAndRelationships(json)
      const relationshipNames = relationships.filter(r => r.name).map(r => r.name)
      const nodeLabels = [...new Set(Object.values(nodes).map(n => n._label))]
      return {
        relationshipNames,
        nodeLabels
      }
    }

    async parseRows (rows, rootKey, options = {}) {
      const relationships = {}
      const nodes = {}
      const nodesPerKonektoId = {}
      const roots = {}
      for (const row of rows[0].cypher_info) {
        if (row[rootKey]) {
          const root = row[rootKey].properties
          root[id] = row[rootKey].id
          roots[root[id]] = true
        }
        for (const column of Object.values(row)) {
          if (column) {
            if (Array.isArray(column)) {
              for (const item of column) {
                const node = await handleColumn(item, nodes, nodesPerKonektoId, relationships, options)
                if (node) {
                  this.emit('read', node)
                }
              }
            } else {
              const node = await handleColumn(column, nodes, nodesPerKonektoId, relationships, options)
              if (node) {
                this.emit('read', node)
              }
            }
          }
        }
      }
      if (rows[0].sql_info) {
        for (const row of rows[0].sql_info) {
          for (const [key, value] of Object.entries(row)) {
            if (key !== '_id') {
              nodesPerKonektoId[row._id][key] = value
            }
          }
        }
      }
      if (Object.keys(relationships).length !== 0) {
        for (const rel of Object.values(relationships)) {
          nodes[rel.from] = nodes[rel.from]
          const value = nodes[rel.from][rel.metadata._label]
          if (value && !Array.isArray(value)) {
            nodes[rel.from][rel.metadata._label] = [value, nodes[rel.to]]
            continue
          }
          if (value && Array.isArray(value)) {
            nodes[rel.from][rel.metadata._label].push(nodes[rel.to])
            continue
          }
          if (!value && rel.metadata && rel.metadata.is_array) {
            nodes[rel.from][rel.metadata._label] = [nodes[rel.to]]
            continue
          }
          if (!value && rel.metadata && !rel.metadata.is_array) {
            nodes[rel.from][rel.metadata._label] = nodes[rel.to]
            continue
          }
        }
      }
      for (const node of Object.values(nodes)) {
        delete node[id]
      }
      const result = Object.keys(roots).map(k => nodes[k])
      this.emit('readFinish')
      return result
    }
  }
}
