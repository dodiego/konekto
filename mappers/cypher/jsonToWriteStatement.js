'use strict'

const uuid = require('uuid')
const _ = require('lodash')
const CypherNode = require('../../models/cypher_node')
const Statement = require('../../models/statement')

function nodeToCypherNode (idGenerator, node) {
  let nodeId = idGenerator()
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
  let uuidParam = idGenerator()
  return new Statement(
    `MERGE (${cypherNode.id} {uuid: $${uuidParam}}) ${onMatchCypher(
      cypherNode.id)}`,
    {
      [cypherNode.id]: cypherNode.node,
      [uuidParam]: cypherNode.node.uuid,
    },
  )
}

function parentChildToMergeStatement (
  idGenerator, parentCypherNode, key, childCypherNode, isArray) {
  let relationshipCypher = nodeKeyToRelationshipCypher(key, isArray)
  let uuidChildParam = idGenerator()
  return new Statement(
    `MERGE (${parentCypherNode.id})` +
    `${relationshipCypher}(${childCypherNode.id} {uuid: $${uuidChildParam}})` +
    ` ${onMatchCypher(childCypherNode.id)}`,
    {
      [uuidChildParam]: childCypherNode.node.uuid
    },
  )
}

function jsonToNode (json, nextNodes) {
  return _.reduce(json, (result, value, key) => {
    if (_.isObjectLike(value)) {
      if (_.isArray(value)) {
        nextNodes.push(
          ..._.map(value, item => ({key: key, value: item, isArray: true})))
      } else {
        nextNodes.push({key: key, value})
      }
    } else {
      result[key] = value
    }
    return result
  }, {})
}

function jsonToWriteStatement (json) {
  let nextNodes = []
  let parentNode = jsonToNode(json, nextNodes)
  let helper = _.runInContext()
  let idGenerator = function () {
    return helper.uniqueId('v')
  }
  let parentCypherNode = nodeToCypherNode(idGenerator, parentNode)
  let firstStatement = cypherNodeToMergeStatement(idGenerator, parentCypherNode)
  let otherStatements = getRelationshipStatements(idGenerator, parentCypherNode,
    nextNodes)

  let parameters = _.merge({}, firstStatement.parameters,
    ..._.map(otherStatements, 'parameters'))
  let cypher = [
    firstStatement.cypher,
    ..._.map(otherStatements, 'cypher')].join('\n')

  return {
    parameters,
    cypher,
  }
}

function getRelationshipStatements (
  idGenerator, parentCypherNode, children, statements = []) {
  _.each(children, item => {
    let nextNodes = []
    let node = jsonToNode(item.value, nextNodes)
    let cypherNode = nodeToCypherNode(idGenerator, node)
    let statement = parentChildToMergeStatement(idGenerator, parentCypherNode,
      item.key, cypherNode, item.isArray)
    statement.parameters[cypherNode.id] = node
    statements.push(statement)

    getRelationshipStatements(idGenerator, cypherNode, nextNodes, statements)
  })
  return statements
}

exports = jsonToWriteStatement

