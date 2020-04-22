const uuid = require('uuid/v4')
const yielded = Symbol('yielded')
const labelRegex = /^[a-z$][a-z_0-9]*$/
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

function isPrimitive (value) {
  return (
    value === null ||
    value === undefined ||
    typeof value !== 'object' ||
    (typeof value === 'object' && value && value._json === true) ||
    (Array.isArray(value) && value.some(item => isPrimitive(item))) ||
    value instanceof Date
  )
}

function * iterateJson (child, options, key, parent, metadata) {
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
      if (
        (options &&
          options.sqlProjections &&
          options.sqlProjections[child._label] &&
          options.sqlProjections[child._label].mappings[key]) ||
        isPrimitive(value)
      ) {
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
        yield * iterateJson(iteration.child, options, iteration.key, iteration.parent, iteration.metadata)
      }
    }
    delete child[yielded]
    delete child[id]
  }
}

function getNodesAndRelationships (json, options) {
  const nodes = {}
  const objects = {}
  const relationships = []
  for (const item of iterateJson(json, options)) {
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

function parameterize (params, value) {
  const paramIndex = params.push(value)
  return `$${paramIndex}`
}

module.exports = {
  getNodesAndRelationships,
  getIndexesPerNode,
  queryKeys,
  id,
  parameterize,
  isPrimitive,
  validateLabel
}
