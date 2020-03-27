const { Parser } = require('./parser')
const { Client } = require('pg')

function _createSchema (json, client) {
  return _handleTransaction(async parser => {
    const { relationshipNames, nodeLabels } = parser.getSchema(json)
    const clientQueries = []
    for (const vlabel of nodeLabels) {
      clientQueries.push(`CREATE VLABEL IF NOT EXISTS ${vlabel}`)
    }
    for (const elabel of relationshipNames) {
      clientQueries.push(`CREATE ELABEL IF NOT EXISTS ${elabel}`)
    }

    return _runQuery(client, {
      query: clientQueries.join(';')
    })
  }, client)
}

/**
 *
 * @param {import('pg').Client} client
 * @returns {Promise<import('pg').QueryArrayResult>}
 */
async function _runQuery (client, { query, params = undefined }) {
  const result = await client.query(query, params)
  return result
}

/**
 *
 * @param {function(Parser):Promise<any>} fn
 * @param {import('pg').Client} client
 */
async function _handleTransaction (fn, client) {
  const parser = new Parser()
  try {
    await client.query('BEGIN')
    const result = await fn(parser)
    await client.query('COMMIT')
    return result
  } catch (error) {
    client.query('ROLLBACK')
    throw error
  }
}

async function _handleParseRows (parser, client, statement, options) {
  const response = await _runQuery(client, statement)
  // @ts-ignore
  if (!response.rows.length || !response.rows[0].cypher_info) {
    return []
  }
  return parser.parseRows(response.rows, statement.rootKey, {
    ...options,
    graph: statement.graph
  })
}

class Konekto {
  /**
   *
   * @param {import('pg').ClientConfig} clientConfig
   */
  constructor (
    clientConfig = {
      database: 'agens',
      user: 'agens',
      password: 'agens'
    }
  ) {
    this.client = new Client(clientConfig)
    this.plugins = []
    this.sqlMappings = {}
  }

  connect () {
    return this.client.connect()
  }

  setSqlMappings (mappings) {
    this.sqlMappings = mappings
  }

  async createSchema (jsonOrArray) {
    if (Array.isArray(jsonOrArray)) {
      return Promise.all(jsonOrArray.map(json => _createSchema(json, this.client)))
    }
    return _createSchema(jsonOrArray, this.client)
  }

  createLabel (label) {
    if (typeof label === 'string') {
      return _runQuery(this.client, {
        query: `CREATE ELABEL ${label}`
      })
    }

    if (Array.isArray(label)) {
      return label.map(item => _runQuery(this.client, { query: `CREATE ELABEL ${item}` }))
    }

    throw new Error('invalid label type, must be string or array of string')
  }

  createRelationship (name) {
    if (typeof name === 'string') {
      return _runQuery(this.client, {
        query: `CREATE VLABEL ${name}`
      })
    }

    if (Array.isArray(name)) {
      return name.map(item => _runQuery(this.client, { query: `CREATE VLABEL ${item}` }))
    }
    throw new Error('invalid label type, must be string or array of string')
  }

  async raw ({ query, params = undefined }, options = {}) {
    const parser = new Parser()
    const rows = await _runQuery(this.client, { query, params })
    if (options.parseResult) {
      return parser.parseRows(rows, options.rootKey, options)
    }
    return rows
  }

  async save (json, options = {}) {
    return _handleTransaction(async parser => {
      const statement = await parser.jsonToCypherWrite(json, { sqlProjections: this.sqlMappings, ...options })
      await Promise.all([_runQuery(this.client, statement.cypher), _runQuery(this.client, statement.sql)])
      return statement.cypher.graph.root._id
    }, this.client)
  }

  async findByQueryObject (queryObject, options = {}) {
    return _handleTransaction(async parser => {
      const statement = await parser.jsonToCypherRead(queryObject, { sqlProjections: this.sqlMappings, ...options })
      return _handleParseRows(parser, this.client, statement, options)
    }, this.client)
  }

  async findOneByQueryObject (queryObject, options = {}) {
    return (await this.findByQueryObject(queryObject, options))[0]
  }

  async findById (id, options = {}) {
    return _handleTransaction(async parser => {
      const statement = {
        query: 'MATCH (v1 {_id: $1}) WITH v1 OPTIONAL MATCH (v1)-[r*0..]->(v2) RETURN v1, r, v2',
        params: [`"${id}"`],
        rootKey: 'v1'
      }
      statement.query = parser.getFinalQuery(['v1', 'v2'], statement.query, options)
      const result = await _handleParseRows(parser, this.client, statement, options)
      return result[0]
    }, this.client)
  }

  async deleteByQueryObject (queryObject, options = {}) {
    return _handleTransaction(async parser => {
      const statement = await parser.jsonToCypherRead(queryObject, options)
      const nodeIds = []
      const konektoIds = {}
      const sqlMappings = this.sqlMappings.delete
      parser.on('read', node => {
        nodeIds.push(`v._id = '${node._id}'`)
        if (sqlMappings) {
          const mapping = sqlMappings[node._label].table
          if (!konektoIds[mapping]) {
            konektoIds[mapping] = []
          }
          konektoIds[mapping].push(`_id = '${node.konekto_id}'`)
        }
      })
      const result = await _handleParseRows(parser, this.client, statement, options)
      if (result.length) {
        const queries = [this.client.query(`MATCH (v) WHERE ${nodeIds.join(' OR ')} DETACH DELETE v`)]
        if (sqlMappings) {
          queries.push(
            // @ts-ignore
            Object.entries(konektoIds)
              .map(([table, ids]) => `DELETE FROM ${table} WHERE ${ids.join(' OR ')}`)
              .join('\n')
          )
        }
        await Promise.all(queries)
      }
      return result
    }, this.client)
  }

  async deleteById (id, options) {
    const statement = {
      query: 'MATCH (a) WHERE id(a) = $1 WITH a\nOPTIONAL MATCH (a)-[r*0..]->(b)\nDETACH DELETE a, b',
      params: [id],
      rootKey: 'a'
    }
    return _handleTransaction(async parser => {
      const result = await _handleParseRows(parser, this.client, statement, options)
      return result[0]
    }, this.client)
  }

  async deleteRelationshipsByQueryObject (queryObject, options) {
    return _handleTransaction(async parser => {
      const statement = await parser.jsonToCypherRelationshipDelete(queryObject, options)
      return this.client.query(statement.query, statement.params)
    }, this.client)
  }

  /**
   * @param {string} graphName
   */
  async createGraph (graphName) {
    await this.client.query(`CREATE GRAPH IF NOT EXISTS ${graphName}`)
  }

  /**
   * @param {string} graphName
   */
  async setGraph (graphName) {
    await this.client.query(`SET graph_path = ${graphName}`)
  }

  disconnect () {
    return this.client.end()
  }
}
module.exports = Konekto
