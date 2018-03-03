'use strict'

const uuid = require('uuid')
const _ = require('lodash')

class CypherNode {
  constructor (cypher, id, node) {
    this.cypher = cypher
    this.id = id
    this.node = node
  }
}

class Statement {
  constructor (cypher, parameters) {
    this.cypher = cypher
    this.parameters = parameters
  }
}

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
  return `ON MATCH SET ${nodeId} = $${nodeId}`
}

function cypherNodeToMergeStatement (idGenerator, cypherNode) {
  return new Statement(
    `MERGE ${cypherNode.cypher} ${onMatchCypher(cypherNode.id)}`,
    {
      [cypherNode.id]: cypherNode.node,
    },
  )
}

function parentChildToMergeCypher (
  parentCypherNode, key, childCypherNode, isArray) {
  let relationshipCypher = nodeKeyToRelationshipCypher(key, isArray)
  return `MERGE ${parentCypherNode.cypher}${relationshipCypher}${childCypherNode.cypher} ${onMatchCypher(
    childCypherNode.id)}`
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
  let otherStatements = jsonToWriteStatements(idGenerator, parentCypherNode,
    nextNodes)

  let parameters = _.merge({}, firstStatement.parameters,
    ..._.map(otherStatements, 'parameters'))
  let cypher = [
    firstStatement.cypher,
    ..._.map(otherStatements, 'cypher')].join('\n')
  console.log(parameters)
  console.log(cypher)
}

function jsonToWriteStatements (
  idGenerator, parentCypherNode, childs, statements = []) {
  _.each(childs, item => {
    let nextNodes = []
    let node = jsonToNode(item.value, nextNodes)
    let cypherNode = nodeToCypherNode(idGenerator, node)
    statements.push(new Statement(
      parentChildToMergeCypher(parentCypherNode, item.key, cypherNode,
        item.isArray),
      {[cypherNode.id]: node},
    ))

    jsonToWriteStatements(idGenerator, cypherNode, nextNodes, statements)
  })
  return statements
}

jsonToWriteStatement({
  name: 'Diego',
  friends: [
    {
      name: 'Amanda',
    }, {
      name: 'Rafael',
    }],
  city: {
    name: 'Curitiba',
    country: {
      name: 'brazil',
      planet: {
        name: 'earth',
        neighboors: [
          {
            'name': 'venus',
          }, {
            name: 'mars',
          }],
      },
    },
  },
})