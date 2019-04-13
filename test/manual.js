const Aghanim = require('../lib')
const { label, where } = require('../lib/utils')
const aghanim = new Aghanim({
  user: 'agens',
  pass: 'agens',
  db: 'agens'
})

async function run () {
  let json = {
    [label]: 'xd',
    name: 'omegalul2',
    rel: [
      {
        [label]: 'xd2',
        bool: true
      },
      {
        [label]: 'xd2',
        number: 11,
        subRel: {
          [label]: 'xd3',
          date: new Date()
        }
      }
    ]
  }
  let queryObject = {
    [label]: 'xd',
    name: 'omegalul2',
    rel: [
      {
        [label]: 'xd2',
        subRel: {
          [label]: 'xd3'
        }
      }
    ]
  }
  await aghanim.connect('agens_graph')
  await aghanim.createSchema(json)
  console.log(JSON.stringify(await aghanim.save(json), null, 2))
  let result = await aghanim.findByQueryObject(queryObject)
  console.log(JSON.stringify(result, null, 2))
  await aghanim.deleteById(result[0]._id)
  // JSON.stringify(await aghanim.deleteByQueryObject(queryObject), null, 2)
  // console.log(JSON.stringify(await aghanim.findById('5.1'), null, 2))
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
