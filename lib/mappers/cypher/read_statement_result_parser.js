function getRows (result) {
  let rows = []
  for (let i = 0, resultLength = result.records.length; i < resultLength; i++) {
    let item = result.records[i]
    for (let j = 0, rowFieldsLength = item._fields.length; j < rowFieldsLength; j++) {
      let row = item._fields[j]
      if (row) {
        rows.push(row)
      }
    }
  }
  return rows
}

function rowsToJson (rows, removeDuplicates) {
  let result = {}
  let related = {}
  for (let row of rows) {
    if (Array.isArray(row)) {
      for (let item of row) {
        for (let segment of item.segments) {
          if (!result[segment.start.properties.uuid]) {
            result[segment.start.properties.uuid] = segment.start.properties
            result[segment.start.properties.uuid]._label = segment.start.labels[0]
          }

          if (segment.relationship.properties.isArray) {
            if (!result[segment.start.properties.uuid][segment.relationship.type]) {
              result[segment.start.properties.uuid][segment.relationship.type] = []
            }

            result[segment.start.properties.uuid][segment.relationship.type].push(segment.end.properties)
          } else {
            result[segment.start.properties.uuid][segment.relationship.type] = segment.end.properties
          }

          related[segment.end.properties.uuid] = segment.end.properties
        }
      }
    } else {
      result[row.properties.uuid] = row.properties
      result[row.properties.uuid]._label = row.labels[0]
    }
  }
  if (!removeDuplicates) {
    return Object.values(result)
  }
  return Object.values(result).filter(node => !related[node.uuid])
}

function rowsToUuid (rows) {
  return Object.keys(rows.reduce((result, row) => {
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
  }, {}))
}

function readStatementResultToUuidArray (result) {
  let rows = getRows(result)
  return rowsToUuid(rows)
}

function readStamentResultToJson (result, options) {
  options = Object.assign({}, options, {removeDuplicates: false})
  let rows = getRows(result)
  return rowsToJson(rows, options.removeDuplicates)
}

module.exports = {
  toJson: readStamentResultToJson,
  toUuidArray: readStatementResultToUuidArray
}
