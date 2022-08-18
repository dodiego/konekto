export const id = Symbol('id')
export const label = Symbol('label')
export const meta = Symbol('meta')

type JsonPrimitive = string | number | boolean | null
export type PlainJson = {
  [id]: string
  [label]: string
  [property: string]: JsonPrimitive
}
export type JsonGraph = PlainJson & {
  [property: string]: JsonPrimitive | JsonGraph | JsonGraph[]
}

type Graph = {
  vertexes: {
    [id: string]: PlainJson
  }
  edges: {
    [label]: string
    [meta]?: {
      isArray: boolean
    }
    sourceVertexId: string
    targetVertexId: string
  }[]
}
type CypherStatement = {
  query: string
  parameters: (PlainJson | { isArray: boolean })[]
  identifiers: {
    [name: string]: true
  }
}

const isJsonObject = value => !!value && typeof value === 'object' && !Array.isArray(value)
const isPrimitive = value =>
  typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string' || value === null

function planifyJson(json): PlainJson {
  const planifiedJson = Object.entries(json)
    .filter(([_key, value]) => isPrimitive(value))
    .reduce((planifiedJson, [key, value]: [string, JsonPrimitive]) => {
      planifiedJson[key] = value
      return planifiedJson
    }, {} as PlainJson)

  planifiedJson[id] = json[id]
  planifiedJson[label] = json[label]

  return planifiedJson
}

function _transformJsonIntoGraph(json: JsonGraph, carrierGraph: Graph = { edges: [], vertexes: {} }): Graph {
  if (!carrierGraph.vertexes[json[id]]) {
    carrierGraph.vertexes[json[id]] = {
      ...planifyJson(json),
      [id]: json[id],
      [label]: json[label]
    }

    for (const [key, value] of Object.entries(json)) {
      if (Array.isArray(value)) {
        value.forEach(item => {
          const itemId = item[id]
          _transformJsonIntoGraph(item, carrierGraph)
          carrierGraph.edges.push({
            [label]: key,
            [meta]: {
              isArray: true
            },
            sourceVertexId: json[id],
            targetVertexId: item[id]
          })
        })
        continue
      }
      if (isJsonObject(value)) {
        const valueId = value[id]
        _transformJsonIntoGraph(value as JsonGraph, carrierGraph)
        carrierGraph.edges.push({
          [label]: key,
          [meta]: {
            isArray: false
          },
          sourceVertexId: json[id],
          targetVertexId: valueId
        })
      }
    }
    return carrierGraph
  }
}
export function transformJsonIntoGraph(json: JsonGraph): Graph {
  return _transformJsonIntoGraph(json)
}

function _transformGraphIntoCypher(
  graph: Graph,
  carrierCypherStatement: CypherStatement = {
    query: '',
    parameters: [],
    identifiers: {}
  }
): CypherStatement {
  for (const [vertexId, vertex] of Object.entries(graph.vertexes)) {
    const vertexIdentifier = `vertex_${vertexId}`
    if (carrierCypherStatement.identifiers[vertexIdentifier]) {
      continue
    }
    carrierCypherStatement.identifiers[vertexIdentifier] = true
    carrierCypherStatement.parameters.push(vertex)
    carrierCypherStatement.query += `MERGE (${vertexIdentifier}:${vertex[label]} ?)\n`
  }
  for (const edge of graph.edges) {
    carrierCypherStatement.query += `MERGE (vertex_${edge.sourceVertexId})-[:${edge[label]} ?]->(vertex_${edge.targetVertexId})\n`
    carrierCypherStatement.parameters.push(edge[meta])
  }

  carrierCypherStatement.query = carrierCypherStatement.query.trim()
  return carrierCypherStatement
}

export function transformGraphIntoCypher(graph: Graph): CypherStatement {
  return _transformGraphIntoCypher(graph)
}

export function transformJsonIntoCypher(json: JsonGraph): CypherStatement {
  const graph = transformJsonIntoGraph(json)
  const cypherStatement = transformGraphIntoCypher(graph)

  return cypherStatement
}
