const uuid = require('uuid/v4')
const { sqlFromMongo } = require('sql-from-mongo')
let id = Symbol('id')
let label = Symbol('label')
let isRelated = Symbol('isRelated')
let where = Symbol('where')
function * iterateJson (child, key, parent, metadata) {
  if (child && typeof child === 'object' && !Array.isArray(child)) {
    if (!child[label]) {
      throw new Error(`every object in the json must have a label defined: ${JSON.stringify(child, null, 2)}`)
    }
    let reference = uuid()
    let result = {
      [id]: reference,
      [label]: child[label],
      [where]: child[where]
    }
    let nextIteration = []
    for (const [ key, value ] of Object.entries(child)) {
      if (
        typeof value !== 'object' ||
        (Array.isArray(value) && typeof value[0] !== 'object') ||
        value instanceof Date
      ) {
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

function variablesToCypherWith (variables) {
  return `WITH ${[ ...variables ].join(', ')}`
}

function addPartialQuery (queries, query, variables) {
  queries.push(`${query} ${variablesToCypherWith(variables)}`)
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

function queryObjectToCypher (json) {
  let { nodes, relationships, root } = getNodesAndRelationships(json)
  let indexesPerNode = getIndexesPerNode(nodes)
  let variables = new Set([ `v1` ])
  let rootMatch = [ `MATCH (v1:${root[label]})` ]
  if (root[where]) {
    rootMatch.push(`WHERE ${sqlFromMongo(root[where], 'v1')}`)
  }
  let queries = []
  addPartialQuery(queries, rootMatch.join(' '), variables)
  for (let rIndex = 0; rIndex < relationships.length; rIndex++) {
    const r = relationships[rIndex]
    let fromIndex = indexesPerNode[r.from]
    let toIndex = indexesPerNode[r.to]
    variables.add(`v${fromIndex}`)
    variables.add(`r${rIndex}`)
    variables.add(`v${toIndex}`)
    let relationshipMatch = [
      `OPTIONAL MATCH (v${fromIndex})-[r${rIndex}:${r.name}]->(v${toIndex}:${nodes[r.to][label]})`
    ]
    if (nodes[r.to][where]) {
      relationshipMatch.push(`WHERE ${sqlFromMongo(nodes[r.to][where], 'v' + toIndex)}`)
    }
    addPartialQuery(queries, relationshipMatch.join(' '), variables)
  }
  return {
    variables,
    queries
  }
}

function jsonToCypherRead (json) {
  let { queries } = queryObjectToCypher(json)
  queries.push('RETURN *')
  return {
    query: queries.join('\n').replace(/"/g, "'")
  }
}

function jsonToCypherDelete (json) {
  let { queries, variables } = queryObjectToCypher(json)
  let nodes = [ ...variables ].filter(v => v.startsWith('v'))
  queries.push(`DETACH DELETE ${nodes.join(',')}`)
  return {
    query: queries.join('\n').replace(/"/g, "'")
  }
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
  let nodeRegex = /(?<label>\w+)\[(?<id>[\d.]+)\](?<node>\{.*\})/g
  let relationshipRegex = /(?<label>\w+)\[(?<id>[\d.]+)\]\[(?<from>[\d.]+),(?<to>[\d.]+)\](?<metadata>\{.*?\})/g
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
  let json = {}
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
      if (!nodes[rel.from][isRelated]) {
        json[rel.from] = nodes[rel.from]
      }
    }
    return Object.values(json)
  }
  return Object.values(nodes)
}

module.exports = {
  jsonToCypherWrite,
  jsonToCypherRead,
  jsonToCypherDelete,
  getSchema,
  parseRows,
  id,
  label,
  where
}
