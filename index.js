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

// session.run([
//   'match p = (n) where n.name CONTAINS "d" with n, p',
//   'optional match q = (n)-[:friends]->(v3) with p, q',
//   'return collect(p), collect(q)[..1]'
// ].join('\n')).then(result => {
//   let array = cypherMapper.readStatementResultToJson(result, false)
//   console.log(JSON.stringify(array, null, 2))
//   session.close()
//   driver.close()
// })

let statement = cypherMapper.queryObjectToReadStatement({
  args: {
    ending: 'd'
  },
  limit: 1,
  skip: 3,
  include: [{
    name: 'friends',
    where: (node, args) => node.name.includes(args.ending),
    args: {
      ending: 'a'
    },
    skip: 0,
    limit: 2
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
