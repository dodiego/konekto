const uuid = require('uuid/v4')
const SqlWhereParser = require('sql-where-parser')
const id = Symbol('id')
const yielded = Symbol('yielded')
const parent = Symbol('parent')
const isRelated = Symbol('isRelated')
const labelRegex = /^[a-z$][a-z_0-9]+$/
const nodeRegex = /(?<label>\w+)\[(?<id>[\d.]+)\](?<node>\{.*\})/g
const relationshipRegex = /(?<label>\w+)\[(?<id>[\d.]+)\]\[(?<from>[\d.]+),(?<to>[\d.]+)\](?<metadata>\{.*?\})/g
const config = SqlWhereParser.defaultConfig
config.operators[5]['STARTSWITH'] = 2
config.operators[5]['ENDSWITH'] = 2
config.operators[5]['CONTAINS'] = 2
const sqlWhereParser = new SqlWhereParser(config)
function isPrimitive (value) {
  return (
    typeof value !== 'object' ||
    (Array.isArray(value) && (typeof value[0] !== 'object' || value[0] instanceof Date)) ||
    value instanceof Date
  )
}
function * iterateJson (child, key, parent, metadata) {
  if (child && typeof child === 'object' && !Array.isArray(child)) {
    if (!child[id]) {
      child[id] = uuid()
    }
    let reference = child[id]
    let result = {
      [id]: child[id],
      _label: child._label
    }
    if (result._label) {
      validateLabel(result._label)
    }
    let nextIteration = []
    for (const [ key, value ] of Object.entries(child)) {
      if (key === '_label') continue
      validateLabel(key)
      if (isPrimitive(value)) {
        result[key] = value
      } else if (Array.isArray(value) && typeof value[0] === 'object') {
        for (const item of value) {
          nextIteration.push({
            child: item,
            key,
            parent: reference,
            metadata: { isArray: true }
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
    result[parent] = parent
    yield {
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

    delete child[id]
    delete child[yielded]
  }
}

function getNodesAndRelationships (json) {
  let nodes = {}
  let relationships = []
  for (const item of iterateJson(json)) {
    nodes[item.child[id]] = item.child
    relationships.push({
      from: item.parent,
      name: item.key,
      to: item.child[id],
      metadata: item.metadata
    })
  }
  let root = nodes[relationships.shift().to]
  return {
    root,
    nodes,
    relationships
  }
}

function getSchema (json) {
  let { nodes, relationships } = getNodesAndRelationships(json)
  let relationshipNames = relationships.filter(r => r.name).map(r => r.name)
  let nodeLabels = [ ...new Set(Object.values(nodes).map(n => n._label)) ]
  return {
    relationshipNames,
    nodeLabels
  }
}

function getIndexesPerNode (nodes) {
  let indexesPerNode = {}
  let nodeIds = Object.keys(nodes)
  for (let index = 0; index < nodeIds.length; index++) {
    const nodeId = nodeIds[index]
    indexesPerNode[nodeId] = index + 1
  }
  return indexesPerNode
}

function getWhereCypher (params, json, variableName) {
  let whereQuery = [ 'WHERE' ]
  if (json._label) {
    let whereLabels
    if (typeof json._label === 'string') {
      whereLabels = [ json._label ]
    } else {
      whereLabels = json._label
    }
    whereLabels = whereLabels.map(l => `label(${variableName}) = '${l}'`).join(' OR ')
    whereQuery.push(whereLabels)
  }
  if (json.where) {
    let parsedWhere = sqlWhereParser.parse(json.where, (operator, operands) => {
      if ([ 'AND', 'OR' ].includes(operator)) {
        return `(${operands[0]} ${operator} ${operands[1]})`
      }
      if (operator === 'STARTSWITH') {
        operator = 'STARTS WITH'
      } else if (operator === 'ENDSWITH') {
        operator = 'ENDS WITH'
      }
      let value = operands[1]
      if (isPrimitive(value)) {
        let paramIndex
        if (value instanceof Date) {
          paramIndex = params.push(value.toISOString())
        } else if (typeof value === 'string') {
          paramIndex = params.push(`"${value}"`)
        } else {
          paramIndex = params.push(value)
        }
        return `(${variableName}.${operands[0]} ${operator} $${paramIndex})`
      }
    })
    whereQuery.push(parsedWhere)
  }
  if (whereQuery.length > 1) {
    return whereQuery.join(' ')
  }
  return ''
}

function getOrderCypher (json, variable) {
  if (json.order) {
    let orderBy
    if (typeof json.order === 'string') {
      orderBy = [ json.order ]
    } else {
      orderBy = json.order
    }
    let cypherOrder = orderBy
      .map(o => (o.startsWith('!') ? `${variable}.${o.slice(1)} DESC` : `${variable}.${o} ASC`))
      .join(', ')
    return `ORDER BY ${cypherOrder}`
  }
  return ''
}

function getPaginationCypher (json, params) {
  let query = []
  if (json.skip > 0) {
    let paramIndex = params.push(json.skip)
    query.push(`SKIP $${paramIndex}`)
  }
  if (json.limit > 0) {
    let paramIndex = params.push(json.limit)
    query.push(`LIMIT $${paramIndex}`)
  }
  return query.join(' ')
}

function getMatchSufix (json, variable, queryEnd) {
  let query = []
  let params = []
  let whereQuery = getWhereCypher(params, json, variable)
  let orderQuery = getOrderCypher(json, variable)
  let paginationQuery = getPaginationCypher(json, params)
  if (whereQuery) {
    query.push(whereQuery)
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
  return `WITH ${[ ...variables ].join(', ')}`
}

function variablesToCypherWith (variables, json, params) {
  let query = [ getWith(variables) ]
  let variablesList = [ ...variables ]
  if (json) {
    let order = getOrderCypher(json, variablesList[variablesList.length - 1])
    if (order) {
      query.push(order)
    }
    let pagination = getPaginationCypher(json, params)
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
    label = [ label ]
  }
  for (const l of label) {
    if (!l) {
      throw new Error(`Every object in the json must have a label defined`)
    }
    if (!labelRegex.test(l)) {
      throw new Error(`Invalid label: ${l}`)
    }
  }
}

async function jsonToCypherWrite (json, options = {}) {
  let { nodes, relationships, root } = getNodesAndRelationships(json)
  let params = [ root ]
  let indexesPerNode = getIndexesPerNode(nodes)
  let queries = []
  let variables = new Set([ `v1` ])
  if (root._id) {
    addPartialQuery(queries, `MATCH (v1:${root._label}) WHERE id(v1) = ${root._id} SET v1 = $1`, variables)
  } else {
    addPartialQuery(queries, `CREATE (v1:${root._label} $1)`, variables)
  }
  for (let rIndex = 0; rIndex < relationships.length; rIndex++) {
    const r = relationships[rIndex]
    let fromIndex = indexesPerNode[r.from]
    let toIndex = indexesPerNode[r.to]
    params[toIndex - 1] = nodes[r.to]
    variables.add(`v${fromIndex}`)
    variables.add(`r${rIndex}`)
    if (nodes[r.to]._id) {
      if (options.hooks && options.hooks.beforeUpdate) {
        let ok = await options.hooks.beforeUpdate(indexesPerNode[r.to])
        if (!ok) {
          throw new Error(
            `beforeUpdate hook didn't return truthy value for node: ${JSON.stringify(indexesPerNode[r.to], null, 2)}`
          )
        }
      }
      let paramIndex = params.push(`"${nodes[r.to]._id}"`)
      variables.add(`v${toIndex}`)
      addPartialQuery(
        queries,
        `MATCH (v${fromIndex})-[r${rIndex}]->(v${toIndex}) WHERE id(v${toIndex}) = $${paramIndex} SET v${toIndex} = $${toIndex}`,
        variables
      )
    } else {
      if (options.hooks && options.hooks.beforeCreate) {
        let ok = await options.hooks.beforeCreate(indexesPerNode[r.to])
        if (!ok) {
          throw new Error(
            `beforeCreate hook didn't return truthy value for node: ${JSON.stringify(indexesPerNode[r.to], null, 2)}`
          )
        }
      }
      if (variables.has(`v${toIndex}`)) {
        addPartialQuery(
          queries,
          `CREATE (v${fromIndex})-[r${rIndex}: ${r.name}${
            r.metadata ? JSON.stringify(r.metadata) : ''
          }]->(v${toIndex})`,
          variables
        )
      } else {
        variables.add(`v${toIndex}`)
        let toLabel = nodes[r.to]._label ? `:${nodes[r.to]._label}` : ''
        addPartialQuery(
          queries,
          `CREATE (v${fromIndex})-[r${rIndex}: ${r.name}${
            r.metadata ? JSON.stringify(r.metadata) : ''
          }]->(v${toIndex}${toLabel} $${toIndex})`,
          variables
        )
      }
    }
  }
  queries.push(`RETURN v1,*`)
  return {
    rootKey: 'v1',
    query: queries.join('\n'),
    params
  }
}

function queryObjectToCypher (json, getQueryEnd) {
  let { nodes, relationships, root } = getNodesAndRelationships(json)
  if (!relationships.length) {
    let rootMatchSufix = getMatchSufix(root, 'v1', getQueryEnd(new Set([ 'v1' ])))
    return {
      query: `MATCH (v1) ${rootMatchSufix.query}`,
      params: rootMatchSufix.params
    }
  }

  let indexesPerNode = getIndexesPerNode(nodes)
  let statements = []
  let variables = new Set([ `v1` ])
  let rootMatchSufix = getMatchSufix(root, 'v1', getWith(variables))
  let rootStatement = {
    query: `MATCH (v1) ${rootMatchSufix.query}`,
    params: rootMatchSufix.params
  }
  statements.push(rootStatement)
  for (let rIndex = 0; rIndex < relationships.length; rIndex++) {
    const r = relationships[rIndex]
    let toNode = nodes[r.to]
    let fromIndex = indexesPerNode[r.from]
    let toIndex = indexesPerNode[r.to]
    variables.add(`v${fromIndex}`)
    variables.add(`r${rIndex}`)
    variables.add(`v${toIndex}`)
    let relationshipMatchSufix = getMatchSufix(toNode, `v${toIndex}`, getWith(variables))
    let relationshipStatement = {
      query: `MATCH (v${fromIndex})-[r${rIndex}:${r.name}]->(v${toIndex}) ${relationshipMatchSufix.query}`,
      params: relationshipMatchSufix.params
    }
    if (toNode.where || toNode.order || toNode.skip || toNode.limit) {
      toNode.mandatory = true
    }
    if (!toNode.mandatory) {
      relationshipStatement.query = `OPTIONAL ${relationshipStatement.query}`
    }
    statements.push(relationshipStatement)
  }
  statements.push({ query: getQueryEnd(variables), params: [] })

  return statements.reduce(
    (result, statement) => {
      result.query += `\n${statement.query}`
      result.params.push(...statement.params)
      return result
    },
    { query: '', params: [], rootKey: 'v1' }
  )
}

function jsonToCypherRead (json) {
  return queryObjectToCypher(json, () => 'RETURN *')
}

function jsonToCypherDelete (json) {
  return queryObjectToCypher(json, variables => {
    let nodes = [ ...variables ].filter(v => v.startsWith('v'))
    return `DETACH DELETE ${nodes.join(',')}`
  })
}
function jsonToCypherRelationshipDelete (json) {
  return queryObjectToCypher(json, variables => {
    let relationships = [ ...variables ].filter(v => v.startsWith('r'))
    return `DELETE ${relationships.join(',')}`
  })
}

function getMatches (string, regex) {
  let matches = []
  let m
  do {
    m = regex.exec(string)
    if (m) {
      matches.push(m)
    }
  } while (m)
  return matches.length && matches
}

function parseRows (rows, rootKey) {
  let relationships = {}
  let nodes = {}
  let roots = {}
  for (const item of rows) {
    if (item[rootKey]) {
      let rootMatch = getMatches(item[rootKey], nodeRegex)[0]
      let root = {
        _id: rootMatch.groups.id,
        _label: rootMatch.groups.label,
        ...JSON.parse(rootMatch.groups.node)
      }
      roots[root._id] = true
    }
    for (const column of Object.values(item)) {
      if (column && column !== '[]') {
        let matches = getMatches(column, nodeRegex) || getMatches(column, relationshipRegex)
        for (const match of matches) {
          if (match.groups.node) {
            nodes[match.groups.id] = {
              _id: match.groups.id,
              _label: match.groups.label,
              ...JSON.parse(match.groups.node)
            }
          } else {
            relationships[match.groups.id] = match.groups
          }
        }
      }
    }
  }
  if (!(Object.keys(relationships).length === 0 && relationships.constructor === Object)) {
    for (const rel of Object.values(relationships)) {
      nodes[rel.to][isRelated] = true
      nodes[rel.from] = nodes[rel.from]
      if (rel.metadata && JSON.parse(rel.metadata).isArray) {
        let relKey = nodes[rel.from][rel.label]
        if (relKey) {
          relKey.push(nodes[rel.to])
        } else {
          nodes[rel.from][rel.label] = [ nodes[rel.to] ]
        }
      } else {
        nodes[rel.from][rel.label] = nodes[rel.to]
      }
    }
    if (Object.values(nodes).length === 1) {
      let node = Object.values(nodes)[0]
      if (node[isRelated]) {
        delete node[isRelated]
      }
      return Object.values(nodes)
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
  return Object.values(nodes)
}

module.exports = {
  jsonToCypherWrite,
  jsonToCypherRead,
  jsonToCypherDelete,
  jsonToCypherRelationshipDelete,
  getSchema,
  parseRows,
  parent
}
