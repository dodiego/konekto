'use strict'

const uuid = require('uuid')
const CypherNode = require('../../models/cypher_node')
const Statement = require('../../models/statement')
const IdGenerator = require('./id_generator')
const wordRegex = /(\w+)\s*/g

function nodeToCypherNode (idGenerator, node) {
  let nodeId = idGenerator.nextId()
  if (!node.uuid) {
    node.uuid = uuid.v4()
  }
  if (typeof node._label !== 'string') {
    throw new Error('Objects must have an _label property of string type')
  }
  let words = node._label.match(wordRegex)
  if (words.length !== 1) {
    throw new Error('label must be a single word string')
  }
  delete node._label
  return new CypherNode(words[0], nodeId, node)
}

function nodeKeyToRelationshipCypher (key, isArray) {
  let properties = isArray ? ' { isArray: true }' : ''
  let words = key.match(wordRegex)
  if (words.length !== 1) {
    throw new Error('Object keys must be a single word identifier')
  }
  return `-[:${words[0]}${properties}]->`
}

function onMatchCypher (nodeId) {
  let param = nodeId.replace('v', '')
  return `ON MATCH SET ${nodeId} = $${param} ON CREATE SET ${nodeId} = $${param}`
}

function cypherNodeToMergeStatement (idGenerator, cypherNode) {
  return new Statement(
    `MERGE (${cypherNode.id}:${cypherNode.label} {uuid: '${
      cypherNode.node.uuid
    }'}) ${onMatchCypher(cypherNode.id)}`,
    [cypherNode.node],
    cypherNode.node.uuid
  )
}

function parentChildToMergeStatement (
  idGenerator,
  parentCypherNode,
  key,
  childCypherNode,
  isArray
) {
  let relationshipCypher = nodeKeyToRelationshipCypher(key, isArray)
  return new Statement(
    `MERGE (${parentCypherNode.id})` +
      `${relationshipCypher}(${childCypherNode.id}:${
        childCypherNode.label
      } {uuid: '${childCypherNode.node.uuid}'})` +
      ` ${onMatchCypher(childCypherNode.id)}`,
    [childCypherNode.node]
  )
}

function jsonToNode (json, nextNodes) {
  return Object.entries(json).reduce((result, [key, value]) => {
    if (typeof value === 'object' && value !== null) {
      if (Array.isArray(value)) {
        if (value.length > 0 && typeof value[0] === 'object') {
          nextNodes.push(
            ...value.map(item => ({ key, value: item, isArray: true }))
          )
        } else {
          result[key] = value
        }
      } else if (!(value instanceof Date)) {
        nextNodes.push({ key, value })
      } else {
        result[key] = value
      }
    } else {
      result[key] = value
    }
    return result
  }, {})
}

function getRelationshipStatements (
  idGenerator,
  parentCypherNode,
  children,
  statements = []
) {
  for (let item of children) {
    let nextNodes = []
    let node = jsonToNode(item.value, nextNodes)
    let cypherNode = nodeToCypherNode(idGenerator, node)
    let statement = parentChildToMergeStatement(
      idGenerator,
      parentCypherNode,
      item.key,
      cypherNode,
      item.isArray
    )
    statements.push(statement)

    getRelationshipStatements(idGenerator, cypherNode, nextNodes, statements)
  }
  return statements
}

function jsonMapper (items) {
  if (!Array.isArray(items)) {
    items = [items]
  }
  let idGenerator = new IdGenerator()
  let statements = []
  for (let json of items) {
    let nextNodes = []
    let parentNode = jsonToNode(json, nextNodes)
    let parentCypherNode = nodeToCypherNode(idGenerator, parentNode)
    let firstStatement = cypherNodeToMergeStatement(
      idGenerator,
      parentCypherNode
    )
    let otherStatements = getRelationshipStatements(
      idGenerator,
      parentCypherNode,
      nextNodes
    )
    let statement = [firstStatement, ...otherStatements].reduce(
      (result, statement) => {
        result.parameters.push(...statement.parameters)
        result.cypher += `${statement.cypher}\n`
        return result
      },
      new Statement()
    )
    statement.root = firstStatement.uuid
    statements.push(statement)
  }
  return statements
}

module.exports = jsonMapper
