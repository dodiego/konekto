import { EventEmitter } from 'events'
import { getIndexesPerNode, getNodesAndRelationships, id, validateLabel } from './query_utils'
import { handleSql } from './sql_utils'
import { queryObjectToCypher, getFinalQuery, handleColumn } from './common_utils'

export class Parser extends EventEmitter {
  async jsonToCypherWrite (json, options: any = {}) {
    const graph = getNodesAndRelationships(json, options)
    const params = [graph.root]
    const indexesPerNode = getIndexesPerNode(graph.nodes)
    const queries = []
    const variables = new Set(['v1'])
    const sqlQueryParts = []

    validateLabel(graph.root._label)

    if (options.hooks && options.hooks.beforeSave) {
      if (!(await options.hooks.beforeSave(graph.root, graph.rootObject))) {
        throw new Error(`beforeSave hook didn't return truthy value for node ${JSON.stringify(graph.root, null, 2)}`)
      }
    }
    handleSql(graph.root, options.sqlProjections, sqlQueryParts)
    graph.root._id = graph.root._id || graph.root[id]
    this.emit('save', graph.root, graph.rootObject)
    queries.push(
      `MERGE (v1:${graph.root._label} {_id: '${graph.root._id}' }) ON MATCH SET v1 += $1 ON CREATE SET v1 += $1`
    )
    queries.push(
      ...(await Promise.all(
        graph.relationships.map(async (r, rIndex) => {
          const query = []
          const fromIndex = indexesPerNode[r.from]
          const toIndex = indexesPerNode[r.to]
          validateLabel(graph.nodes[r.to]._label)
          params[toIndex - 1] = graph.nodes[r.to]
          handleSql(graph.nodes[r.to], options.sqlProjections, sqlQueryParts)
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
          variables.add(`v${fromIndex}`)
          variables.add(`r${rIndex}`)
          if (!variables.has(`v${toIndex}`)) {
            query.push(
              `MERGE (v${toIndex}:${graph.nodes[r.to]._label} {_id: '${
                graph.nodes[r.to]._id
              }'}) ON MATCH SET v${toIndex} += $${toIndex} ON CREATE SET v${toIndex} += $${toIndex}`
            )
          }
          query.push(
            `MERGE (v${fromIndex})-[r${rIndex}:${r.name}${JSON.stringify(r.metadata).replace(
              /"/g,
              "'"
            )}]->(v${toIndex})`
          )
          return query.join('\n')
        })
      ))
    )
    return {
      cypher: {
        rootKey: 'v1',
        query: queries.join('\n'),
        params,
        graph
      },
      sql: sqlQueryParts.reduce(
        (result, current) => {
          result.query += `${current.query}\n`
          result.params.push(...current.params)
          return result
        },
        { query: '', params: [] }
      )
    }
  }

  getFinalQuery (nodes, cypher, options) {
    return getFinalQuery(nodes, cypher, options)
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
    const nodeLabels = [...new Set(Object.values(nodes).map((n: any) => n._label))]
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
          if (key !== '_id' && value) {
            nodesPerKonektoId[row._id][key] = value
          }
        }
      }
    }
    if (Object.keys(relationships).length !== 0) {
      for (const rel of Object.values<any>(relationships)) {
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
