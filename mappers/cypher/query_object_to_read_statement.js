const acorn = require('acorn')

function parseWhere(where) {
  let ast = acorn.parse(where)
  let body = ast.body[0].expression.body
}

function parseBinaryExpression(node) {

}