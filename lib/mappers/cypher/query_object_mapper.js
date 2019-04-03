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
  startsWith: 'STARTS WITH',
  endsWith: 'ENDS WITH',
  includes: 'CONTAINS',
  in: 'IN',
  test: '=~'
}
const wordRegex = /(\w+)\s*/g
const REGEX_MAX_LENGTH = 1
function getCypherName (node, args, parameters, nodeId) {
  // TODO: add links to official docs
  if (node.property.type === 'Literal') {
    throw new Error(
      'literal property names are not allowed, ' +
        'use dot notation or a variable name as a property accessor instead.'
    )
  }
  if (node.object.name === args.params && !parameters[node.property.name]) {
    throw new Error(`undefined parameter reference "${node.object.name}.${
      node.property.name
    }", 
    check the value passed to the correspondent queryObject.args.${
  node.property.name
} `)
  }
  let cypherNames = {
    [args.node]: `${nodeId}.${node.property.name}`,
    [args.params]: `$${parameters[node.property.name]}`
  }
  if (!cypherNames[node.object.name]) {
    // TODO: add a explanation
    throw new Error()
  }
  return cypherNames[node.object.name]
}

function predicateToWhereStatement (predicate, parameters, nodeId) {
  let tree = acorn.parse(predicate.toString(), {
    preserveParens: true
  })
  let arrowFunctionNode = tree.body[0].expression
  if (
    arrowFunctionNode.type !== 'ArrowFunctionExpression' ||
    arrowFunctionNode.body.type === 'BlockStatement' ||
    arrowFunctionNode.params.length !== 2
  ) {
    // TODO: add links to official docs
    throw new Error(
      'queryObject.where should be an single line arrow function with two parameters'
    )
  }
  let args = {}
  let parts = []

  args.node = arrowFunctionNode.params[0].name
  args.params = arrowFunctionNode.params[1].name
  walk.ancestor(tree, {
    MemberExpression (node, ancestors) {
      if (!ancestors.some(node => node.type === 'CallExpression')) {
        parts.push(
          new CypherPart(
            node.start,
            getCypherName(node, args, parameters, nodeId)
          )
        )
      }
    },
    CallExpression (node) {
      let left = node.callee.object
      let right = node.arguments[0]
      let operator = node.callee.property.name
      if (operators[operator]) {
        parts.push(
          new CypherPart(
            node.callee.property.start,
            [
              getCypherName(left, args, parameters, nodeId),
              operators[operator],
              getCypherName(right, args, parameters, nodeId)
            ].join(' ')
          )
        )
      } else {
        // TODO: add links to official docs
        throw new Error(
          'Method not supported, check the docs for a full list of supported methods'
        )
      }
    },
    BinaryExpression (node) {
      if (operators[node.operator]) {
        parts.push(new CypherPart(node.left.end + 1, operators[node.operator]))
      } else {
        // TODO: add links to official docs
        throw new Error(
          'Operator not supported, check the docs for a full list of supported operators'
        )
      }
    },
    UnaryExpression (node) {
      if (node.operator === '!') {
        parts.push(new CypherPart(node.start, operators[node.operator]))
      } else {
        throw new Error(
          'Only negation (!) is a valid operator in unary expressions'
        )
      }
    },
    LogicalExpression (node) {
      if (operators[node.operator]) {
        parts.push(new CypherPart(node.left.end + 1, operators[node.operator]))
      } else {
        // TODO: add links to official docs
        throw new Error(
          'Operator not supported, check the docs for a full list of supported operators'
        )
      }
    },
    ParenthesizedExpression (node) {
      parts.push(new CypherPart(node.start, '('))
      parts.push(new CypherPart(node.end, ')'))
    }
  })
  return parts
    .sort((a, b) => a.start - b.start)
    .map(n => n.body)
    .join(' ')
}

function queryObjectWhereToStatement (idGenerator, queryObject, nodeId) {
  if (!queryObject.args) {
    // TODO: add links to official docs
    throw new Error(
      'You need to provide queryObject.args object ' +
        'that will be injected as a second argument at the queryOject.where function'
    )
  }
  let entries = Object.entries(queryObject.args)
  let parameters = {}
  let cypherParameters = {}
  for (let [key, value] of entries) {
    let id = idGenerator.nextId()
    parameters[key] = id
    cypherParameters[id] = value
  }
  return new Statement(
    predicateToWhereStatement(queryObject.where, parameters, nodeId),
    cypherParameters
  )
}

function queryObjectOrderToStatement (predicate, nodeId) {
  let parts = []
  let tree = acorn.parse(predicate.toString())
  let arrowFunctionNode = tree.body[0].expression
  if (arrowFunctionNode.type !== 'ArrowFunctionExpression') {
    // TODO: add links to official docs
    throw new Error('queryObject.order should be an single line arrow function')
  }
  walk.ancestor(tree, {
    UnaryExpression (node) {
      let part = new CypherPart(
        node.argument.start,
        `${nodeId}.${node.argument.property.name}`
      )
      if (node.operator === '!') {
        part.body += ` DESC`
      } else {
        throw new Error(
          'Only negation (!) is allowed as a unary operator in queryObject.order'
        )
      }
      parts.push(part)
    },
    MemberExpression (node, ancestors) {
      if (node.property.type === 'Literal') {
        throw new Error(
          'literal property names are not allowed, ' +
            'use dot notation or a variable name as a property accessor instead.'
        )
      }
      if (!ancestors.some(node => node.type === 'UnaryExpression')) {
        parts.push(
          new CypherPart(node.start, `${nodeId}.${node.property.name}`)
        )
      }
    }
  })
  let cypher = parts
    .sort((a, b) => a.start - b.start)
    .map(n => n.body)
    .join(', ')
  cypher = `ORDER BY ${cypher}`
  return new Statement(cypher)
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

function queryObjectIncludeToCypher (
  parentId,
  idGenerator,
  queryObject,
  withVariables,
  cypherParts = [],
  returnNames = []
) {
  if (queryObject.include) {
    for (let include of queryObject.include) {
      if (
        typeof include.name !== 'string' ||
        include.name.match(wordRegex).length > 1
      ) {
        throw new Error('relationship name must be a single word string')
      }
      let relatedId = idGenerator.nextId()
      let patternId = idGenerator.nextId()
      let includeCypherParts = []
      let matchStatement = new Statement(
        `MATCH ${patternId} = ` +
          `(${parentId})-[a:${
            include.name.match(wordRegex)[0]
          }]->(${relatedId})`
      )
      if (!include.mandatory) {
        matchStatement.cypher = `OPTIONAL ${matchStatement.cypher}`
      }
      includeCypherParts.push(matchStatement)
      includeCypherParts.push(...filterResults(idGenerator, include, relatedId))
      withVariables.push(patternId, relatedId)
      addWithStatement(includeCypherParts, withVariables)
      includeCypherParts.push(new Statement(`WITH ${withVariables.join(', ')}`))
      if (include.order) {
        includeCypherParts.push(
          queryObjectOrderToStatement(include.order, relatedId)
        )
      }
      cypherParts.push(reduceCypherParts(includeCypherParts, {}))
      returnNames.push('a', relatedId)
      queryObjectIncludeToCypher(
        relatedId,
        idGenerator,
        include,
        withVariables,
        cypherParts,
        returnNames
      )
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
      if (
        queryObject.label.some(
          label =>
            typeof label !== 'string' ||
            label.match(wordRegex).length !== REGEX_MAX_LENGTH
        )
      ) {
        throw new Error(
          'label must be an array of single word strings or a single word string itself'
        )
      }
      let labels = queryObject.label
        .map(label => `label(${nodeId}) = '${label}'`)
        .join(' OR ')
      cypherParts.push(new Statement(`WHERE (${labels})`))
    } else {
      if (
        typeof queryObject.label !== 'string' ||
        queryObject.label.match(wordRegex).length !== REGEX_MAX_LENGTH
      ) {
        throw new Error(
          'label must be an array of single word strings or a single word string itself'
        )
      }
      cypherParts.push(
        new Statement(`WHERE (label(${nodeId}) = '${queryObject.label}')`)
      )
    }
    if (queryObject.where) {
      let whereStatement = queryObjectWhereToStatement(
        idGenerator,
        queryObject,
        nodeId
      )
      cypherParts.push(
        new Statement(
          ` AND (${whereStatement.cypher})`,
          whereStatement.parameters
        )
      )
    }
  } else if (queryObject.where) {
    let whereStatement = queryObjectWhereToStatement(
      idGenerator,
      queryObject,
      nodeId
    )
    cypherParts.push(
      new Statement(`WHERE ${whereStatement.cypher}`, whereStatement.parameters)
    )
  }
  return cypherParts
}

function paginateResults (idGenerator, queryObject) {
  let pagination = []
  if (Number.isInteger(queryObject.skip)) {
    let skipParameter = idGenerator.nextId()
    pagination.push(
      new Statement(`SKIP $${skipParameter}`, {
        [skipParameter]: queryObject.skip
      })
    )
  }
  if (Number.isInteger(queryObject.limit)) {
    let limitParameter = idGenerator.nextId()
    pagination.push(
      new Statement(`LIMIT $${limitParameter}`, {
        [limitParameter]: queryObject.limit
      })
    )
  }
  return pagination
}

function queryObjectToMatchStatements (idGenerator, queryObject) {
  let nodeId = idGenerator.nextId()
  let headCypherParts = []
  let returnNames = []
  let withVariables = []
  headCypherParts.push(new Statement(`MATCH (${nodeId})`))
  headCypherParts.push(...filterResults(idGenerator, queryObject, nodeId))
  withVariables.push(nodeId)
  addWithStatement(headCypherParts, withVariables)
  returnNames.push(nodeId)
  let includes = queryObjectIncludeToCypher(
    nodeId,
    idGenerator,
    queryObject,
    withVariables
  )
  returnNames.push(...includes.returnNames)

  return {
    cypherParts: [reduceCypherParts(headCypherParts), ...includes.cypherParts],
    returnNames,
    nodeId
  }
}

function queryObjectToReadStatement (queryObject) {
  let idGenerator = new IdGenerator()
  let { returnNames, cypherParts, nodeId } = queryObjectToMatchStatements(
    idGenerator,
    queryObject
  )
  let tailCypherParts = [new Statement(`RETURN ${returnNames.join(', ')}`)]
  if (queryObject.order) {
    tailCypherParts.push(queryObjectOrderToStatement(queryObject.order, nodeId))
  }
  tailCypherParts.push(...paginateResults(idGenerator, queryObject))
  let statement = reduceCypherParts(
    [...cypherParts, ...tailCypherParts],
    {},
    '\n'
  )
  statement.parameters = Object.values(statement.parameters)
  return statement
}

module.exports = queryObjectToReadStatement
