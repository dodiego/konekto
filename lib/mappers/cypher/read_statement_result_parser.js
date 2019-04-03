function getRows(result) {
  let queryResult = []
  let nodeRegex = /(?<label>\w+)\[(?<id>[\d.]+)\](?<node>\{.+\})/
  let relationshipRegex = /(?<label>\w+)\[(?<id>[\d.]+)\]\[(?<from>[\d.]+),(?<to>[\d.]+)\](?<attrs>\{.+\})/
  for (const item of result.rows) {
    let rowRels = []
    let rowNodes = {}
    for (const column of Object.values(item)) {
      let result = nodeRegex.exec(column) || relationshipRegex.exec(column)
      if (result.groups.node) {
        rowNodes[result.groups.id] = JSON.parse(result.groups.node)
      } else {
        rowRels.push(result.groups)
      }
    }
    let json = {}
    if (rowRels.length) {
      for (const rel of rowRels) {
        json[rel.from] = rowNodes[rel.from]
        json[rel.from][rel.label] = rowNodes[rel.to]
      }
    } else {
      for (const [id, node] of Object.entries(rowNodes)) {
        json[id] = node
      }
    }
    queryResult.push(...Object.values(json))
  }
  return queryResult
}

function rowsToUuid(rows) {
  return Object.keys(
    rows.reduce((result, row) => {
      if (Array.isArray(row)) {
        for (let item of row) {
          for (let segment of item.segments) {
            result[segment.start.properties.uuid] = true
            result[segment.end.properties.uuid] = true
          }
        }
      } else {
        result[row.properties.uuid] = true
      }
      return result
    }, {})
  )
}

function readStatementResultToUuidArray(result) {
  let rows = getRows(result)
  return rowsToUuid(rows)
}

function readStamentResultToJson(result, options) {
  options = Object.assign({}, { removeDuplicates: false }, options)
  return getRows(result)
}

module.exports = {
  toJson: readStamentResultToJson,
  toUuidArray: readStatementResultToUuidArray
}
