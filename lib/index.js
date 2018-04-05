const neo4j = require('neo4j-driver').v1
const cypherMapper = require('./mappers/cypher')

module.exports = class Aghanim {
  constructor (connection = {}, neo4jOptions) {
    let auth = connection.auth ? neo4j.auth.basic(connection.auth.username, connection.auth.password) : undefined
    this.driver = neo4j.driver(`${connection.protocol || 'bolt'}://${connection.host || 'localhost'}`, auth, neo4jOptions)
  }

  async save (json) {
    let session = this.driver.session()
    let statements = cypherMapper.jsonMapper(json)
    await Promise.all(statements.map(s => session.run(s.cypher, s.parameters)))
    if (Array.isArray(json)) {
      return statements.map(s => s.root)
    }
    return statements[0].root
  }

  async findByQueryObject (queryObject, options) {
    let session = this.driver.session()
    let statement = cypherMapper.queryObjectMapper(queryObject)
    let result = await session.run(statement.cypher, statement.parameters)
    session.close()
    return cypherMapper.readStatementResultParser.toJson(result, options)
  }

  async findByUuid (uuid) {
    let session = this.driver.session()
    let statement = cypherMapper.uuidMapper(uuid)
    let result = await session.run(statement.cypher, statement.parameters)
    session.close()
    return cypherMapper.readStatementResultParser.toJson(result)[0]
  }

  async remove (queryObject, options) {
    options = Object.assign({}, { returnResults: false, parseResults: true, parseOptions: null }, options)
    let session = this.driver.session()
    let statement = cypherMapper.queryObjectMapper(queryObject)
    let result = await session.run(statement.cypher, statement.parameters)
    let uuids = cypherMapper.readStatementResultParser.toUuidArray(result)
    await session.run(`MATCH (n) WHERE n.uuid in $uuids DETACH DELETE n`, { uuids })
    session.close()
    if (options.returnResults) {
      if (options.parseResults) {
        return cypherMapper.readStatementResultParser.toJson(result, options.parseOptions)
      } else {
        return uuids
      }
    }
  }
}
