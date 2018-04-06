let Aghanim = require('./lib/index')
let aghanim = new Aghanim();

(async () => {
  console.log(await aghanim.save({
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

  console.log(await aghanim.findByQueryObject({
    label: ['man', 'woman'],
    order: (node) => node.city,
    include: [{
      name: 'friends',
      order: (node) => node.name
    }]
  }, { removeDuplicates: true }))

  await aghanim.remove({
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
  })

  await aghanim.findByUuid('40808608-efe6-43f0-8e37-e49dce8c9f63')
})()
