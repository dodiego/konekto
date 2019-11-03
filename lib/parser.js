const uuid = require('uuid/v4')
const yielded = Symbol('yielded')
const isRelated = Symbol('isRelated')
const labelRegex = /^[a-z$][a-z_0-9]+$/
const cypherParser = require('cypher-parser')
const sqlParser = require('pg-query-parser')
const { EventEmitter } = require('events')
function isPrimitive (value) {
  return (
    typeof value !== 'object' ||
    (Array.isArray(value) && (typeof value[0] !== 'object' || value[0] instanceof Date)) ||
    value instanceof Date
  )
}
function * iterateJson (child, key, parent, metadata) {
  if (child && typeof child === 'object' && !Array.isArray(child)) {
    if (!child.konekto_id) {
      child.konekto_id = uuid()
    }
    const reference = child.konekto_id
    const result = {
      konekto_id: child.konekto_id,
      _id: child._id,
      _label: child._label
    }
    if (child._label) {
      validateLabel(child._label)
    }
    const nextIteration = []
    for (const [key, value] of Object.entries(child)) {
      if (key.startsWith('_')) {
        continue
      }
      validateLabel(key)
      if (isPrimitive(value)) {
        result[key] = value
      } else if (Array.isArray(value) && typeof value[0] === 'object') {
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

    delete child.konekto_id
    delete child[yielded]
  }
}

function getNodesAndRelationships (json) {
  const nodes = {}
  const objects = {}
  const relationships = []
  for (const item of iterateJson(json)) {
    nodes[item.child.konekto_id] = item.child
    objects[item.child.konekto_id] = item.object
    const r = {
      from: item.parent,
      name: item.key,
      to: item.child.konekto_id,
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
  if (json.where) {
    if (json._label) {
      whereQuery.push('AND')
    }
    const ast = await cypherParser.parse(
      `MATCH (${variableName}) WHERE ${json.where.replace(/\{this\}/g, variableName)}`
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

  throw new Error('not implemented parser')
}

function getWhereSql (params, json, variableName) {
  if (json.sql_where) {
    const ast = sqlParser.parse(`SELECT * FROM placeholder WHERE ${json.sql_where.replace(/\{this\}/g, variableName)}`)
    return parseSqlNode(ast.query[0].SelectStmt.whereClause)
  }
  return ''
}

function getOrderCypher (json, variable) {
  if (json.order) {
    let orderBy
    if (typeof json.order === 'string') {
      orderBy = [json.order]
    } else {
      orderBy = json.order
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
  if (json.skip > 0) {
    const paramIndex = params.push(json.skip)
    query.push(`SKIP $${paramIndex}`)
  }
  if (json.limit > 0) {
    const paramIndex = params.push(json.limit)
    query.push(`LIMIT $${paramIndex}`)
  }
  return query.join(' ')
}

async function getMatchSufix (json, variable, queryEnd) {
  const query = []
  const params = []
  const where = []
  const cypherWhere = await getWhereCypher(params, json, variable)
  const sqlWhere = getWhereSql(params, json, variable)
  const orderQuery = getOrderCypher(json, variable)
  const paginationQuery = getPaginationCypher(json, params)
  if (cypherWhere) {
    where.push(cypherWhere)
  }
  if (sqlWhere) {
    if (where.length) {
      where.push(' AND ')
    }
    where.push(
      `(SELECT count(konekto_id) FROM ${json.sql_table} WHERE konekto_id = ${variable}->>'konekto_id' AND ${sqlWhere}) > 0`
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

function variablesToCypherWith (variables, json, params) {
  const query = [getWith(variables)]
  const variablesList = [...variables]
  if (json) {
    const order = getOrderCypher(json, variablesList[variablesList.length - 1])
    if (order) {
      query.push(order)
    }
    const pagination = getPaginationCypher(json, params)
    if (pagination) {
      query.push(pagination)
    }
  }
  return query.join(' ')
}

function addPartialQuery (queries, query, variables, json, params) {
  queries.push(`${query} ${variablesToCypherWith(variables, json, params)}`)
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

function _getFinalQuery (queryObject, cypher, nodes) {
  const selectPart = ['json_agg(cypher.*) as cypher_info']
  const joinPart = []
  // const joinFilter = nodes.map(n => `konekto_id = cypher.${n}->>'konekto_id'`).join(' OR ')
  // if (queryObject._sql) {
  //   const sqlColumns = []
  //   for (const sqlPart of queryObject._sql.parts) {
  //     const columns = [
  //       `'konekto_id', ${sqlPart.table}.konekto_id`,
  //       ...sqlPart.columns.map(c => `'${c}', ${sqlPart.table}.${c}`)
  //     ]
  //     sqlColumns.push(columns.join(', '))
  //     joinPart.push(`INNER JOIN ${sqlPart.table} ON (${joinFilter})`)
  //   }
  //   selectPart.push(`json_agg(json_build_object(${sqlColumns.join(', ')})) as sql_info`)
  // }
  return `SELECT ${selectPart.join(', ')} FROM (${cypher}) as cypher ${joinPart.join(' ')}`
}

async function queryObjectToCypher (queryObject, eventEmitter, getQueryEnd) {
  const { nodes, relationships, root } = getNodesAndRelationships(queryObject)
  if (!relationships.length) {
    const rootMatchSufix = await getMatchSufix(root, 'v1', getQueryEnd(new Set(['v1'])))
    const statement = {
      query: `MATCH (v1) ${rootMatchSufix.query}`,
      params: rootMatchSufix.params
    }
    statement.query = _getFinalQuery(queryObject, statement.query, ['v1'])
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
    if (toNode.where || toNode.order || toNode.skip || toNode.limit) {
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
    queryObject,
    finalStatement.query,
    [...variables].filter(v => v.startsWith('v'))
  )
  eventEmitter.emit('queryBuildEnd', finalStatement, [...variables])
  return finalStatement
}

async function handleColumn (column, nodes, nodesPerKonektoId, relationships, options) {
  const item = parseColumn(column)
  if (item.isRelationship) {
    relationships[item.value._id] = item.value
  } else {
    const node = item.value
    const object = options.graph && options.graph.objects[node.konekto_id]
    if (options.hooks && options.hooks.beforeRead) {
      if (!(await options.hooks.beforeRead(node, object))) {
        return
      }
    }
    nodes[node._id] = node
    nodesPerKonektoId[node.konekto_id] = node
    delete node.konekto_id
    return node
  }
}

function parseColumn (column) {
  if (column.start && column.end) {
    return {
      isRelationship: true,
      value: {
        _id: column.id,
        from: column.start,
        to: column.end,
        metadata: column.properties
      }
    }
  }
  const node = column.properties
  node._id = column.id
  return {
    isNode: true,
    value: node
  }
}

module.exports = class extends EventEmitter {
  async jsonToCypherWrite (json, options = {}) {
    const graph = getNodesAndRelationships(json)
    const params = [graph.root]
    const indexesPerNode = getIndexesPerNode(graph.nodes)
    const queries = []
    const variables = new Set(['v1'])
    if (graph.root._id) {
      if (options.hooks && options.hooks.beforeUpdate) {
        if (!(await options.hooks.beforeUpdate(graph.root, graph.rootObject))) {
          throw new Error(
            `beforeUpdate hook didn't return truthy value for node ${JSON.stringify(graph.root, null, 2)}`
          )
        }
      }
      this.emit('update', graph.root, graph.rootObject)
      addPartialQuery(
        queries,
        `MATCH (v1:${graph.root._label}) WHERE id(v1) = ${graph.root._id} SET v1 = $1`,
        variables
      )
    } else {
      if (options.hooks && options.hooks.beforeCreate) {
        if (!(await options.hooks.beforeCreate(graph.root, graph.rootObject))) {
          throw new Error(
            `beforeCreate hook didn't return truthy value for node ${JSON.stringify(graph.root, null, 2)}`
          )
        }
      }
      this.emit('create', graph.root, graph.rootObject)
      addPartialQuery(queries, `CREATE (v1:${graph.root._label} $1)`, variables)
    }
    for (let rIndex = 0; rIndex < graph.relationships.length; rIndex++) {
      const r = graph.relationships[rIndex]
      const fromIndex = indexesPerNode[r.from]
      const toIndex = indexesPerNode[r.to]
      params[toIndex - 1] = graph.nodes[r.to]
      variables.add(`v${fromIndex}`)
      variables.add(`r${rIndex}`)
      if (graph.nodes[r.to]._id) {
        if (options.hooks && options.hooks.beforeUpdate) {
          const ok = await options.hooks.beforeUpdate(graph.nodes[r.to], graph.objects[r.to])
          if (!ok) {
            throw new Error(
              `beforeUpdate hook didn't return truthy value for node ${JSON.stringify(graph.nodes[r.to], null, 2)}`
            )
          }
        }
        this.emit('update', graph.nodes[r.to], graph.objects[r.to])
        const paramIndex = params.push(`"${graph.nodes[r.to]._id}"`)
        variables.add(`v${toIndex}`)
        addPartialQuery(
          queries,
          `MATCH (v${fromIndex})-[r${rIndex}]->(v${toIndex}) WHERE id(v${toIndex}) = $${paramIndex} SET v${toIndex} = $${toIndex}`,
          variables
        )
      } else {
        if (options.hooks && options.hooks.beforeCreate) {
          const ok = await options.hooks.beforeCreate(graph.nodes[r.to], graph.objects[r.to])
          if (!ok) {
            throw new Error(
              `beforeCreate hook didn't return truthy value for node ${JSON.stringify(graph.nodes[r.to], null, 2)}`
            )
          }
        }
        this.emit('create', graph.nodes[r.to], graph.objects[r.to])
        if (variables.has(`v${toIndex}`)) {
          addPartialQuery(
            queries,
            `CREATE (v${fromIndex})-[r${rIndex}:${r.name}${JSON.stringify(r.metadata).replace(
              /"/g,
              "'"
            )}]->(v${toIndex})`,
            variables
          )
        } else {
          variables.add(`v${toIndex}`)
          const toLabel = graph.nodes[r.to]._label ? `:${graph.nodes[r.to]._label}` : ''
          addPartialQuery(
            queries,
            `CREATE (v${fromIndex})-[r${rIndex}: ${r.name}${JSON.stringify(r.metadata).replace(
              /"/g,
              "'"
            )}]->(v${toIndex}${toLabel} $${toIndex})`,
            variables
          )
        }
      }
    }
    queries.push('RETURN id(v1)')
    return getCypher(queries, params, graph)
  }

  getFinalQuery (queryObject, cypher, nodes) {
    return _getFinalQuery(queryObject, cypher, nodes)
  }

  async jsonToCypherRead (json) {
    return queryObjectToCypher(json, this, () => 'RETURN *')
  }

  async jsonToCypherDelete (json) {
    return queryObjectToCypher(json, this, variables => {
      const nodes = [...variables].filter(v => v.startsWith('v'))
      return `DETACH DELETE ${nodes.join(',')} WITH ${nodes.join(',')} RETURN *`
    })
  }

  async jsonToCypherRelationshipDelete (json) {
    return queryObjectToCypher(json, this, variables => {
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
        root._id = row[rootKey].id
        roots[root._id] = true
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
          if (key !== 'konekto_id') {
            nodesPerKonektoId[row.konekto_id][key] = value
          }
        }
      }
    }
    if (Object.keys(relationships).length !== 0) {
      for (const rel of Object.values(relationships)) {
        nodes[rel.to][isRelated] = true
        nodes[rel.from] = nodes[rel.from]
        if (rel.metadata && rel.metadata.is_array) {
          const relKey = nodes[rel.from][rel.metadata._label]
          if (relKey) {
            relKey.push(nodes[rel.to])
          } else {
            nodes[rel.from][rel.metadata._label] = [nodes[rel.to]]
          }
        } else {
          nodes[rel.from][rel.metadata._label] = nodes[rel.to]
        }
      }
      if (Object.values(nodes).length === 1) {
        const node = Object.values(nodes)[0]
        if (node[isRelated]) {
          delete node[isRelated]
        }
        const result = Object.values(nodes)
        return result
      }
      for (const node of Object.values(nodes)) {
        if (node[isRelated]) {
          delete node[isRelated]
        }
        if (!roots[node._id]) {
          delete nodes[node._id]
        }
      }
    }
    const result = Object.values(nodes)
    return result
  }
}
