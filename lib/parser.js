const { EventEmitter } = require('events')
const { getIndexesPerNode, getNodesAndRelationships, id, validateLabel } = require('./query_utils')
const { handleSql } = require('./sql_utils')
const { queryObjectToCypher, getFinalQuery, handleColumn } = require('./common_utils')
module.exports = {
  Parser: class extends EventEmitter {
    async jsonToCypherWrite (json, options = {}) {
      const graph = getNodesAndRelationships(json)
      const params = [graph.root]
      const indexesPerNode = getIndexesPerNode(graph.nodes)
      const queries = []
      const variables = new Set(['v1'])
      const sqlQuery = []
      const sqlParams = []

      validateLabel(graph.root._label)

      if (options.hooks && options.hooks.beforeSave) {
        if (!(await options.hooks.beforeSave(graph.root, graph.rootObject))) {
          throw new Error(`beforeSave hook didn't return truthy value for node ${JSON.stringify(graph.root, null, 2)}`)
        }
      }
      handleSql(options, graph.root, sqlQuery, sqlParams)
      graph.root._id = graph.root._id || graph.root[id]
      this.emit('save', graph.root, graph.rootObject)
      queries.push(
        `MERGE (v1:${graph.root._label} {_id: '${graph.root._id}' }) ON MATCH SET v1 = $1 ON CREATE SET v1 = $1`
      )
      await Promise.all(
        graph.relationships.map(async (r, rIndex) => {
          const fromIndex = indexesPerNode[r.from]
          const toIndex = indexesPerNode[r.to]
          validateLabel(graph.nodes[r.to]._label)
          params[toIndex - 1] = graph.nodes[r.to]
          variables.add(`v${fromIndex}`)
          variables.add(`r${rIndex}`)
          handleSql(options, graph.nodes[r.to], sqlQuery, sqlParams)
          graph.nodes[r.to]._id = graph.nodes[r.to]._id || graph.nodes[r.to][id]
          if (options.hooks && options.hooks.beforeSave) {
            const ok = await options.hooks.beforeSave(graph.nodes[r.to], graph.objects[r.to])
            if (!ok) {
              throw new Error(
                `beforeSave hook didn't return truthy value for node ${JSON.stringify(graph.nodes[r.to], null, 2)}`
              )
            }
          }
          this.emit('save', graph.nodes[r.to], graph.objects[r.to])
          if (!variables.has(`v${toIndex}`)) {
            queries.push(
              `MERGE (v${toIndex}:${graph.nodes[r.to]._label} {_id: '${
                graph.nodes[r.to]._id
              }'}) ON MATCH SET v${toIndex} = $${toIndex} ON CREATE SET v${toIndex} = $${toIndex}`
            )
          }
          queries.push(
            `MERGE (v${fromIndex})-[r${rIndex}:${r.name}${JSON.stringify(r.metadata).replace(
              /"/g,
              "'"
            )}]->(v${toIndex})`
          )
        })
      )
      return {
        cypher: {
          rootKey: 'v1',
          query: queries.join('\n'),
          params,
          graph
        },
        sql: {
          query: sqlQuery.join('\n'),
          params: sqlParams
        }
      }
    }

    getFinalQuery (queryObject, options, cypher, nodes) {
      return getFinalQuery(options, cypher, nodes)
    }

    async jsonToCypherRead (json, options) {
      return queryObjectToCypher(json, options, this, () => 'RETURN *')
    }

    async jsonToCypherDelete (json, options) {
      return queryObjectToCypher(json, options, this, variables => {
        const nodes = [...variables].filter(v => v.startsWith('v'))
        return `DETACH DELETE ${nodes.join(',')} WITH ${nodes.join(',')} RETURN *`
      })
    }

    async jsonToCypherRelationshipDelete (json, options) {
      return queryObjectToCypher(json, options, this, variables => {
        const relationships = [...variables].filter(v => v.startsWith('r'))
        return `DELETE ${relationships.join(',')}`
      })
    }

    getSchema (json) {
      const { nodes, relationships } = getNodesAndRelationships(json)
      const relationshipNames = relationships.filter(r => r.name).map(r => r.name)
      const nodeLabels = [...new Set(Object.values(nodes).map(n => n._label))]
      return {
        relationshipNames,
        nodeLabels
      }
    }

    async parseRows (rows, rootKey, options = {}) {
      const relationships = {}
      const nodes = {}
      const nodesPerKonektoId = {}
      const roots = {}
      for (const row of rows[0].cypher_info) {
        if (row[rootKey]) {
          const root = row[rootKey].properties
          root[id] = row[rootKey].id
          roots[root[id]] = true
        }
        await Promise.all(
          Object.values(row).map(async column => {
            if (column) {
              if (Array.isArray(column)) {
                for (const item of column) {
                  const node = await handleColumn(item, nodes, nodesPerKonektoId, relationships, options)
                  if (node) {
                    this.emit('read', node)
                  }
                }
              } else {
                const node = await handleColumn(column, nodes, nodesPerKonektoId, relationships, options)
                if (node) {
                  this.emit('read', node)
                }
              }
            }
          })
        )
      }
      if (rows[0].sql_info) {
        for (const row of rows[0].sql_info) {
          for (const [key, value] of Object.entries(row)) {
            if (key !== '_id') {
              nodesPerKonektoId[row._id][key] = value
            }
          }
        }
      }
      if (Object.keys(relationships).length !== 0) {
        for (const rel of Object.values(relationships)) {
          const value = nodes[rel.from][rel.metadata._label]
          if (!nodes[rel.to]) {
            continue
          }
          if (value && !Array.isArray(value)) {
            nodes[rel.from][rel.metadata._label] = [value, nodes[rel.to]]
            continue
          }
          if (value && Array.isArray(value)) {
            nodes[rel.from][rel.metadata._label].push(nodes[rel.to])
            continue
          }
          if (!value && rel.metadata && rel.metadata.is_array) {
            nodes[rel.from][rel.metadata._label] = [nodes[rel.to]]
            continue
          }
          if (!value && rel.metadata && !rel.metadata.is_array) {
            nodes[rel.from][rel.metadata._label] = nodes[rel.to]
            continue
          }
        }
      }
      for (const node of Object.values(nodes)) {
        delete node[id]
      }
      const result = Object.keys(roots).map(k => nodes[k])
      this.emit('readFinish')
      return result
    }
  }
}
