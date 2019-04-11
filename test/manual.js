const Aghanim = require('../lib')
const { id, label } = require('../lib/utils')
const aghanim = new Aghanim({
  user: 'agens',
  pass: 'agens',
  db: 'agens'
})

async function run () {
  let json = {
    [label]: 'xd',
    name: 'omegalul',
    rel: [
      {
        [label]: 'xd2',
        bool: true
      },
      {
        [label]: 'xd2',
        number: 10,
        subRel: {
          [label]: 'xd3',
          date: new Date()
        }
      }
    ]
  }
  await aghanim.connect('agens_graph')
  await aghanim.createSchema(json)
  await aghanim.save(json)
}

run().then(
  () => {
    console.log('success!')
    process.exit(0)
  },
  err => {
    console.error(err)
    process.exit(1)
  }
)
