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
  for (let i = 0, fieldsLength = rows.length; i < fieldsLength; i++) {
    let row = rows[i]
    for (let item of row) {
      if (item.segments.length) {
        for (let j = 0, segmentsLength = item.segments.length; j < segmentsLength; j++) {
          let segment = item.segments[j]
          if (!result[segment.start.properties.uuid]) {
            result[segment.start.properties.uuid] = segment.start.properties
          }

          if (!result[segment.end.properties.uuid]) {
            result[segment.end.properties.uuid] = segment.end.properties
          }

          if (segment.relationship.properties.isArray) {
            if (!result[segment.start.properties.uuid][segment.relationship.type]) {
              result[segment.start.properties.uuid][segment.relationship.type] = []
            }

            result[segment.start.properties.uuid][segment.relationship.type].push(result[segment.end.properties.uuid])
          } else {
            result[segment.start.properties.uuid][segment.relationship.type] = result[segment.end.properties.uuid]
          }

          related[segment.end.properties.uuid] = segment.end.properties
        }
      } else {
        if (!result[item.start.properties.uuid]) {
          result[item.start.properties.uuid] = item.start.properties
        }
      }
    }
  }
  if (!removeDuplicates) {
    return Object.values(result)
  }
  return Object.values(result).filter(node => !related[node.uuid])
}

function readStamentResultToJson (result, removeDuplicates = true) {
  let rows = getRows(result)
  let json = rowsToJson(rows, removeDuplicates)
  return json
}

module.exports = readStamentResultToJson