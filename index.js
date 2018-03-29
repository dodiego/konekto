const neo4j = require('neo4j-driver').v1;
const cypherMapper = require('./mappers/cypher')

const driver = neo4j.driver('bolt://localhost');
const session = driver.session();


// let statement = cypherMapper.jsonToWriteStatement({
//  name: 'diego',
//  friends: [{
//    name: 'rafael'
//  }, {
//    name: 'amanda',
//    address: {
//      city: 'haha',
//      arraylul: [{
//        shit: 'rofl'
//      }, {
//        omega: 'lul'
//      }]
//    }
//  }]
// })
// console.log(statement.cypher)
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

// let subquery = `CALL apoc.cypher.run('
//  WITH {n} AS n
//  optional match q = (n)-[r]->(m)
//  RETURN q LIMIT 2',
//  {n:n}) YIELD value as q`
// session.run([
//   'match p=(n)',
//   `${subquery}`,
//   'return p,q.q'
// ].join('\n')).then(result => {
//   let array = cypherMapper.readStatementResultToJson(result)
//   console.log(JSON.stringify(array, null, 2))
//   session.close()
//   driver.close()
// })
let statement = cypherMapper.queryObjectToReadStatement({
  where: (node, args) => node.name.endsWith(args.ending),
  args: {
    ending: '2'
  },
  include: [{
    name: 'friends',
    where: (node, args) => node.name.includes(args.ending),
    args: {
      ending: 'a'
    },
    skip: 1,
    limit: 1
  }]
})
console.log(statement.cypher)
console.log(statement.parameters)
session.run(statement.cypher, statement.parameters).then(result => {
  console.log(JSON.stringify(cypherMapper.readStatementResultToJson(result, false), null, 2))
  session.close()
  driver.close()
})

//session.run('match (n) detach delete n').then(() => {
//  session.close()
//  driver.close()
//})
