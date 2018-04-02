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
const wordRegex = /(\w+)\s/

function getCypherName (node, args, parameters, nodeId) {
  // TODO: add links to official docs
  if (node.property.type === 'Literal') {
    throw new Error('literal property names are not allowed, ' +
                    'use dot notation or a variable name as a property accessor instead.')
  }
  if (!parameters[node.property.name]) {
    throw new Error(`undefined parameter reference "${node.object.name}.${node.property.name}", 
    check the value passed to the correspondent queryObject.args.${node.property.name} `)
  }
  let cypherNames = {
    [args.node]: `${nodeId}.${node.property.name}`,
    [args.params]: `$${parameters[node.property.name]}`
  }
  if (!cypherNames[node.object.name]) {
    // TODO: add a explanation
  }
  return cypherNames[node.object.name]
}

function predicateToWhereStatement (predicate, parameters, nodeId) {
  let tree = acorn.parse(predicate.toString(), {
    preserveParens: true
  })
  let arrowFunctionNode = tree.body[0].expression
  if (arrowFunctionNode.type !== 'ArrowFunctionExpression' ||
      arrowFunctionNode.body.type === 'BlockStatement' ||
      arrowFunctionNode.params.length !== 2) {
    // TODO: add links to official docs
    throw new Error('queryObject.where should be an single line arrow function with two parameters')
  }
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
      } else {
        // TODO: add links to official docs
        throw new Error('Method not supported, check the docs for a full list of supported methods')
      }
    },
    BinaryExpression (node) {
      if (operators[node.operator]) {
        parts.push(new CypherPart(node.left.end + 1, operators[node.operator]))
      } else {
        // TODO: add links to official docs
        throw new Error('Operator not supported, check the docs for a full list of supported operators')
      }
    },
    UnaryExpression (node) {
      if (node.operator === '!') {
        parts.push(new CypherPart(node.start, operators[node.operator]))
      } else {
        throw new Error('Only negation (!) is a valid operator in unary expressions')
      }
    },
    LogicalExpression (node) {
      if (operators[node.operator]) {
        parts.push(new CypherPart(node.left.end + 1, operators[node.operator]))
      } else {
        // TODO: add links to official docs
        throw new Error('Operator not supported, check the docs for a full list of supported operators')
      }
    },
    ParenthesizedExpression (node) {
      parts.push(new CypherPart(node.start, '('))
      parts.push(new CypherPart(node.end, ')'))
    }
  })
  return parts.sort((a, b) => a.start - b.start).map(n => n.body).join(' ')
}

function queryObjectWhereToStatement (idGenerator, queryObject, nodeId) {
  if (!queryObject.args) {
    // TODO: add links to official docs
    throw new Error('You need to provide queryObject.args object ' +
                    'that will be injected as a second argument at the queryOject.where function')
  }
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
  let arrowFunctionNode = tree.body[0].expression
  if (arrowFunctionNode.type !== 'ArrowFunctionExpression' ||
      arrowFunctionNode.body.type === 'BlockStatement' ||
      arrowFunctionNode.params.length !== 2) {
    // TODO: add links to official docs
    throw new Error('queryObject.where should be an single line arrow function with two parameters')
  }
  walk.ancestor(tree, {
    UnaryExpression (node) {
      let part = new CypherPart(node.argument.start, `${nodeId}.${node.argument.property.name}`)
      if (node.operator === '!') {
        part.body += ` DESC`
      } else {
        throw new Error('Only negation (!) is allowed as a unary operator in queryObject.order')
      }
      parts.push(part)
    },
    MemberExpression (node, ancestors) {
      if (node.property.type === 'Literal') {
        throw new Error('literal property names are not allowed, ' +
                        'use dot notation or a variable name as a property accessor instead.')
      }
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
      if (typeof include.name !== 'string') {
        throw new Error('relationship name must be a string')
      }
      let relatedId = idGenerator.nextId()
      let patternId = idGenerator.nextId()
      let includeCypherParts = []
      let matchStatement = new Statement(`MATCH ${patternId} = ` +
                                         `(${parentId})-[:${wordRegex.exec(include.name)[0]}]->(${relatedId})`)
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
      if (queryObject.label.some(label => typeof label !== 'string')) {
        throw new Error('label must be an array of strings or a string itself')
      }
      let labels = queryObject.label.map(label => `${nodeId}:${wordRegex.exec(label)}`).join(' OR ')
      cypherParts.push(new Statement(`WHERE (${labels})`))
    } else {
      if (typeof queryObject.label !== 'string') {
        throw new Error('label must be an array of strings or a string itself')
      }
      cypherParts.push(new Statement(`WHERE (${nodeId}:${wordRegex.exec(queryObject.label)})`))
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
    pagination.push(new Statement(`SKIP $${skipParameter}`, {[skipParameter]: queryObject.skip}))
  }
  if (Number.isInteger(queryObject.limit)) {
    let limitParameter = idGenerator.nextId()
    pagination.push(new Statement(`LIMIT $${limitParameter}`, {[limitParameter]: queryObject.limit}))
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
