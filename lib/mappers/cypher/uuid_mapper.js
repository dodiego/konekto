const Statement = require('../../models/statement')
module.exports = function (uuid) {
  return new Statement([
    'MATCH (a {uuid: $uuid}) WITH a',
    'MATCH p = (a)-[r*0..]->(b)',
    'RETURN a, collect(p)'
  ].join('\n'), { uuid })
}
