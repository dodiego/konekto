const uuid = require('uuid/v4')
let id = Symbol('id')
let label = Symbol('label')

function * iterateJson (child, key, parent, metadata) {
  if (child && typeof child === 'object' && !Array.isArray(child)) {
    if (!child[label]) {
      throw new Error('every object in the json must have a label defined')
    }
    if (!child[id]) {
      child[id] = uuid()
    }
    let result = {
      [id]: child[id],
      [label]: child[label]
    }
    for (const [key, value] of Object.entries(child)) {
      if (
        typeof value !== 'object' ||
        (Array.isArray(value) && typeof value[0] !== 'object')
      ) {
        result[key] = value
      } else if (Array.isArray(value) && typeof value[0] === 'object') {
        for (const item of value) {
          yield * iterateJson(item, key, child[id], { _isArray: true })
        }
      } else {
        yield * iterateJson(value, key, child[id])
      }
    }
    yield {
      child: result,
      key,
      parent,
      metadata
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
  let root = nodes[relationships.pop().to]
  return {
    root,
    nodes,
    relationships
  }
}

function getSchema (json) {
  let { nodes, relationships } = getNodesAndRelationships(json)
  let relationshipNames = relationships.filter(r => r.name).map(r => r.name)
  let nodeLabels = [...new Set(Object.values(nodes).map(n => n[label]))]
  return {
    relationshipNames,
    nodeLabels
  }
}

function jsonToWriteCypher (json) {
  let { nodes, relationships, root } = getNodesAndRelationships(json)
  let variableIndex = 1
  let paramsBaseIndex = 1
  let params = [root]
  let queries = [
    `MERGE (v${variableIndex}:${root[label]} {uuid: '${
      root[id]
    }'}) ON MATCH SET v${variableIndex} = $${paramsBaseIndex} ON CREATE SET v${variableIndex} = $${paramsBaseIndex}`
  ]
  paramsBaseIndex += 1
  for (const r of relationships) {
    variableIndex++
    params.push(nodes[r.to])
    queries.push(
      `MERGE (v${variableIndex - 1})-[:${r.name}]->(v${variableIndex}:${
        nodes[r.to][label]
      } {uuid: '${
        r.to
      }'}) ON MATCH SET v${variableIndex} = $${paramsBaseIndex} ON CREATE SET v${variableIndex} = $${paramsBaseIndex}`
    )
    paramsBaseIndex += 1
  }
  return {
    root,
    query: queries.join('\n'),
    params
  }
}

module.exports = {
  jsonToWriteCypher,
  getSchema,
  id,
  label
}
