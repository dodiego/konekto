const acorn = require('acorn')
const walk = require('acorn/dist/walk')
const Statement = require('../../models/statement')
const CypherPart = require('../../models/cypher_part')
const CypherPattern = require('../../models/cypher_pattern')
const IdGenerator = require('./id_generator')
const operators = {
  '==': '=',
  '===': '=',
  '>': '>',
  '>=': '>=',
  '<': '<',
  '<=': '<=',
  '!=': '<>',
  '!==': '<>',
  '+': '+',
  '-': '-',
  '*': '*',
  '/': '/',
  '%': '%',
  '**': '^',
  '&&': 'AND',
  '&': 'AND',
  '||': 'OR',
  '|': 'OR',
  '^': 'XOR',
  '!': 'NOT',
  'startsWith': 'STARTS WITH',
  'endsWith': 'ENDS WITH',
  'includes': 'CONTAINS',
  'in': 'IN',
  'test': '=~'
}

// console.log(JSON.stringify(acorn.parse('a.test'), null, 2))
// console.log(JSON.stringify(acorn.parse('a["test"]'), null, 2))
// console.log(JSON.stringify(acorn.parse('a[test]'), null, 2))
// console.log(typeof acorn.parse('a.ladshflkjasd'))

function getCypherName (node, args, parameters, nodeId) {
  return node.object.name === args.node ? `${nodeId}.${node.property.name}` : `$${parameters[node.property.name]}`
}

function predicateToCypher (predicate, parameters, nodeId) {
  let tree = acorn.parse(predicate.toString(), {
    preserveParens: true
  })
  let arrowFunctionNode = tree.body[0].expression
  let args = {}
  let parts = []

  args.node = arrowFunctionNode.params[0].name
  args.params = arrowFunctionNode.params[1].name
  walk.ancestor(tree, {
    MemberExpression (node, ancestors) {
      if (!ancestors.some(node => node.type === 'CallExpression')) {
        parts.push(new CypherPart(node.start, getCypherName(node, args, parameters, nodeId)))
      }
    },
    CallExpression (node) {
      let left = node.callee.object
      let right = node.arguments[0]
      let operator = node.callee.property.name
      if (operators[operator]) {
        parts.push(new CypherPart(node.callee.property.start, [
          getCypherName(left, args, parameters, nodeId),
          operators[operator],
          getCypherName(right, args, parameters, nodeId)
        ].join(' ')))
      }
    },
    BinaryExpression (node) {
      parts.push(new CypherPart(node.left.end + 1, operators[node.operator]))
    },
    UnaryExpression (node) {
      parts.push(new CypherPart(node.start, operators[node.operator]))
    },
    LogicalExpression (node) {
      parts.push(new CypherPart(node.left.end + 1, operators[node.operator]))
    },
    ParenthesizedExpression (node) {
      parts.push(new CypherPart(node.start, '('))
      parts.push(new CypherPart(node.end, ')'))
    }
  })
  let cypher = parts.sort((a, b) => a.start - b.start).map(n => n.body).join(' ')
  cypher = `WHERE ${cypher}`
  return cypher
}

function queryObjectWhereToCypher (idGenerator, queryObject, nodeId) {
  let entries = Object.entries(queryObject.args)
  let parameters = {}
  let cypherParameters = {}
  for (let [key, value] of entries) {
    let id = idGenerator.nextId()
    parameters[key] = id
    cypherParameters[id] = value
  }
  return new Statement(predicateToCypher(queryObject.where, parameters, nodeId), cypherParameters)
}

function queryObjectToMatchCypher (idGenerator, nodeId) {
  let patternId = idGenerator.nextId()
  return new CypherPattern(`MATCH ${patternId} = (${nodeId})`, patternId)
}

function queryObjectToReadStatement (queryObject) {
  let idGenerator = new IdGenerator()
  let nodeId = queryObject.reference || idGenerator.nextId()
  let head = queryObjectToMatchCypher(idGenerator, nodeId)
  let cypherParts = [new Statement(head.cypher), queryObjectWhereToCypher(idGenerator, queryObject, nodeId)]
}

queryObjectToReadStatement({
  skip: 1,
  limit: 3,
  reference: 'xd',
  args: {
    potato: 'tomato',
    two: 2
  },
  where: (node, args) => node.name > args.two && (node.lul === node.rofl || !node.lastName.startsWith(args.potato))
})
