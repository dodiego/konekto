module.exports = class Statement {
  constructor (cypher, parameters, uuid) {
    this.cypher = cypher || ''
    this.parameters = parameters || {}
    this.uuid = uuid
  }
}
