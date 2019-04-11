const uuid = require('uuid/v4')
let id = Symbol('id')
let label = Symbol('label')

function * iterateJson (child, key, parent, metadata) {
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
      yield * iterateJson(
        iteration.child,
        iteration.key,
        iteration.parent,
        iteration.metadata
      )
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
  let nodeLabels = [...new Set(Object.values(nodes).map(n => n[label]))]
  return {
    relationshipNames,
    nodeLabels
  }
}

function jsonToWriteCypher (json) {
  let { nodes, relationships, root } = getNodesAndRelationships(json)
  let params = [root]
  let indexesPerNode = {}
  let nodeIds = Object.keys(nodes)
  for (let index = 0; index < nodeIds.length; index++) {
    const nodeId = nodeIds[index]
    indexesPerNode[nodeId] = index + 1
  }
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
