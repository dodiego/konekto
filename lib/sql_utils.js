const { id } = require('./query_utils')

function getWhereSql (params, json, variableName) {
  if (json._sqlWhere) {
    return json._sqlWhere.filter
      .replace(/\{\{\}\}/g, variableName)
      .replace(/\s+:(\w+)\b/g, (_a, b) => `$${params.push(json._sqlWhere.params[b])}`)
  }
  return ''
}

/**
 *
 * @param {any} node
 * @param {import('../@types').PropertyMap} customProjection
 */
function mapProperties (node, customProjection = {}) {
  const params = []
  const columns = []
  const values = []
  const mapping = customProjection[node._label]
  if (mapping) {
    for (const [key, value] of Object.entries(node)) {
      const propertyMapping = mapping.mappings && mapping.mappings[key]
      if (propertyMapping) {
        const paramIndex = params.push(value)
        columns.push(propertyMapping.columnName)
        if (propertyMapping.writeProjection) {
          values.push(`${propertyMapping.writeProjection.replace(/\{\{\}\}/g, `${paramIndex.toString()}`)}`)
        } else {
          values.push(`$${paramIndex}`)
        }
      }
    }
    if (values.length) {
      columns.push('_id')
      values.push(`$${params.push(node[id])}`)
    }
  }
  return { params, columns, values }
}

/**
 *
 * @param {any} node
 * @param {import('../@types').PropertyMap} customProjection
 */
function sqlInsert (node, customProjection) {
  const { params, columns, values } = mapProperties(node, customProjection)

  if (columns.length) {
    return {
      query: `INSERT INTO ${customProjection[node._label].table} (${columns.join(', ')}) VALUES (${values.join(', ')})`,
      params
    }
  }
}

/**
 *
 * @param {any} node
 * @param {import('../@types').PropertyMap} customProjection
 */
function sqlUpdate (node, customProjection) {
  const { params, columns, values } = mapProperties(node, customProjection)

  if (columns.length) {
    return {
      query: `UPDATE ${customProjection[node._label].table} SET ${columns.map((c, i) => `${c} = $${values[i]}`)}`,
      params
    }
  }
}

/**
 *
 * @param {any} node
 * @param {import('../@types').PropertyMap} customProjection
 */
function handleSql (node, customProjection, sqlQueryParts) {
  const result = node._id ? sqlUpdate(node, customProjection) : sqlInsert(node, customProjection)
  if (result) {
    sqlQueryParts.push(result)
  }
}

module.exports = {
  getWhereSql,
  handleSql
}
