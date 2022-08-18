import { id, JsonGraph, label, transformJsonIntoCypher } from './index'
import casual from 'casual'

describe('Should be able to transform Json into Cypher Statement', () => {
  function createJson(): JsonGraph {
    return {
      [id]: casual.uuid,
      [label]: casual.word,
      numberProperty: casual.random
    }
  }

  it('json into merge statement with 1 vertex, 0 edges, 0 cycles', () => {
    const json = createJson()
    const cypherStatement = transformJsonIntoCypher(json)

    expect(cypherStatement.parameters).toStrictEqual([json])
    expect(cypherStatement.query).toBe(`MERGE (vertex_${json[id]}:${json[label]} ?)`)
  })
  it('json into merge statement with 1 vertex, 1 edge, 1 cycle', () => {
    const json: any = createJson()
    json.relationship = json

    const rootIdentifier = `vertex_${json[id]}`
    const cypherStatement = transformJsonIntoCypher(json)

    expect(cypherStatement.parameters).toStrictEqual([
      {
        [id]: json[id],
        [label]: json[label],
        numberProperty: json.numberProperty
      },
      { isArray: false }
    ])
    expect(cypherStatement.query).toBe(
      '' + // little hack to format multiline strings
        `MERGE (${rootIdentifier}:${json[label]} ?)\n` +
        `MERGE (${rootIdentifier})-[:relationship ?]->(${rootIdentifier})`
    )
  })
  it('json into merge statement with 1 vertex, n edges, n redundant cycles', () => {
    const json: any = createJson()
    json.relationship = json
    json.relationship2 = json

    const rootIdentifier = `vertex_${json[id]}`
    const cypherStatement = transformJsonIntoCypher(json)

    expect(cypherStatement.parameters).toStrictEqual([
      {
        [id]: json[id],
        [label]: json[label],
        numberProperty: json.numberProperty
      },
      { isArray: false },
      { isArray: false }
    ])
    expect(cypherStatement.query).toBe(
      '' + // little hack to format multiline strings
        `MERGE (${rootIdentifier}:${json[label]} ?)\n` +
        `MERGE (${rootIdentifier})-[:relationship ?]->(${rootIdentifier})\n` +
        `MERGE (${rootIdentifier})-[:relationship2 ?]->(${rootIdentifier})`
    )
  })
  it('json into merge statement with n vertexes, 1 edge, 0 cycles', () => {
    const json: any = createJson()
    const json2: any = createJson()
    json.relationship = json2

    const cypherStatement = transformJsonIntoCypher(json)

    expect(cypherStatement.parameters).toStrictEqual([
      {
        [id]: json[id],
        [label]: json[label],
        numberProperty: json.numberProperty
      },
      {
        [id]: json2[id],
        [label]: json2[label],
        numberProperty: json2.numberProperty
      },
      { isArray: false }
    ])
    expect(cypherStatement.query).toBe(
      '' + // little hack to format multiline strings
        `MERGE (vertex_${json[id]}:${json[label]} ?)\n` +
        `MERGE (vertex_${json2[id]}:${json2[label]} ?)\n` +
        `MERGE (vertex_${json[id]})-[:relationship ?]->(vertex_${json2[id]})`
    )
  })
  it('json into merge statement with n vertexes, n edges, 1 cycle', () => {
    const json: any = createJson()
    const json2: any = createJson()
    json.relationship = json2
    json2.relationship = json

    const cypherStatement = transformJsonIntoCypher(json)

    expect(cypherStatement.parameters).toStrictEqual([
      {
        [id]: json[id],
        [label]: json[label],
        numberProperty: json.numberProperty
      },
      {
        [id]: json2[id],
        [label]: json2[label],
        numberProperty: json2.numberProperty
      },
      { isArray: false },
      { isArray: false }
    ])
    expect(cypherStatement.query).toBe(
      '' + // little hack to format multiline strings
        `MERGE (vertex_${json[id]}:${json[label]} ?)\n` +
        `MERGE (vertex_${json2[id]}:${json2[label]} ?)\n` +
        `MERGE (vertex_${json2[id]})-[:relationship ?]->(vertex_${json[id]})\n` +
        `MERGE (vertex_${json[id]})-[:relationship ?]->(vertex_${json2[id]})`
    )
  })
  it.todo('json into merge statement with n vertexes, n edges, n cycles')
  it.todo('json into merge statement with n vertexes, n edges, n redundant cycles')
})
