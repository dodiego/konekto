const acorn = require('acorn')
const walk = require('acorn/dist/walk')
const Statement = require('../../models/statement')
const CypherPart = require('../../models/cypher_part')
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

function predicateToWhereStatement (predicate, parameters, nodeId) {
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
  return new Statement(predicateToWhereStatement(queryObject.where, parameters, nodeId), cypherParameters)
}

function queryObjectOrderToCypher (predicate, nodeId) {
  let parts = []
  let tree = acorn.parse(predicate.toString())
  walk.ancestor(tree, {
    UnaryExpression (node) {
      let part = new CypherPart(node.argument.start, `${nodeId}.${node.argument.property.name}`)
      if (node.operator === '!') {
        part.body += ` DESC`
      }
      console.log(node)
      parts.push(part)
    },
    MemberExpression (node, ancestors) {
      if (!ancestors.some(node => node.type === 'UnaryExpression')) {
        parts.push(new CypherPart(node.start, `${nodeId}.${node.property.name}`))
      }
    }
  })
  let cypher = parts.sort((a, b) => a.start - b.start).map(n => n.body).join(', ')
  cypher = `ORDER BY ${cypher}`
  return new Statement(cypher)
}

function paginateInclude (idGenerator, include) {
  let parameters = {}
  let slice = '['
  let skipParameter = idGenerator.nextId()
  slice += `$${skipParameter}`
  parameters[skipParameter] = include.skip || 0
  slice += '..'
  if (Number.isInteger(include.limit)) {
    let limit = idGenerator.nextId()
    slice += `$${limit}`
    parameters[limit] = include.limit + parameters[skipParameter]
  }
  slice += ']'
  return new Statement(slice, parameters)
}

function queryObjectIncludeToCypher (parentId, idGenerator, queryObject, withVariables = [], cypherParts = [], returnNames = []) {
  if (queryObject.include) {
    for (let include of queryObject.include) {
      let relatedId = idGenerator.nextId()
      let patternId = idGenerator.nextId()
      let matchStatement = new Statement(`MATCH ${patternId} = (${parentId})-[:${include.name}]->(${relatedId})`)
      if (!include.mandatory) {
        matchStatement.cypher = `OPTIONAL ${matchStatement.cypher}`
      }
      let includeCypherParts = [ matchStatement ]
      if (include.where) {
        includeCypherParts.push(queryObjectWhereToCypher(idGenerator, include, relatedId))
      }
      let sliceStatement = paginateInclude(idGenerator, include)
      withVariables.push(patternId, relatedId)
      includeCypherParts.push(new Statement(`WITH ${withVariables.join(', ')}`))
      if (include.order) {
        includeCypherParts.push(queryObjectOrderToCypher(include.order, relatedId))
      }
      let includeStatement = includeCypherParts.reduce((result, statement) => {
        Object.assign(result.parameters, statement.parameters)
        result.cypher += `${statement.cypher} `
        return result
      }, new Statement('', sliceStatement.parameters))
      cypherParts.push(includeStatement)
      returnNames.push(`collect(${patternId})${sliceStatement.cypher}`)
      queryObjectIncludeToCypher(relatedId, idGenerator, include, withVariables, cypherParts, returnNames)
    }
  }
  return {
    cypherParts,
    returnNames
  }
}

function paginateResults (idGenerator, queryObject) {
  let pagination = []
  if (Number.isInteger(queryObject.skip)) {
    let skipParameter = idGenerator.nextId()
    pagination.push(new Statement(`SKIP $${skipParameter}`, { [skipParameter]: queryObject.skip }))
  }
  if (Number.isInteger(queryObject.limit)) {
    let limitParameter = idGenerator.nextId()
    pagination.push(new Statement(`LIMIT $${limitParameter}`, { [limitParameter]: queryObject.limit }))
  }
  return pagination
}

function queryObjectToReadStatement (queryObject) {
  let idGenerator = new IdGenerator()
  let nodeId = idGenerator.nextId()
  let firstNodeCypherParts = []
  let returnNames = []
  let withVariables = []
  firstNodeCypherParts.push(new Statement(`MATCH (${nodeId})`))
  withVariables.push(nodeId)
  if (queryObject.where) {
    firstNodeCypherParts.push(queryObjectWhereToCypher(idGenerator, queryObject, nodeId))
  }
  firstNodeCypherParts.push(new Statement(`WITH ${withVariables.join(', ')}`))
  returnNames.push(nodeId)
  let firstStatement = firstNodeCypherParts.reduce((result, statement) => {
    Object.assign(result.parameters, statement.parameters)
    result.cypher += `${statement.cypher} `
    return result
  }, new Statement())
  let includes = queryObjectIncludeToCypher(nodeId, idGenerator, queryObject, withVariables)
  returnNames.push(...includes.returnNames)
  let statement = [firstStatement, ...includes.cypherParts].reduce((result, statement) => {
    Object.assign(result.parameters, statement.parameters)
    result.cypher += `${statement.cypher}\n`
    return result
  }, new Statement())
  statement.cypher += `RETURN ${returnNames.join(', ')}`
  if (queryObject.order) {
    statement.cypher += ` ${queryObjectOrderToCypher(queryObject.order, nodeId).cypher}`
  }
  let pagination = paginateResults(idGenerator, queryObject)
  if (pagination.length) {
    statement.cypher += ` ${pagination.map(p => p.cypher).join(' ')}`
    Object.assign(statement.parameters, ...pagination.map(p => p.parameters))
  }
  return statement
}

module.exports = queryObjectToReadStatement
