const Parser = require('./parser')
const { Client } = require('pg')

function _createSchema (json, client) {
  const parser = new Parser()
  const { relationshipNames, nodeLabels } = parser.getSchema(json)
  const clientQueries = []
  for (const vlabel of nodeLabels) {
    clientQueries.push(`CREATE VLABEL IF NOT EXISTS ${vlabel}`)
  }
  for (const elabel of relationshipNames) {
    clientQueries.push(`CREATE ELABEL IF NOT EXISTS ${elabel}`)
  }
  clientQueries.push(
    'CREATE TABLE IF NOT EXISTS public.geometries (node_id text PRIMARY KEY, label text, geom geometry NOT NULL)'
  )
  return client.query(clientQueries.join(';'))
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
  }

  connect () {
    return this.client.connect()
  }

  async createSchema (jsonOrArray) {
    if (Array.isArray(jsonOrArray)) {
      return Promise.all(jsonOrArray.map(json => _createSchema(json, this.client)))
    }
    return _createSchema(jsonOrArray, this.client)
  }

  async createEdge (label) {
    await this.client.query(`CREATE ELABEL ${label}`)
  }

  async raw (query, params, options) {
    const parser = new Parser()
    if (options && options.parseResult) {
      return parser.parseRows(await this.client.query(query, params), options.rootKey, options)
    }
    return this.client.query(query, params)
  }

  async save (json, options = {}) {
    const parser = new Parser()
    const statement = await parser.jsonToCypherWrite(json, options)
    const response = await this.client.query(statement.query, statement.params)
    await this.client.query('BEGIN')
    const promises = []
    parser.on('read', (node, object) => {
      if (object._wkt) {
        promises.push(
          this.client.query('INSERT INTO public.geometries VALUES ($1, $2, $3)', [node._id, node._label, object._wkt])
        )
      }
    })
    try {
      const result = (await parser.parseRows(response.rows, statement.rootKey, {
        ...options,
        graph: statement.graph
      }))[0]
      await Promise.all(promises)
      await this.client.query('COMMIT')
      return result
    } catch (error) {
      await this.client.query('ROLLBACK')
      throw error
    }
  }

  async findByQueryObject (queryObject, options = {}) {
    const parser = new Parser()
    const statement = parser.jsonToCypherRead(queryObject, options)
    const response = await this.client.query(statement.query, statement.params)
    const result = await parser.parseRows(response.rows, statement.rootKey, options)

    return result
  }

  async findOneByQueryObject (queryObject, options = {}) {
    const parser = new Parser()
    const statement = parser.jsonToCypherRead(queryObject, options)
    const response = await this.client.query(statement.query, statement.params)
    return (await parser.parseRows(response.rows, statement.rootKey, options))[0]
  }

  async findById (id, options) {
    const parser = new Parser()
    const statement = {
      query:
        'MATCH (v1) WHERE id(v1) = $1 WITH v1\nOPTIONAL MATCH(v1)- [r*0..] -> (v2)\n' +
        'RETURN v1, r, v2,\n' +
        "(SELECT json_agg(json_build_object('geom', ST_AsText(geom), 'label', label, 'node_id', node_id ))\n" +
        'FROM public.geometries\n' +
        'WHERE node_id IN (id(v1)::text, id(v2)::text)) as geom',
      params: [id]
    }
    const response = await this.client.query(statement.query, statement.params)
    const result = (await parser.parseRows(response.rows, 'v1', options))[0]
    return result
  }

  async deleteByQueryObject (queryObject, options = {}) {
    const parser = new Parser()
    const statement = await parser.jsonToCypherRead(queryObject, options)
    const response = await this.client.query(statement.query, statement.params)
    const nodeIds = []
    parser.on('read', (node, object) => {
      nodeIds.push(node._id)
    })
    try {
      const result = await parser.parseRows(response.rows, statement.rootKey, {
        ...options,
        graph: statement.graph
      })
      if (!result.length) {
        return []
      }
      await this.client.query('BEGIN')
      await Promise.all([
        this.client.query(`MATCH (v) WHERE ${nodeIds.map(id => `id(v) = '${id}'`).join(' OR ')} DETACH DELETE v`),
        this.client.query(`DELETE FROM public.geometries WHERE node_id IN (${nodeIds.map(n => `'${n}'`).join(',')})`)
      ])
      await this.client.query('COMMIT')
      return result
    } catch (error) {
      await this.client.query('ROLLBACK')
      throw error
    }
  }

  async deleteById (id) {
    const statement = {
      query: 'MATCH (a) WHERE id(a) = $1 WITH a\nOPTIONAL MATCH (a)-[r*0..]->(b)\nDETACH DELETE a, b',
      params: [id]
    }
    await this.client.query(statement.query, statement.params)
    return true
  }

  async deleteRelationships (queryObject) {
    const parser = new Parser()
    const statement = parser.jsonToCypherRelationshipDelete(queryObject)
    await this.client.query(statement.query, statement.params)
    return true
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
