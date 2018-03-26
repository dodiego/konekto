module.exports = class CypherPattern {
  constructor (cypher, patternId, nodeIds) {
    this.cypher = cypher
    this.patternId = patternId
    this.nodeIds = nodeIds
  }
}
