import { plainJsonToCypherVertex } from '.'
import casual from 'casual'

describe('Cypher Node', () => {
  it('Should transform plain json into cypher node with string property', () => {
    const plainJson = {
      stringProperty: casual.string
    }
    const cypherNode = plainJsonToCypherVertex('vs', plainJson)

    expect(cypherNode).toBe(`(vs { stringProperty: '${plainJson.stringProperty}' })`)
  })
  it('Should transform plain json into cypher node with boolean property', () => {
    const plainJson = {
      booleanProperty: casual.boolean
    }
    const cypherNode = plainJsonToCypherVertex('vb', plainJson)

    expect(cypherNode).toBe(`(vb { booleanProperty: ${plainJson.booleanProperty} })`)
  })
  it('Should transform plain json into cypher node with number (float) property', () => {
    const plainJson = {
      numberProperty: casual.random
    }
    const cypherNode = plainJsonToCypherVertex('vn', plainJson)

    expect(cypherNode).toBe(`(vn { numberProperty: ${plainJson.numberProperty} })`)
  })
  it('Should transform plain json into cypher node with number (integer) property', () => {
    const plainJson = {
      numberProperty: casual.integer()
    }
    const cypherNode = plainJsonToCypherVertex('vn2', plainJson)

    expect(cypherNode).toBe(`(vn2 { numberProperty: ${plainJson.numberProperty} })`)
  })
  it('Should transform plain json into cypher node with null property', () => {
    const plainJson = {
      nullProperty: null
    }
    const cypherNode = plainJsonToCypherVertex('vNull', plainJson)

    expect(cypherNode).toBe(`(vNull { nullProperty: ${plainJson.nullProperty} })`)
  })
  it('Should transform plain json into cypher node with multiple properties', () => {
    const plainJson = {
      integerProperty: casual.integer(),
      floatProperty: casual.random,
      booleanProperty: casual.boolean,
      stringProperty: casual.words()
    }
    const cypherNode = plainJsonToCypherVertex('v1', plainJson)

    expect(cypherNode).toBe(
      `(v1 { integerProperty: ${plainJson.integerProperty}, floatProperty: ${plainJson.floatProperty}, booleanProperty: ${plainJson.booleanProperty}, stringProperty: '${plainJson.stringProperty}' })`
    )
  })
})
