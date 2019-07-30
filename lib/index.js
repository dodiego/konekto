const utils = require('./utils')
const Promise = require('bluebird')
const { Client } = require('pg')

async function _createSchema(json, client) {
  let { relationshipNames, nodeLabels } = utils.getSchema(json)
  let createRelationshipNames = Promise.map(relationshipNames, vlabel =>
    client.query(`CREATE ELABEL IF NOT EXISTS ${vlabel}`)
  )
  let createLabels = Promise.map(nodeLabels, vlabel => client.query(`CREATE VLABEL IF NOT EXISTS ${vlabel}`))
  return Promise.all([createLabels, createRelationshipNames])
}

class Konekto {
  constructor(
    clientConfig = {
      database: 'agens',
      user: 'agens',
      password: 'agens'
    }
  ) {
    this.client = new Client(clientConfig)
  }

  connect() {
    return this.client.connect()
  }

  async createSchema(jsonOrArray) {
    if (Array.isArray(jsonOrArray)) {
      return Promise.map(jsonOrArray, json => _createSchema(json, this.client))
    }
    return _createSchema(jsonOrArray, this.client)
  }

  async createEdge(label) {
    await this.client.query(`CREATE ELABEL ${label}`)
  }

  async raw(query, params, options) {
    if (options && options.parseResult) {
      return utils.parseRows(await this.client.query(query, params), options.rootKey)
    }
    return this.client.query(query, params)
  }

  async save(json, options = {}) {
    let statement = await utils.jsonToCypherWrite(json, options)
    let response = await this.client.query(statement.query, statement.params)
    return utils.parseRows(response.rows, statement.rootKey)[0]
  }

  async findByQueryObject(queryObject, options = {}) {
    let statement = utils.jsonToCypherRead(queryObject, options)
    let response = await this.client.query(statement.query, statement.params)
    return utils.parseRows(response.rows, statement.rootKey)
  }

  async findById(id) {
    let statement = {
      query: 'MATCH (v1) WHERE id(v1) = $1 WITH v1\nOPTIONAL MATCH(v1)- [r * 0..] -> (v2) \nRETURN v1, r, v2',
      params: [id]
    }
    let response = await this.client.query(statement.query, statement.params)
    return utils.parseRows(response.rows, 'v1')[0]
  }

  async deleteByQueryObject(queryObject) {
    let statement = utils.jsonToCypherDelete(queryObject)
    await this.client.query(statement.query, statement.params)
    return true
  }

  async deleteById(id) {
    let statement = {
      query: 'MATCH (a) WHERE id(a) = $1 WITH a\nOPTIONAL MATCH (a)-[r*0..]->(b)\nDETACH DELETE a, b',
      params: [id]
    }
    await this.client.query(statement.query, statement.params)
    return true
  }

  async deleteRelationships(queryObject) {
    let statement = utils.jsonToCypherRelationshipDelete(queryObject)
    await this.client.query(statement.query, statement.params)
    return true
  }

  async createGraph(graphName) {
    await this.client.query(`CREATE GRAPH IF NOT EXISTS ${graphName}`)
  }

  async setGraph(graphName) {
    await this.client.query(`SET graph_path = ${graphName}`)
  }

  disconnect() {
    return this.client.end()
  }
}

module.exports = Konekto
