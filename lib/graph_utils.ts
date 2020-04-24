export async function getWhereCypher (params, json, variableName) {
  const whereQuery = []
  if (json._label) {
    let whereLabels
    if (typeof json._label === 'string') {
      whereLabels = [json._label]
    } else {
      whereLabels = json._label
    }
    whereLabels = whereLabels.map(l => `label(${variableName}) = '${l}'`).join(' OR ')
    whereQuery.push(whereLabels)
  }
  if (json._where) {
    if (json._label) {
      whereQuery.push('AND')
    }
    whereQuery.push(
      `${json._where.filter.replace(/this\./g, `${variableName}.`).replace(/\s+:(\w+)\b/g, (_a, b) => {
        if (typeof json._where.params[b] === 'string') {
          return `$${params.push(`"${json._where.params[b]}"`)}`
        } else {
          return `$${params.push(json._where.params[b])}`
        }
      })}`
    )
  }
  if (whereQuery.length > 0) {
    return whereQuery.join(' ')
  }
  return ''
}

export function getOrderCypher (json, variable) {
  if (json._order) {
    let orderBy
    if (typeof json._order === 'string') {
      orderBy = [json._order]
    } else {
      orderBy = json._order
    }
    const cypherOrder = orderBy
      .map(o => (o.startsWith('!') ? `${variable}.${o.slice(1)} DESC` : `${variable}.${o} ASC`))
      .join(', ')
    return `ORDER BY ${cypherOrder}`
  }
  return ''
}

export function getPaginationCypher (json, params) {
  const query = []
  if (json._skip > 0) {
    const paramIndex = params.push(json._skip)
    query.push(`SKIP $${paramIndex}`)
  }
  if (json._limit > 0) {
    const paramIndex = params.push(json._limit)
    query.push(`LIMIT $${paramIndex}`)
  }
  return query.join(' ')
}

export function getWith (variables) {
  return `WITH ${[...variables].join(', ')}`
}

