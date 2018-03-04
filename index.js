const neo4j = require('neo4j-driver').v1;
const cypherMapper = require('./mappers/cypher')

const driver = neo4j.driver('bolt://localhost');
const session = driver.session();


let statement = cypherMapper.jsonToWriteStatement({
  name: 'diego',
  friends: [{
    name: 'rafael'
  }, {
    name: 'amanda'
  }]
})
//session.run(statement.cypher, statement.parameters).then(result => {
//  console.log(result)
//  session.close()
//  driver.close()
//})
//console.log(statement.cypher)
//console.log(statement.parameters)
//
//session.run('match (n)-[r]->(m) return n,m,r').then(result => {
//  console.log(JSON.stringify(result.records, null, 2))
//  session.close()
//  driver.close()
//})