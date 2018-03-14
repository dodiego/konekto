const _ = require('lodash')

function queryObjectWhereToStatementWhere (id, where) {

}

function queryObjectToMatchStatement (idGenerator, queryObject) {
  let id = queryObject.identifier || idGenerator()
  /*let cypher = _.chain([
    `MATCH (${id}:${label})`,
    _filterCypher(queryObject, id),
    `WITH ${id}`,
    _.map(relationshipStatements, 'cypher').join('\n')
  ]).filter().join(' ').value();*/
}

function queryObjectToReadStatement (queryObject) {
  let helper = _.runInContext()

}
