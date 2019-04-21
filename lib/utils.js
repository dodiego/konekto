const uuid = require('uuid/v4')
const SqlWhereParser = require('sql-where-parser')
const id = Symbol('id')
const label = Symbol('label')
const isRelated = Symbol('isRelated')
const labelRegex = /^[a-z$][a-z_0-9]+$/
const nodeRegex = /(?<label>\w+)\[(?<id>[\d.]+)\](?<node>\{.*\})/g
const relationshipRegex = /(?<label>\w+)\[(?<id>[\d.]+)\]\[(?<from>[\d.]+),(?<to>[\d.]+)\](?<metadata>\{.*?\})/g
const config = SqlWhereParser.defaultConfig
config.operators[5]['STARTSWITH'] = 2
config.operators[5]['ENDSWITH'] = 2
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
    let reference = uuid()
    let result = {
      [id]: reference,
      [label]: child[label]
    }
    if (result[label]) {
      validateLabel(result[label])
    }
    let nextIteration = []
    for (const [ key, value ] of Object.entries(child)) {
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
    yield {
      child: result,
      key,
      parent,
      metadata
    }
    for (const iteration of nextIteration) {
      yield * iterateJson(iteration.child, iteration.key, iteration.parent, iteration.metadata)
    }
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
  let nodeLabels = [ ...new Set(Object.values(nodes).map(n => n[label])) ]
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

function getRelationshipCypher (r, rIndex, indexesPerNode, nodes) {
  let fromIndex = indexesPerNode[r.from]
  let toIndex = indexesPerNode[r.to]
  return {
    relationshipCypher: `(v${fromIndex})-[r${rIndex}:${r.name}${
      r.metadata ? JSON.stringify(r.metadata) : ''
    }]->(v${toIndex}:${nodes[r.to][label]} $${toIndex})`,
    toIndex,
    fromIndex
  }
}

function getWhereCypher (params, json, variableName) {
  let whereQuery = [ 'WHERE' ]
  if (json[label]) {
    let whereLabels
    if (typeof json[label] === 'string') {
      whereLabels = [ json[label] ]
    } else {
      whereLabels = json[label]
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

function variablesToCypherWith (variables, json, params) {
  let query = []
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
  query.unshift(`WITH ${variablesList.join(', ')}`)
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

function jsonToCypherWrite (json) {
  let { nodes, relationships, root } = getNodesAndRelationships(json)
  let params = [ root ]
  let indexesPerNode = getIndexesPerNode(nodes)
  let queries = []
  let variables = new Set([ `v1` ])
  if (root._id) {
    addPartialQuery(queries, `MATCH (v1:${root[label]}) WHERE id(v1) = ${root._id} SET v1 = $1`, variables)
  } else {
    addPartialQuery(queries, `CREATE (v1:${root[label]} $1)`, variables)
  }
  for (let rIndex = 0; rIndex < relationships.length; rIndex++) {
    const r = relationships[rIndex]
    let { relationshipCypher, toIndex, fromIndex } = getRelationshipCypher(r, rIndex, indexesPerNode, nodes)
    params[toIndex - 1] = nodes[r.to]
    variables.add(`v${fromIndex}`)
    variables.add(`r${rIndex}`)
    variables.add(`v${toIndex}`)
    if (nodes[r.to]._id) {
      addPartialQuery(
        queries,
        `MATCH ${relationshipCypher} WHERE id(v${toIndex}) = ${nodes[r.to]._id} SET v${toIndex} = $${toIndex}`,
        variables
      )
    } else {
      addPartialQuery(queries, `CREATE ${relationshipCypher}`, variables)
    }
  }
  queries.push(`RETURN *`)
  return {
    root,
    query: queries.join('\n'),
    params
  }
}

function queryObjectToCypher (json, getQueryEnd) {
  let generator = iterateJson(json)
  let rootItem = generator.next().value
  let root = rootItem.child
  let rootParams = []
  let rootMatch = [ `MATCH (v1)` ]
  let rootWhere = getWhereCypher(rootParams, root, 'v1')
  if (rootWhere) {
    rootMatch.push(rootWhere)
  }
  rootMatch.push(variablesToCypherWith([ 'v1' ], root, rootParams))
  let statements = []
  let nodes = {
    [root[id]]: rootItem
  }
  let hasRelationships = false
  let baseIndex = 1
  rootItem.index = baseIndex++
  for (const item of generator) {
    hasRelationships = true
    nodes[item.child[id]] = item
    let relationshipParams = []
    let relationshipMatch = []
    let currentItem = nodes[item.child[id]]
    let currentChild = item.child
    let relationshipVariables = new Set()
    let partialQueries = []
    if (currentChild.where || currentChild.limit || currentChild.skip) {
      currentChild.mandatory = true
    }
    while (currentItem) {
      let parentItem = nodes[currentItem.parent]
      if (!parentItem || !currentItem.key) {
        break
      }
      let currentParams = []
      let currentMatch = []
      let currentMatchVariables = new Set()
      if (!currentItem.index) {
        currentItem.index = baseIndex++
      }
      currentMatchVariables.add(`v${parentItem.index}`)
      currentMatchVariables.add(`v${currentItem.index}`)
      currentMatchVariables.add(`r${currentItem.index}`)
      currentMatch.push(
        `MATCH (v${parentItem.index})-[r${currentItem.index}:${currentItem.key}]->(v${currentItem.index})`
      )
      if (!currentChild.mandatory) {
        currentMatch.unshift('OPTIONAL ')
      }
      let currentWhere = getWhereCypher(currentParams, currentChild, `v${currentItem.index}`)
      if (currentWhere) {
        currentMatch.push(currentWhere)
      }
      partialQueries.unshift({
        query: currentMatch,
        variables: currentMatchVariables,
        child: currentChild,
        params: currentParams
      })
      currentItem = parentItem
    }

    for (let index = partialQueries.length - 1; index >= 0; index--) {
      const part = partialQueries[index]
      for (let innerIndex = 0; innerIndex <= index; innerIndex++) {
        const partVariables = partialQueries[innerIndex].variables
        for (const variable of partVariables) {
          part.variables.add(variable)
        }
      }
      part.query.push(variablesToCypherWith(part.variables, part.child, relationshipParams))
      relationshipParams.unshift(...part.params)
      relationshipMatch.unshift(part.query.join(' '))
    }
    relationshipMatch.unshift(rootMatch.join(' '))
    relationshipMatch.push(getQueryEnd(relationshipVariables))
    statements.push({
      query: relationshipMatch.join(' '),
      params: relationshipParams
    })
  }

  if (!hasRelationships) {
    statements.push({
      query: `${rootMatch.join(' ')} ${getQueryEnd(new Set([ `v1` ]))}`,
      params: rootParams
    })
  }

  return statements
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

function parseRows (rows) {
  console.time('parse')
  let relationships = {}
  let nodes = {}
  for (const item of rows) {
    for (const column of Object.values(item)) {
      if (column && column !== '[]') {
        let matches = getMatches(column, nodeRegex) || getMatches(column, relationshipRegex)
        for (const match of matches) {
          if (match.groups.node) {
            nodes[match.groups.id] = {
              _id: match.groups.id,
              [label]: match.groups.label,
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
    for (const node of Object.values(nodes)) {
      if (node[isRelated]) {
        delete node[isRelated]
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
  label
}
