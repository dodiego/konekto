let Aghanim = require('./index')
let aghanim = new Aghanim();

(async () => {
  console.log(await aghanim.write({
    name: 'diego',
    _label: 'man',
    friends: [{
      name: 'rafael',
      _label: 'man',
    }, {
      name: 'amanda',
      _label: 'woman',
      address: {
        city: 'haha',
        _label: 'place',
        arraylul: [{
          shit: 'rofl',
          _label: 'haha'
        }, {
          omega: 'lul',
          _label: 'haha'
        }]
      }
    }]
  })
  )

  console.log(await aghanim.read({
    label: ['man', 'woman'],
    order: (node) => node.city,
    include: [{
      name: 'friends',
      order: (node) => node.name
    }]
  }))

  console.log(await aghanim.remove({
    label: ['man', 'woman'],
    order: (node) => node.city,
    include: [{
      name: 'friends',
      skip: 0,
      limit: 1,
      order: (node) => node.name
    }]
  }, {
    returnResults: true,
    parseResults: true
  }))
})()
