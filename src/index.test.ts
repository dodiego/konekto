import { plainJsonToCypherNode } from "."
import casual from 'casual'

describe('Cypher Node', () => {
  it('Should transform plain json into cypher node with string property', () => {
    const plainJson = {
      stringProperty: casual.string
    }
    const cypherNode = plainJsonToCypherNode(plainJson)

    expect(cypherNode).toBe(`({ stringProperty: '${plainJson.stringProperty}' })`)
  })
  it('Should transform plain json into cypher node with boolean property', () => {
    const plainJson = {
      booleanProperty: casual.boolean
    }
    const cypherNode = plainJsonToCypherNode(plainJson)

    expect(cypherNode).toBe(`({ booleanProperty: ${plainJson.booleanProperty} })`)
  })
  it('Should transform plain json into cypher node with number (float) property', () => {
    const plainJson = {
      numberProperty: casual.random
    }
    const cypherNode = plainJsonToCypherNode(plainJson)

    expect(cypherNode).toBe(`({ numberProperty: ${plainJson.numberProperty} })`)
  })
  it('Should transform plain json into cypher node with number (integer) property', () => {
    const plainJson = {
      numberProperty: casual.integer()
    }
    const cypherNode = plainJsonToCypherNode(plainJson)

    expect(cypherNode).toBe(`({ numberProperty: ${plainJson.numberProperty} })`)
  })
  it('Should transform plain json into cypher node with multiple properties', () => {
    const plainJson = {
      integerProperty: casual.integer(),
      floatProperty: casual.random,
      booleanProperty: casual.boolean,
      stringProperty: casual.words()
    }
    const cypherNode = plainJsonToCypherNode(plainJson)

    expect(cypherNode).toBe(`({
  integerProperty: ${plainJson.integerProperty},
  floatProperty: ${plainJson.floatProperty},
  booleanProperty: ${plainJson.booleanProperty},
  stringProperty: '${plainJson.stringProperty}'
})`)
  })
})
