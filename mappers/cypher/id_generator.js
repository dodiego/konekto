module.exports = class {
  constructor () {
    this.i = 0
  }

  nextId () {
    return `v${this.i++}`
  }
}
