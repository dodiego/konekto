'use strict'

const uuid = require('uuid')
const CypherNode = require('../../models/cypher_node')
const Statement = require('../../models/statement')
const IdGenerator = require('./id_generator')

function nodeToCypherNode (idGenerator, node) {
  let nodeId = idGenerator.nextId()
  if (!node.uuid) {
    node.uuid = uuid.v4()
  }
  return new CypherNode(`(${nodeId} $${nodeId})`, nodeId, node)
}

function nodeKeyToRelationshipCypher (key, isArray) {
  let properties = isArray ? ' { isArray: true }' : ''
  return `-[:${key}${properties}]->`
}

function onMatchCypher (nodeId) {
  return `ON MATCH SET ${nodeId} = $${nodeId} ON CREATE SET ${nodeId} = $${nodeId}`
}

function cypherNodeToMergeStatement (idGenerator, cypherNode) {
  let uuidParam = idGenerator.nextId()
  return new Statement(
    `MERGE (${cypherNode.id} {uuid: $${uuidParam}}) ${onMatchCypher(
      cypherNode.id)}`,
    {
      [cypherNode.id]: cypherNode.node,
      [uuidParam]: cypherNode.node.uuid
    }
  )
}

function parentChildToMergeStatement (idGenerator, parentCypherNode, key, childCypherNode, isArray) {
  let relationshipCypher = nodeKeyToRelationshipCypher(key, isArray)
  let uuidChildParam = idGenerator.nextId()
  return new Statement(
    `MERGE (${parentCypherNode.id})` +
    `${relationshipCypher}(${childCypherNode.id} {uuid: $${uuidChildParam}})` +
    ` ${onMatchCypher(childCypherNode.id)}`,
    {
      [uuidChildParam]: childCypherNode.node.uuid
    }
  )
}

function jsonToNode (json, nextNodes) {
  return Object.entries(json).reduce((result, [key, value]) => {
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        nextNodes.push(...value.map(item => ({key, value: item, isArray: true})))
      } else {
        nextNodes.push({key, value})
      }
    } else {
      result[key] = value
    }
    return result
  }, {})
}

function getRelationshipStatements (idGenerator, parentCypherNode, children, statements = []) {
  for (let item of children) {
    let nextNodes = []
    let node = jsonToNode(item.value, nextNodes)
    let cypherNode = nodeToCypherNode(idGenerator, node)
    let statement = parentChildToMergeStatement(idGenerator, parentCypherNode,
      item.key, cypherNode, item.isArray)
    statement.parameters[cypherNode.id] = node
    statements.push(statement)

    getRelationshipStatements(idGenerator, cypherNode, nextNodes, statements)
  }
  return statements
}

function jsonToWriteStatement (json) {
  let nextNodes = []
  let parentNode = jsonToNode(json, nextNodes)
  let idGenerator = new IdGenerator()
  let parentCypherNode = nodeToCypherNode(idGenerator, parentNode)
  let firstStatement = cypherNodeToMergeStatement(idGenerator, parentCypherNode)
  let otherStatements = getRelationshipStatements(idGenerator, parentCypherNode, nextNodes)
  let statement = [firstStatement, ...otherStatements].reduce((result, statement) => {
    Object.assign(result.parameters, statement.parameters)
    result.cypher += `${statement.cypher}\n`
    return result
  }, new Statement())

  statement.cypher = statement.cypher.slice(0, -1)
  return statement
}

module.exports = jsonToWriteStatement
