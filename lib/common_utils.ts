import { getOrderCypher, getWhereCypher, getPaginationCypher, getWith } from './graph_utils'
import { getWhereSql } from './sql_utils'
import { getIndexesPerNode, getNodesAndRelationships, queryKeys, id } from './query_utils'
async function getMatchSufix(json, variable, queryEnd) {
  const query = []
  const params = []
  const where = []
  const cypherWhere = await getWhereCypher(params, json, variable)
  const sqlWhereQuery = getWhereSql(params, json, variable)
  const orderQuery = getOrderCypher(json, variable)
  const paginationQuery = getPaginationCypher(json, params)
  if (cypherWhere) {
    where.push(cypherWhere)
  }
  if (sqlWhereQuery) {
    if (where.length) {
      where.push(' AND ')
    }
    where.push(
      `(SELECT count(_id) FROM ${json._sqlWhere.table} WHERE _id = ${variable}->>'_id' AND ${sqlWhereQuery}) > 0`
    )
  }
  if (where.length) {
    where.unshift('WHERE')
    query.push(where.join(' '))
  }
  query.push(queryEnd)
  if (orderQuery) {
    query.push(orderQuery)
  }
  if (paginationQuery) {
    query.push(paginationQuery)
  }

  return {
    query: query.join(' '),
    params
  }
}

export function getFinalQuery(nodes, cypher, options) {
  const selectPart = ['json_agg(cypher.*) as cypher_info']
  const joinPart = []
  const joinFilter = nodes.map(n => `_id = cypher.${n}->>'_id'`).join(' OR ')
  let sqlProjections = {}
  if (options.sqlProjections) {
    Object.values(options.sqlProjections as PropertyMap).forEach(
      ({ table, mappings }) =>
        (sqlProjections[table] = Object.entries(mappings).reduce((result, [property, mapping]) => {
          result[property] = mapping.columnName
          return result
        }, {}))
    )
  }

  if (options.customSqlProjections) {
    Object.entries(options.customSqlProjections).forEach(([table, mapping]) => {
      Object.entries(mapping).forEach(([key, value]) => {
        sqlProjections[table] = sqlProjections[table] || {}
        sqlProjections[table][key] = value
      })
    })
  }

  const sqlColumns = []
  for (const [table, projections] of Object.entries(sqlProjections)) {
    sqlColumns.push(`'_id', ${table}._id`)
    for (const [property, projection] of Object.entries(projections)) {
      sqlColumns.push(`'${property}', ${projection.replace(/this\.(\w+)/g, `${table}.$1`)}`)
    }
    joinPart.push(`LEFT JOIN ${table} ON (${joinFilter})`)
  }
  selectPart.push(`json_agg(json_build_object(${sqlColumns.join(', ')})) as sql_info`)
  return `SELECT ${selectPart.join(', ')} FROM (${cypher}) as cypher ${joinPart.join(' ')}`
}

export async function queryObjectToCypher(queryObject, options, eventEmitter, getQueryEnd) {
  const { nodes, relationships, root } = getNodesAndRelationships(queryObject, options)
  if (options.hooks && options.hooks.beforeParseNode) {
    await options.hooks.beforeParseNode(root)
  }
  if (!relationships.length) {
    const rootMatchSufix = await getMatchSufix(root, 'v1', getQueryEnd(new Set(['v1'])))
    const statement = {
      query: `MATCH (v1) ${rootMatchSufix.query}`,
      params: rootMatchSufix.params,
      rootKey: 'v1'
    }
    statement.query = getFinalQuery(['v1'], statement.query, options)
    return statement
  }

  const indexesPerNode = getIndexesPerNode(nodes)
  const statements = []
  const variables = new Set(['v1'])
  const rootMatchSufix = await getMatchSufix(root, 'v1', getWith(variables))
  const rootStatement = {
    query: `MATCH (v1) ${rootMatchSufix.query}`,
    params: rootMatchSufix.params,
    rootKey: 'v1'
  }
  eventEmitter.emit('queryBuildRoot', rootStatement, ['v1'])
  statements.push(rootStatement)
  await Promise.all(
    relationships.map(async (r, rIndex) => {
      const toNode = nodes[r.to]
      const fromIndex = indexesPerNode[r.from]
      const toIndex = indexesPerNode[r.to]
      variables.add(`v${fromIndex}`)
      variables.add(`r${rIndex}`)
      variables.add(`v${toIndex}`)
      if (options.hooks && options.hooks.beforeParseNode) {
        await options.hooks.beforeParseNode(toNode)
      }
      const relationshipMatchSufix = await getMatchSufix(toNode, `v${toIndex}`, getWith(variables))
      const relationshipStatement = {
        query: `MATCH (v${fromIndex})-[r${rIndex}:${r.name}]->(v${toIndex}) ${relationshipMatchSufix.query}`,
        params: relationshipMatchSufix.params
      }
      if (Object.keys(queryKeys).some(k => toNode[k])) {
        toNode.mandatory = true
      }
      if (!toNode.mandatory) {
        relationshipStatement.query = `OPTIONAL ${relationshipStatement.query}`
      }
      eventEmitter.emit('queryBuildRelationship', relationshipStatement, [`v${toIndex}`, `r${rIndex}`, `v${fromIndex}`])
      statements.push(relationshipStatement)
    })
  )
  statements.push({ query: getQueryEnd(variables), params: [] })
  const finalStatement = statements.reduce(
    (result, statement) => {
      result.query += `\n${statement.query}`
      result.params.push(...statement.params)
      return result
    },
    { query: '', params: [], rootKey: 'v1' }
  )
  finalStatement.query = getFinalQuery(
    [...variables].filter(v => v.startsWith('v')),
    finalStatement.query,
    options
  )
  eventEmitter.emit('queryBuildEnd', finalStatement, [...variables])
  return finalStatement
}

export async function handleColumn(column, nodes, nodesPerKonektoId, relationships, options) {
  const item = parseColumn(column)
  if (item.isRelationship) {
    relationships[item.value[id]] = item.value
  } else {
    const node = item.value
    const object = options.graph && options.graph.objects[node._id]
    if (options.hooks && options.hooks.beforeRead) {
      if (!(await options.hooks.beforeRead(node, object))) {
        return
      }
    }
    nodes[node[id]] = node
    nodesPerKonektoId[node._id] = node
    return node
  }
}

function parseColumn(column) {
  if (column.start && column.end) {
    return {
      isRelationship: true,
      value: {
        [id]: column.id,
        from: column.start,
        to: column.end,
        metadata: column.properties
      }
    }
  }
  const node = column.properties
  node[id] = column.id
  return {
    isNode: true,
    value: node
  }
}
