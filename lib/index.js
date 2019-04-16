const utils = require('./utils')
const Promise = require('bluebird')
const flatten = require('@flatten/array')
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
    let createLabels = Promise.map(nodeLabels, elabel => this.client.query(`CREATE VLABEL IF NOT EXISTS ${elabel}`))
    return Promise.all([ createLabels, createRelationshipNames ])
  }

  async createEdge (label) {
    await this.client.query(`CREATE ELABEL ${label}`)
  }

  async save (json) {
    let statement = utils.jsonToCypherWrite(json)
    let response = await this.client.query(statement.query, statement.params)
    return utils.parseRows(response.rows)[0]
  }

  async findByQueryObject (queryObject) {
    let statements = utils.jsonToCypherRead(queryObject)
    let responses = await Promise.map(statements, statement => this.client.query(statement.query, statement.params))
    return utils.parseRows(flatten(responses.map(r => r.rows)))
  }

  async findById (id) {
    let statement = {
      query: 'MATCH (a) WHERE id(a) = $1 WITH a\nOPTIONAL MATCH(a)- [r * 0..] -> (b) \nRETURN a, b, r',
      params: [ id ]
    }
    let response = await this.client.query(statement.query, statement.params)
    return utils.parseRows(response.rows)[0]
  }

  async deleteByQueryObject (queryObject) {
    let statement = utils.jsonToCypherDelete(queryObject)
    await this.client.query(statement.query, statement.params)
    return true
  }

  async deleteById (id) {
    let statement = {
      query: 'MATCH (a) WHERE id(a) = $1 WITH a\nOPTIONAL MATCH (a)-[r*0..]->(b)\nDETACH DELETE a, b',
      params: [ id ]
    }
    await this.client.query(statement.query, statement.params)
    return true
  }

  async deleteRelationships (queryObject) {
    let statement = utils.jsonToCypherRelationshipDelete(queryObject)
    await this.client.query(statement.query, statement.params)
    return true
  }

  disconnect () {
    return this.client.end()
  }
}

module.exports = Aghanim
