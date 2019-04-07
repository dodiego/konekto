const utils = require('./utils')
const Promise = require('bluebird')
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

  async createSchema (json) {
    let { relationshipNames, nodeLabels } = utils.getSchema(json)
    let createRelationshipNames = Promise.map(relationshipNames, vlabel =>
      this.client.query(`CREATE ELABEL IF NOT EXISTS ${vlabel}`)
    )
    let createLabels = Promise.map(nodeLabels, elabel =>
      this.client.query(`CREATE VLABEL IF NOT EXISTS ${elabel}`)
    )
    return Promise.all([createLabels, createRelationshipNames])
  }

  async createEdge (label) {
    await this.client.query(`CREATE ELABEL ${label}`)
  }

  async save (json) {
    let statement = utils.jsonToWriteCypher(json)
    await this.client.query(statement.query, statement.params)
    return statement.root[utils.id]
  }

  async findByQueryObject (queryObject, options) {
    // let statement = cypherMapper.queryObjectMapper(queryObject)
    // console.log(statement)
    // let result = await this.client.query(statement.cypher, statement.parameters)
    // return cypherMapper.readStatementResultParser.toJson(result, options)
  }

  async findByUuid (uuid) {
    // let session = this.driver.session()
    // let statement = cypherMapper.uuidMapper(uuid)
    // let result = await session.run(statement.cypher, statement.parameters)
    // session.close()
    // return cypherMapper.readStatementResultParser.toJson(result)[0]
  }

  async remove (queryObject, options) {
    //   options = Object.assign(
    //     {},
    //     { returnResults: false, parseResults: true, parseOptions: null },
    //     options
    //   )
    //   let session = this.driver.session()
    //   let statement = cypherMapper.queryObjectMapper(queryObject)
    //   let result = await session.run(statement.cypher, statement.parameters)
    //   let uuids = cypherMapper.readStatementResultParser.toUuidArray(result)
    //   await session.run(`MATCH (n) WHERE n.uuid in $uuids DETACH DELETE n`, {
    //     uuids
    //   })
    //   session.close()
    //   if (options.returnResults) {
    //     if (options.parseResults) {
    //       return cypherMapper.readStatementResultParser.toJson(
    //         result,
    //         options.parseOptions
    //       )
    //     } else {
    //       return uuids
    //     }
    //   }
  }
}

module.exports = Aghanim
