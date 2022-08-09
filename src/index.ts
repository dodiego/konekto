type JsonPrimitive = string | number | boolean | null
type PlainJson = {
  [key: string]: JsonPrimitive
}

export function plainJsonToCypherVertex(identifier: string, plainJson: PlainJson) {
  const cypherParts = Object.entries(plainJson).reduce((cypherParts, [jsonKey, jsonValue]) => {
    if (typeof jsonValue === 'string') {
      cypherParts.push(`${jsonKey}: '${jsonValue}'`)
    } else {
      cypherParts.push(`${jsonKey}: ${jsonValue}`)
    }

    return cypherParts
  }, [])

  return `(${identifier} { ${cypherParts.join(', ')} })`
}

const isJsonObject = value => !!value && typeof value === 'object' && !Array.isArray(value)
const isPrimitive = value =>
  typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string' || value === null
function planifyJson(json) {
  return Object.entries(json)
    .filter(([_key, value]) => isPrimitive(value))
    .reduce((planifiedJson, [key, value]) => {
      planifiedJson[key] = value
      return planifiedJson
    }, {})
}

function jsonToCypherGraph(json, depth = 1) {
  /**
   * iterate json entries
   * for each entry, if entry is a json, create a path and push item to stack
   * for each entry, if entry is an array, check each item of array, if all items are json items, then create a path to each items and push them to stack
   * after all entries are processed, iterate each item of stack and initiate recursion
   */
  const rootVertex = plainJsonToCypherVertex('root', planifyJson(json))
  const cypherParts = [rootVertex]
  const childVertexes = []
  for (const [key, value] of Object.entries(json)) {
    if (isJsonObject(value)) {
      cypherParts.push(`-[${key}]->`, plainJsonToCypherVertex(`root_${key}_${depth}`, planifyJson(value)))
      childVertexes.push(value)
    }
  }
}
