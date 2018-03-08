module.exports = class {
  constructor () {
    this.cypher = []
  }

  where (field, operator, value) {
    this.cypher.push(`${field} ${operator} ${value}`)
  }
}

let js = {
  where: [
    {
      key: 'name',
      operator: 'starts with',
      value: '$param',
    },
    {
      key: 'name',
      operator: 'starts with',
      value: '$param',
    },
    {
      key: 'name',
      operator: 'starts with',
      value: '$param',
    },
    [{

    }]
  ]
}


// query()
// .where()
// .