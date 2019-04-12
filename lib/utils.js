const uuid = require('uuid/v4')
const { sqlFromMongo } = require('sql-from-mongo')
let id = Symbol('id')
let label = Symbol('label')
let isRelated = Symbol('isRelated')
function* iterateJson(child, key, parent, metadata) {
  if (child && typeof child === 'object' && !Array.isArray(child)) {
    if (!child[label]) {
      throw new Error(
        `every object in the json must have a label defined: ${JSON.stringify(
          child,
          null,
          2
        )}`
      )
    }
    if (!child[id]) {
      child[id] = uuid()
    }
    let result = {
      [id]: child[id],
      [label]: child[label]
    }
    let nextIteration = []
    for (const [key, value] of Object.entries(child)) {
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
            parent: child[id],
            metadata: { _isArray: true }
          })
        }
      } else {
        nextIteration.push({
          child: value,
          key,
          parent: child[id]
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
      yield* iterateJson(
        iteration.child,
        iteration.key,
        iteration.parent,
        iteration.metadata
      )
    }
  }
}

function getNodesAndRelationships(json) {
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

function getSchema(json) {
  let { nodes, relationships } = getNodesAndRelationships(json)
  let relationshipNames = relationships.filter(r => r.name).map(r => r.name)
  let nodeLabels = [...new Set(Object.values(nodes).map(n => n[label]))]
  return {
    relationshipNames,
    nodeLabels
  }
}

function getIndexesPerNode(nodes) {
  let indexesPerNode = {}
  let nodeIds = Object.keys(nodes)
  for (let index = 0; index < nodeIds.length; index++) {
    const nodeId = nodeIds[index]
    indexesPerNode[nodeId] = index + 1
  }
  return indexesPerNode
}

function jsonToCypherWrite(json) {
  let { nodes, relationships, root } = getNodesAndRelationships(json)
  let params = [root]
  let indexesPerNode = getIndexesPerNode(nodes)
  let rootIndex = indexesPerNode[root[id]]
  let queries = [
    `MERGE (v${rootIndex}:${root[label]} {uuid: '${
      root[id]
    }'}) ON MATCH SET v${rootIndex} = $${rootIndex} ON CREATE SET v${rootIndex} = $${rootIndex} `
  ]
  for (const r of relationships) {
    let fromIndex = indexesPerNode[r.from]
    let toIndex = indexesPerNode[r.to]
    params[toIndex - 1] = nodes[r.to]
    queries.push(
      `MERGE (v${fromIndex})-[:${r.name}]->(v${toIndex}:${
        nodes[r.to][label]
      } {uuid: '${
        r.to
      }'}) ON MATCH SET v${toIndex} = $${toIndex} ON CREATE SET v${toIndex} = $${toIndex}`
    )
  }
  queries.push(`RETURN v${rootIndex}`)
  return {
    root,
    query: queries.join('\n'),
    params
  }
}

function variablesToCypherWith(variables) {
  return `WITH ${[...variables].join(', ')}`
}

function jsonToCypherRead(json) {
  let { nodes, relationships, root } = getNodesAndRelationships(json)
  let indexesPerNode = getIndexesPerNode(nodes)
  let rootIndex = indexesPerNode[root[id]]
  let variables = new Set([`v${rootIndex}`])
  let rootMatch = [`MATCH (v${rootIndex}:${root[label]})`]
  if (Object.keys(root).length) {
    rootMatch.push(`WHERE ${sqlFromMongo(root, `v${rootIndex}`)}`)
  }
  rootMatch.push(variablesToCypherWith(variables))
  let queries = [rootMatch.join(' ')]
  for (let rIndex = 0; rIndex < relationships.length; rIndex++) {
    const r = relationships[rIndex]
    let fromIndex = indexesPerNode[r.from]
    let toIndex = indexesPerNode[r.to]
    variables.add(`v${fromIndex}`)
    variables.add(`r${rIndex}`)
    variables.add(`v${toIndex}`)
    let relationshipMatch = [
      `OPTIONAL MATCH (v${fromIndex})-[r${rIndex}:${r.name}]->(v${toIndex}:${
        nodes[r.to][label]
      })`
    ]
    if (Object.keys(nodes[r.to]).length) {
      relationshipMatch.push(sqlFromMongo(nodes[r.to].where, `v${toIndex}`))
    }
    relationshipMatch.push(variablesToCypherWith(variables))
    queries.push(relationshipMatch.join(' '))
  }
  queries.push('RETURN *')
  return {
    query: queries.join('\n').replace(/"/g, "'")
  }
}

function parseRows(rows) {
  let nodeRegex = /(?<label>\w+)\[(?<id>[\d.]+)\](?<node>\{.+\})/
  let relationshipRegex = /(?<label>\w+)\[(?<id>[\d.]+)\]\[(?<from>[\d.]+),(?<to>[\d.]+)\](?<attrs>\{.*\})/
  let rowRels = {}
  let rowNodes = {}
  for (const item of rows) {
    for (const column of Object.values(item)) {
      if (column) {
        let result = nodeRegex.exec(column) || relationshipRegex.exec(column)
        if (result.groups.node) {
          rowNodes[result.groups.id] = {
            [id]: result.groups.id,
            [label]: result.groups.label,
            ...JSON.parse(result.groups.node)
          }
        } else {
          rowRels[result.groups.id] = result.groups
        }
      }
    }
  }
  let json = {}
  if (!(Object.keys(rowRels).length === 0 && rowRels.constructor === Object)) {
    for (const rel of Object.values(rowRels)) {
      rowNodes[rel.to][isRelated] = true
      if (!rowNodes[rel.from][isRelated]) {
        json[rel.from] = rowNodes[rel.from]
        json[rel.from][rel.label] = rowNodes[rel.to]
        delete rowNodes[rel.to][isRelated]
      }
    }
  } else {
    for (const [id, node] of Object.entries(rowNodes)) {
      json[id] = node
    }
  }
  return Object.values(json)
}

module.exports = {
  jsonToCypherWrite,
  jsonToCypherRead,
  getSchema,
  parseRows,
  id,
  label
}
