module.exports = class {
  constructor () {
    this.i = 1
  }

  nextId () {
    return `v${this.i++}`
  }
}
