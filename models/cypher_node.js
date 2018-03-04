module.exports = class CypherNode {
  constructor (cypher, id, node) {
    this.cypher = cypher
    this.id = id
    this.node = node
  }
}