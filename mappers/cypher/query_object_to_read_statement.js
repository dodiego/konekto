const acorn = require('acorn')
const tree = acorn.parse('(node, args) => node.name > args.two && (node.lul == node.rofl || !node.lastName.startsWith(args.potato))', {
  preserveParens: true
})
const walk = require("acorn/dist/walk")
//console.log(JSON.stringify(acorn.parse('a.test'), null, 2))
//console.log(JSON.stringify(acorn.parse('a["test"]'), null, 2))
//console.log(JSON.stringify(acorn.parse('a[test]'), null, 2))
//console.log(typeof acorn.parse('a.ladshflkjasd'))

let args = {}
let arrowFunctionNode = tree.body[0].expression
let operators = {
  '==': '=',
  '===': '=',
  '>': '>',
  '>=': '>=',
  '<': '<',
  '<=': '<=',
  '!=': '<>',
  '!==': '<>',
  '&&': 'AND',
  '&': 'AND',
  '||': 'OR',
  '|': 'OR',
  '!': 'NOT',
  'startsWith': 'STARTS WITH',
  'endsWith': 'ENDS WITH',
  'includes': 'CONTAINS',
  'test': '~='
}
let cypherNodes = []
args.node = arrowFunctionNode.params[0].name
args.params = arrowFunctionNode.params[1].name

function getCypherName (node) {
  return node.object.name === args.node ? `${node.object.name}.${node.property.name}` : `$${node.property.name}`
}

walk.ancestor(tree, {
  MemberExpression (node, ancestors) {
    if (!ancestors.some(node => node.type === 'CallExpression')) {
      cypherNodes.push({
        start: node.start,
        body: getCypherName(node)
      })
    }
  },
  CallExpression (node) {
    let left = node.callee.object
    let right = node.arguments[0]
    let operator = node.callee.property.name
    if (operators[operator]) {
      cypherNodes.push({
        start: node.callee.property.start,
        body: `${getCypherName(left)} ${operators[operator]} ${getCypherName(right)}`
      })
    }
  },
  BinaryExpression (node) {
    cypherNodes.push({
      start: node.left.end + 1,
      body: operators[node.operator]
    })
  },
  UnaryExpression (node) {
    cypherNodes.push({
      start: node.start,
      body: `${operators[node.operator]}`
    })
  },
  LogicalExpression (node) {
    cypherNodes.push({
      start: node.left.end + 1,
      body: operators[node.operator]
    })
  },
  ParenthesizedExpression (node) {
    cypherNodes.push({
      start: node.start,
      body: '('
    })
    cypherNodes.push({
      start: node.end,
      body: ')'
    })
  }
})

// console.log(JSON.stringify(tree, null, 2))
console.log(cypherNodes.sort((a, b) => a.start - b.start))
console.log(cypherNodes.sort((a, b) => a.start - b.start).map(n => n.body).join(' '))
