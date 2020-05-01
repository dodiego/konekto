import { PropertyMap } from './types'

export function getWhereSql(params, json, variableName) {
  if (json._sqlWhere) {
    return json._sqlWhere.filter
      .replace(/this\./g, `${variableName}.`)
      .replace(/\s+(\$params\.)(\w+)/g, (_a, _b, c) => `$${params.push(json._sqlWhere.params[c])}`)
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
      values.push(`$${params.push(node._id)}`)
    }
  }
  return { params, columns, values }
}

export function handleSql(node: any, customProjection: PropertyMap, sqlQueryParts) {
  const { params, columns, values } = mapProperties(node, customProjection)

  if (columns.length) {
    sqlQueryParts.push({
      query: `INSERT INTO ${customProjection[node._label].table} (${columns.join(', ')})
      VALUES (${values.join(', ')})
      ON CONFLICT ON CONSTRAINT ${customProjection[node._label].table}_pkey DO
      UPDATE SET ${columns.map((c, i) => `${c} = ${values[i]}`)}
      WHERE ${customProjection[node._label].table}._id = '${node._id}'`,
      params
    })
  }
}
