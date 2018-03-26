const neo4j = require('neo4j-driver').v1;
const cypherMapper = require('./mappers/cypher')

const driver = neo4j.driver('bolt://localhost');
const session = driver.session();


let statement = cypherMapper.jsonToWriteStatement({
 name: 'diego',
 friends: [{
   name: 'rafael'
 }, {
   name: 'amanda',
   address: {
     city: 'haha',
     arraylul: [{
       shit: 'rofl'
     }, {
       omega: 'lul'
     }]
   }
 }]
})
console.log(statement.cypher)
//session.run(statement.cypher, statement.parameters).then(result => {
//  session.close()
//  driver.close()
//})


//let statement = cypherMapper.jsonToWriteStatement({
//  osfrog: 'balanced'
//})
//session.run(statement.cypher, statement.parameters).then(() => {
//  session.close()
//  driver.close()
//})


// session.run('match p=(n) optional match q=(n)-[r]->(m) return p,q').then(result => {
//   let array = cypherMapper.readStatementResultToJson(result)
//   console.log(JSON.stringify(array, null, 2))
//   session.close()
//   driver.close()
// })

//session.run('match (n) detach delete n').then(() => {
//  session.close()
//  driver.close()
//})
