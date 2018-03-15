function getFields (result) {
  let fields = []
  for (let i = 0, resultLength = result.records.length; i < resultLength; i++) {
    let item = result.records[i]
    for (let j = 0, rowFieldsLength = item._fields.length; j < rowFieldsLength; j++) {
      let field = item._fields[j]
      if (field) {
        fields.push(field)
      }
    }
  }
  return fields
}

function fieldsToJson(fields) {
  let result = {}
  let related = {}
  for (let i = 0, fieldsLength = fields.length; i < fieldsLength; i++) {
    let row = fields[i]

    if (row.segments.length) {
      for (let j = 0, segmentsLength = row.segments.length; j < segmentsLength; j++) {
        let segment = row.segments[j]
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
      if (!result[row.start.properties.uuid]) {
        result[row.start.properties.uuid] = row.start.properties
      }
    }

  }

  return Object.values(result).filter(node => !related[node.uuid])
}

function readStamentResultToJson (result) {

  let fields = getFields(result)
  let json = fieldsToJson(fields)
  return json
}

module.exports = readStamentResultToJson
