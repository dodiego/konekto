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
  return parts.sort((a, b) => a.start - b.start).map(n => n.body).join(' ')
}

function queryObjectWhereToStatement (idGenerator, queryObject, nodeId) {
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

function queryObjectOrderToStatement (predicate, nodeId) {
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

function addWithStatement (cypherParts, withVariables) {
  cypherParts.push(new Statement(`WITH ${withVariables.join(', ')}`))
}

function reduceCypherParts (cypherParts, initalParameters, separator = ' ') {
  return cypherParts.reduce((result, statement) => {
    Object.assign(result.parameters, statement.parameters)
    result.cypher += `${statement.cypher}${separator}`
    return result
  }, new Statement('', initalParameters))
}

function queryObjectIncludeToCypher (parentId, idGenerator, queryObject, withVariables, cypherParts = [], returnNames = []) {
  if (queryObject.include) {
    for (let include of queryObject.include) {
      let relatedId = idGenerator.nextId()
      let patternId = idGenerator.nextId()
      let includeCypherParts = []
      let matchStatement = new Statement(`MATCH ${patternId} = (${parentId})-[:${include.name}]->(${relatedId})`)
      if (!include.mandatory) {
        matchStatement.cypher = `OPTIONAL ${matchStatement.cypher}`
      }
      includeCypherParts.push(matchStatement)
      includeCypherParts.push(...filterResults(idGenerator, include, relatedId))
      let sliceStatement = paginateInclude(idGenerator, include)
      withVariables.push(patternId, relatedId)
      addWithStatement(includeCypherParts, withVariables)
      includeCypherParts.push(new Statement(`WITH ${withVariables.join(', ')}`))
      if (include.order) {
        includeCypherParts.push(queryObjectOrderToStatement(include.order, relatedId))
      }
      cypherParts.push(reduceCypherParts(includeCypherParts, sliceStatement.parameters))
      returnNames.push(`collect(${patternId})${sliceStatement.cypher}`)
      queryObjectIncludeToCypher(relatedId, idGenerator, include, withVariables, cypherParts, returnNames)
    }
  }
  return {
    cypherParts,
    returnNames
  }
}

function filterResults (idGenerator, queryObject, nodeId) {
  let cypherParts = []
  if (queryObject.label) {
    if (Array.isArray(queryObject.label)) {
      cypherParts.push(new Statement(`WHERE (${queryObject.label.map(l => `${nodeId}:${l}`).join(' OR ')})`))
    } else {
      cypherParts.push(new Statement(`WHERE (${nodeId}:${queryObject.label})`))
    }
    if (queryObject.where) {
      let whereStatement = queryObjectWhereToStatement(idGenerator, queryObject, nodeId)
      cypherParts.push(new Statement(` AND (${whereStatement.cypher})`, whereStatement.parameters))
    }
  } else {
    let whereStatement = queryObjectWhereToStatement(idGenerator, queryObject, nodeId)
    cypherParts.push(new Statement(`WHERE ${whereStatement.cypher}`, whereStatement.parameters))
  }
  return cypherParts
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
  let headCypherParts = []
  let tailCypherParts = []
  let returnNames = []
  let withVariables = []
  headCypherParts.push(new Statement(`MATCH (${nodeId})`))
  headCypherParts.push(...filterResults(idGenerator, queryObject, nodeId))
  withVariables.push(nodeId)
  addWithStatement(headCypherParts, withVariables)
  returnNames.push(nodeId)
  let includes = queryObjectIncludeToCypher(nodeId, idGenerator, queryObject, withVariables)
  returnNames.push(...includes.returnNames)
  tailCypherParts.push(new Statement(`RETURN ${returnNames.join(', ')}`))
  if (queryObject.order) {
    tailCypherParts.push(queryObjectOrderToStatement(queryObject.order, nodeId))
  }
  tailCypherParts.push(...paginateResults(idGenerator, queryObject))
  return reduceCypherParts([reduceCypherParts(headCypherParts), ...includes.cypherParts, ...tailCypherParts], {}, '\n')
}

module.exports = queryObjectToReadStatement
