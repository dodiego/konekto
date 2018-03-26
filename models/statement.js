module.exports = class Statement {
  constructor (cypher, parameters = {}) {
    this.cypher = cypher
    this.parameters = parameters
  }
}
