const flatten = require('@flatten/array')

function getSegments(result) {
  // neo4j objects comes from the "_fields" property in each item of the "records" array
  let fields = flatten(result.records.map(s => s._fields))
  // segments stores the relationship between objects in each row
  return flatten(fields.map(s => s.segments))

}

function segmentsToJson(segments) {
  let related = {}
  let nodes = segments.reduce((result, segment) => {
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
    return result
  }, {})

  return Object.values(nodes).filter(node => !related[node.uuid])
}

function readStamentResultToJson (result) {

  let segments = getSegments(result)
  let json = segmentsToJson(segments)
  return json
}

module.exports = readStamentResultToJson
