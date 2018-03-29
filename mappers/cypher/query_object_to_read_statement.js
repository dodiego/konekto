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

function getPagination (idGenerator, nodeId, queryObject) {
  let filterCypherParts = []
  if (queryObject.skip) {
    let skip = idGenerator.nextId()
    filterCypherParts.push(new Statement(`SKIP $${skip}`, { [skip]: queryObject.skip }))
  }
  if (queryObject.limit) {
    let limit = idGenerator.nextId()
    filterCypherParts.push(new Statement(`LIMIT $${limit}`, { [limit]: queryObject.limit }))
  }
  return filterCypherParts
}

function queryObjectIncludeToCypher (parentId, idGenerator, queryObject, cypherParts = [], returnNames = []) {
  if (queryObject.include) {
    for (let include of queryObject.include) {
      let relatedId = idGenerator.nextId()
      let patternId = idGenerator.nextId()
      let parameters = []
      let includeCypherParts = [
        new Statement(
          [
            `CALL apoc.cypher.run('WITH {${parentId}} as ${parentId}`,
            `OPTIONAL MATCH ${patternId} = (${parentId})-[:${include.name}*0..1]->(${relatedId})`
          ].join(' ')
        )
      ]
      if (include.where) {
        let whereStatement = queryObjectWhereToCypher(idGenerator, include, relatedId)
        parameters.push(...Object.keys(whereStatement.parameters))
        includeCypherParts.push(whereStatement)
      }
      includeCypherParts.push(new Statement(`RETURN ${patternId}`))
      if (include.skip || include.limit) {
        let pagination = getPagination(idGenerator, relatedId, include)
        parameters.push(...pagination.map(p => Object.keys(p.parameters)))
        includeCypherParts.push(...pagination)
      }
      includeCypherParts.push(new Statement(`', {${parentId}:${parentId}, ${parameters.map(p => `${p}:$${p}`)}}) YIELD value as ${patternId}`))
      includeCypherParts.push(new Statement(`WITH v1, v4`))
      let includeStatement = includeCypherParts.reduce((result, statement) => {
        Object.assign(result.parameters, statement.parameters)
        result.cypher += `${statement.cypher} `
        return result
      }, new Statement())
      cypherParts.push(includeStatement)
      returnNames.push(`${patternId}.${patternId}`)
      queryObjectIncludeToCypher(relatedId, idGenerator, include, cypherParts, returnNames)
    }
  }
  return {
    cypherParts,
    returnNames
  }
}

function queryObjectToReadStatement (queryObject) {
  let idGenerator = new IdGenerator()
  let nodeId = idGenerator.nextId()
  let firstNodeCypherParts = []
  let returnNames = []
  let firstPatternId = idGenerator.nextId()
  firstNodeCypherParts.push(new Statement(`MATCH ${firstPatternId} = (${nodeId})`))
  if (queryObject.where) {
    firstNodeCypherParts.push(queryObjectWhereToCypher(idGenerator, queryObject, nodeId))
  }
  // ...getPagination(idGenerator, nodeId, queryObject)
  returnNames.push(firstPatternId)
  firstNodeCypherParts.push(new Statement(`WITH ${firstPatternId}, ${nodeId}`))
  let firstStatement = firstNodeCypherParts.reduce((result, statement) => {
    Object.assign(result.parameters, statement.parameters)
    result.cypher += `${statement.cypher} `
    return result
  }, new Statement())
  let includes = queryObjectIncludeToCypher(nodeId, idGenerator, queryObject)
  let statement = [firstStatement, ...includes.cypherParts].reduce((result, statement) => {
    Object.assign(result.parameters, statement.parameters)
    result.cypher += `${statement.cypher}\n`
    return result
  }, new Statement())
  statement.cypher += `\nRETURN ${[firstPatternId, ...includes.returnNames].join(', ')}`
  return statement
}

queryObjectToReadStatement({
  skip: 1,
  limit: 3,
  reference: 'xd',
  args: {
    potato: 'tomato',
    two: 2
  },
  where: (node, args) => node.name > args.two && (node.lul === node.rofl || !node.lastName.startsWith(args.potato)),
  include: [{
    name: 'rel'
  }, {
    name: 'rel2',
    include: [{
      name: 'subrel2',
      skip: 1,
      include: [{
        name: 'subsubrel2',
        limit: 2
      }]
    }]
  }]
})

module.exports = queryObjectToReadStatement
