import { id } from './query_utils'

export function getWhereSql(params, json, variableName) {
  if (json._sqlWhere) {
    return json._sqlWhere.filter
      .replace(/this\./g, `${variableName}.`)
      .replace(/\s+:(\w+)\b/g, (_a, b) => `$${params.push(json._sqlWhere.params[b])}`)
  }
  return ''
}

function mapProperties(node: any, customProjection: PropertyMap = {}) {
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
          values.push(`${propertyMapping.writeProjection.replace(/\bthis\b/g, `$${paramIndex.toString()}`)}`)
        } else {
          values.push(`$${paramIndex}`)
        }
        delete node[key]
      }
    }
    if (values.length) {
      columns.push('_id')
      values.push(`$${params.push(node[id])}`)
    }
  }
  return { params, columns, values }
}

function sqlInsert(node: any, customProjection: PropertyMap) {
  const { params, columns, values } = mapProperties(node, customProjection)

  if (columns.length) {
    return {
      query: `INSERT INTO ${customProjection[node._label].table} (${columns.join(', ')}) VALUES (${values.join(', ')})`,
      params
    }
  }
}

function sqlUpdate(node: any, customProjection: PropertyMap) {
  const { params, columns, values } = mapProperties(node, customProjection)

  if (columns.length) {
    return {
      query: `UPDATE ${customProjection[node._label].table} SET ${columns.map((c, i) => `${c} = $${values[i]}`)}`,
      params
    }
  }
}

export function handleSql(node: any, customProjection: PropertyMap, sqlQueryParts) {
  const result = node._id ? sqlUpdate(node, customProjection) : sqlInsert(node, customProjection)
  if (result) {
    sqlQueryParts.push(result)
  }
}
