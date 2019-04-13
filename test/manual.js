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
    [where]: {
      name: 'omegalul2'
    },
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
  await aghanim.connect('agens_graph')
  await aghanim.createSchema(json)
  // await aghanim.save(json)
  console.log(
    JSON.stringify(
      await aghanim.findByQueryObject({
        [label]: 'xd',
        name: 'omegalul2',
        rel: [
          {
            [label]: 'xd2',
            [where]: {
              number: {
                $gte: 10
              }
            },
            subRel: {
              [label]: 'xd3'
            }
          }
        ]
      }),
      null,
      2
    )
  )
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
