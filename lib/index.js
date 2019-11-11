const { Parser } = require('./parser')
const { Client } = require('pg')

function _createSchema (json, client, plugins) {
  return _handleTransaction(
    async parser => {
      const { relationshipNames, nodeLabels } = parser.getSchema(json)
      const clientQueries = []
      for (const vlabel of nodeLabels) {
        clientQueries.push(`CREATE VLABEL IF NOT EXISTS ${vlabel}`)
      }
      for (const elabel of relationshipNames) {
        clientQueries.push(`CREATE ELABEL IF NOT EXISTS ${elabel}`)
      }

      return _runQuery(client, parser, {
        query: clientQueries.join(';')
      })
    },
    'createSchema',
    client,
    plugins
  )
}

async function _runQuery (client, parser, statement) {
  const result = await client.query(statement.query, statement.params)
  return result
}

async function _handleTransaction (fn, event, client, plugins) {
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
  const response = await _runQuery(client, parser, statement)
  if (!response.rows.length || !response.rows[0].cypher_info) {
    return []
  }
  return parser.parseRows(response.rows, statement.rootKey, {
    ...options,
    graph: statement.graph
  })
}

class Konekto {
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
    this.sqlMappings = {
      insert: mappings,
      delete: mappings,
      read: Object.values(mappings)
    }
  }

  async createSchema (jsonOrArray) {
    if (Array.isArray(jsonOrArray)) {
      return Promise.all(jsonOrArray.map(json => _createSchema(json, this.client, this.plugins)))
    }
    return _createSchema(jsonOrArray, this.client, this.plugins)
  }

  async createEdge (label) {
    _handleTransaction(
      parser =>
        _runQuery(this.client, parser, {
          query: `CREATE ELABEL ${label}`
        }),
      'createEdge',
      this.client,
      this.plugins
    )
  }

  async raw ({ query, params }, options = {}) {
    const parser = new Parser()
    const rows = await _runQuery(this.client, parser, { query, params })
    if (options.parseResult) {
      return parser.parseRows(rows, options.rootKey, options)
    }
    return rows
  }

  async save (json, options = {}) {
    return _handleTransaction(
      async parser => {
        const statement = await parser.jsonToCypherWrite(json, { ...options, sqlMappings: this.sqlMappings.insert })
        const result = await this.client.query(statement.cypher.query, statement.cypher.params)
        await this.client.query(statement.sql.query, statement.sql.params)
        return result.rows[0].id
      },
      'save',
      this.client,
      this.plugins
    )
  }

  async findByQueryObject (queryObject, options = {}) {
    return _handleTransaction(
      async parser => {
        const statement = await parser.jsonToCypherRead(queryObject, { ...options, _sql: this.sqlMappings.read })
        return _handleParseRows(parser, this.client, statement, options)
      },
      'findByQueryObject',
      this.client,
      this.plugins
    )
  }

  async findOneByQueryObject (queryObject, options = {}) {
    return _handleTransaction(
      async parser => {
        const statement = await parser.jsonToCypherRead(queryObject, { ...options, _sql: this.sqlMappings.read })
        const result = await _handleParseRows(parser, this.client, statement, options)
        return result[0]
      },
      'findOneByQueryObject',
      this.client,
      this.plugins
    )
  }

  async findById (id, options = {}) {
    return _handleTransaction(
      async parser => {
        const statement = {
          query: 'MATCH (v1) WHERE id(v1) = $1 WITH v1\nOPTIONAL MATCH(v1)- [r*0..] -> (v2)\n' + 'RETURN v1, r, v2',
          params: [id],
          rootKey: 'v1'
        }
        statement.query = parser.getFinalQuery({}, options, statement.query, ['v1', 'v2'])
        const result = await _handleParseRows(parser, this.client, statement, options)
        return result[0]
      },
      'findById',
      this.client,
      this.plugins
    )
  }

  async deleteByQueryObject (queryObject, options = {}) {
    return _handleTransaction(
      async parser => {
        const statement = await parser.jsonToCypherRead(queryObject, options)
        const nodeIds = []
        const konektoIds = {}
        const sqlMappings = this.sqlMappings.delete
        parser.on('read', node => {
          nodeIds.push(`id(v) = '${node._id}'`)
          if (sqlMappings) {
            const mapping = sqlMappings[node._label].table
            if (!konektoIds[mapping]) {
              konektoIds[mapping] = []
            }
            konektoIds[mapping].push(`konekto_id = '${node.konekto_id}'`)
          }
        })
        const result = await _handleParseRows(parser, this.client, statement, options)
        if (result.length) {
          const sqlQuery = Object.entries(konektoIds)
            .map(([table, ids]) => `DELETE FROM ${table} WHERE ${ids.join(' OR ')}`)
            .join('\n')
          await Promise.all([
            this.client.query(`MATCH (v) WHERE ${nodeIds.join(' OR ')} DETACH DELETE v`),
            this.client.query(sqlQuery)
          ])
        }
        return result
      },
      'deleteByQueryObject',
      this.client,
      this.plugins
    )
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
    })
  }

  async deleteRelationships (queryObject) {
    return _handleTransaction(
      async parser => {
        const statement = await parser.jsonToCypherRelationshipDelete(queryObject)
        return this.client.query(statement.query, statement.params)
      },
      'deleteRelationships',
      this.client,
      this.plugins
    )
  }

  async createGraph (graphName) {
    await this.client.query(`CREATE GRAPH IF NOT EXISTS ${graphName}`)
  }

  async setGraph (graphName) {
    await this.client.query(`SET graph_path = ${graphName}`)
  }

  disconnect () {
    return this.client.end()
  }
}

module.exports = Konekto
