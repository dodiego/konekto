const cypherMapper = require('./mappers/cypher')
const { Client } = require('pg')

class Aghanim {
  constructor (options) {
    this.client = new Client({
      database: options.db,
      user: options.user,
      password: options.pass,
      host: options.host,
      port: options.port
    })
  }

  async connect (graphName) {
    await this.client.connect()
    await this.client.query(`SET graph_path = ${graphName || 'agens_graph'}`)
  }

  async save (json) {
    let statements = cypherMapper.jsonMapper(json)
    await Promise.all(
      statements.map(s => this.client.query(s.cypher, s.parameters))
    )
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
    options = Object.assign(
      {},
      { returnResults: false, parseResults: true, parseOptions: null },
      options
    )
    let session = this.driver.session()
    let statement = cypherMapper.queryObjectMapper(queryObject)
    let result = await session.run(statement.cypher, statement.parameters)
    let uuids = cypherMapper.readStatementResultParser.toUuidArray(result)
    await session.run(`MATCH (n) WHERE n.uuid in $uuids DETACH DELETE n`, {
      uuids
    })
    session.close()
    if (options.returnResults) {
      if (options.parseResults) {
        return cypherMapper.readStatementResultParser.toJson(
          result,
          options.parseOptions
        )
      } else {
        return uuids
      }
    }
  }
}
module.exports = Aghanim

async function run () {
  let aghanim = new Aghanim({
    user: 'agens',
    pass: 'agens',
    db: 'agens'
  })
  await aghanim.connect()
  let response = await aghanim.save({
    _label: 'xd',
    createdAt: new Date()
  })
  console.log(response)
}

run().catch(e => {
  console.error(e)
  process.exit(1)
})
