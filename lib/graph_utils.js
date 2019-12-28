const cypherParser = require('cypher-parser')
const { parameterize } = require('./query_utils')

function parseCypherNode (params, node) {
  const operators = {
    equal: '=',
    'not-equal': '<>',
    or: 'OR',
    and: 'AND',
    not: 'NOT',
    in: 'IN',
    plus: '+',
    minus: '-',
    mult: '*',
    div: '/',
    pow: '^',
    mod: '%',
    'less-than-equal': '<=',
    'less-than': '<',
    'greater-than-equal': '>=',
    'greater-than': '>',
    'starts-with': 'STARTS WITH',
    'ends-with': 'ENDS WITH',
    contains: 'CONTAINS',
    'is-null': 'IS NULL',
    'is-not-null': 'IS NOT NULL'
  }
  if (node.op === 'unary-minus') {
    return `-${parseCypherNode(params, node.arg)}`
  }
  if (node.op === 'not') {
    return `${operators[node.op]} ${parseCypherNode(params, node.arg)}`
  }
  if (node.type === 'unary-operator') {
    return `${parseCypherNode(params, node.arg)} ${operators[node.op]}`
  }
  if (node.type === 'binary-operator') {
    return `${parseCypherNode(params, node.arg1)} ${operators[node.op]} ${parseCypherNode(params, node.arg2)}`
  }
  if (node.type === 'comparison') {
    let result = ''
    for (let i = 0; i < node.args.length - 1; i += 2) {
      result += `${parseCypherNode(params, node.args[i])} ${operators[node.ops[i]]} ${parseCypherNode(
        params,
        node.args[i + 1]
      )}`
    }
    return result
  }
  if (node.type === 'property-operator') {
    return `${node.expression.name}.${node.propName.value}`
  }
  if (node.type === 'apply-operator') {
    return `${node.funcName.value}(${node.args.map(a => parseCypherNode(params, a)).join(',')})`
  }
  if (node.type === 'identifier') {
    return node.name
  }
  if (node.type === 'integer' || node.type === 'float') {
    return parameterize(params, node.value)
  }
  if (node.type === 'string') {
    return parameterize(params, `"${node.value}"`)
  }
  if (node.type === 'false') {
    return parameterize(params, false)
  }
  if (node.type === 'true') {
    return parameterize(params, true)
  }

  if (node.type === 'parameter') {
    return `$${node.name}`
  }

  throw new Error('not implemented cypher parser')
}

async function getWhereCypher (params, json, variableName) {
  const whereQuery = []
  if (json._label) {
    let whereLabels
    if (typeof json._label === 'string') {
      whereLabels = [json._label]
    } else {
      whereLabels = json._label
    }
    whereLabels = whereLabels.map(l => `label(${variableName}) = '${l}'`).join(' OR ')
    whereQuery.push(whereLabels)
  }
  if (json._where) {
    if (json._label) {
      whereQuery.push('AND')
    }
    const ast = await cypherParser.parse(
      `MATCH (${variableName}) WHERE ${json._where.filter
        .replace(/\{this\}/g, variableName)
        .replace(/\s+:(\w+)\b/g, (a, b) => {
          if (typeof json._where.params[b] === 'string') {
            return `$${params.push(`"${json._where.params[b]}"`)}`
          } else {
            return `$${params.push(json._where.params[b])}`
          }
        })}`
    )
    whereQuery.push(parseCypherNode(params, ast.roots[0].body.clauses[0].predicate))
  }
  if (whereQuery.length > 0) {
    return whereQuery.join(' ')
  }
  return ''
}

function getOrderCypher (json, variable) {
  if (json._order) {
    let orderBy
    if (typeof json._order === 'string') {
      orderBy = [json._order]
    } else {
      orderBy = json._order
    }
    const cypherOrder = orderBy
      .map(o => (o.startsWith('!') ? `${variable}.${o.slice(1)} DESC` : `${variable}.${o} ASC`))
      .join(', ')
    return `ORDER BY ${cypherOrder}`
  }
  return ''
}

function getPaginationCypher (json, params) {
  const query = []
  if (json._skip > 0) {
    const paramIndex = params.push(json._skip)
    query.push(`SKIP $${paramIndex}`)
  }
  if (json._limit > 0) {
    const paramIndex = params.push(json._limit)
    query.push(`LIMIT $${paramIndex}`)
  }
  return query.join(' ')
}

function getWith (variables) {
  return `WITH ${[...variables].join(', ')}`
}

module.exports = {
  getWhereCypher,
  getOrderCypher,
  getPaginationCypher,
  getWith
}
