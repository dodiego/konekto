const Parser = require('./parser')
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
  parser.emit('beforeQuery', statement)
  const result = await client.query(statement.query, statement.params)
  parser.emit('afterQuery', result)
  return result
}

async function _notifyPlugins (plugins, parser, client, event) {
  await Promise.all(plugins.map(plugin => plugin[event](parser, client)))
}

async function _handleTransaction (fn, event, client, plugins) {
  const parser = new Parser()
  try {
    await client.query('BEGIN')
    await _notifyPlugins(plugins, parser, client, event)
    const result = await fn(parser)
    await _notifyPlugins(plugins, parser, client, event)
    return result
  } catch (error) {
    client.query('ROLLBACK')
    throw error
  }
}

async function _handleParseRows (parser, client, statement, options) {
  const response = await _runQuery(client, parser, statement)
  if (!response.rows.length) {
    return []
  }
  const result = new Promise(resolve => parser.on('afterParseRows', resolve))
  await parser.parseRows(response.rows, statement.rootKey, {
    ...options,
    graph: statement.graph
  })
  return result
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
  }

  connect () {
    return this.client.connect()
  }

  use (plugin) {
    this.plugins.push(plugin)
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

  async raw ({ query, params }, options) {
    return _handleTransaction(
      async parser => {
        const rows = await _runQuery(this.client, parser, { query, params })
        if (options && options.parseResult) {
          return parser.parseRows(rows, options.rootKey, options)
        }
        return rows
      },
      'raw',
      this.client,
      this.plugins
    )
  }

  async save (json, options = {}) {
    return _handleTransaction(
      async parser => {
        const statement = await parser.jsonToCypherWrite(json, options)
        const result = await _handleParseRows(parser, this.client, statement, options)
        return result[0]
      },
      'save',
      this.client,
      this.plugins
    )
  }

  async findByQueryObject (queryObject, options = {}) {
    return _handleTransaction(
      async parser => {
        const statement = parser.jsonToCypherRead(queryObject, options)
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
        const statement = parser.jsonToCypherRead(queryObject, options)

        const result = await _handleParseRows(parser, this.client, statement, options)
        return result[0]
      },
      'findOneByQueryObject',
      this.client,
      this.plugins
    )
  }

  async findById (id, options) {
    return _handleTransaction(
      async parser => {
        const statement = {
          query: 'MATCH (v1) WHERE id(v1) = $1 WITH v1\nOPTIONAL MATCH(v1)- [r*0..] -> (v2)\n' + 'RETURN v1, r, v2',
          params: [id],
          rootKey: 'v1'
        }
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
        parser.on('read', node => nodeIds.push(node._id))
        const result = await _handleParseRows(parser, this.client, statement, options)
        if (result.length) {
          await this.client.query(
            `MATCH (v) WHERE ${nodeIds.map(id => `id(v) = '${id}'`).join(' OR ')} DETACH DELETE v`
          )
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
        const statement = parser.jsonToCypherRelationshipDelete(queryObject)
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
