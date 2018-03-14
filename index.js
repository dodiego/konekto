const neo4j = require('neo4j-driver').v1;
const cypherMapper = require('./mappers/cypher')

const driver = neo4j.driver('bolt://localhost');
const session = driver.session();


//let statement = cypherMapper.jsonToWriteStatement({
//  name: 'diego 2',
//  friends: [{
//    name: 'rafael 2'
//  }, {
//    name: 'amanda 2',
//    address: {
//      city: 'sao caetano 2',
//      arraylul: [{
//        shit: 'rofl 2'
//      }, {
//        omega: 'lul 2'
//      }]
//    }
//  }]
//})
//session.run(statement.cypher, statement.parameters).then(result => {
//  console.log(result)
//  session.close()
//  driver.close()
//})
//console.log(statement.cypher)
//console.log(statement.parameters)
//
session.run('match p=(n)-[r]->(m) return p').then(result => {
  let array = cypherMapper.readStatementResultToJson(result)
//  console.log(JSON.stringify(array, null, 2))
//  console.log(array.length)
//  console.log(array[0].start.identity.toNumber())
  session.close()
  driver.close()
})
