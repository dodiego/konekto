const Aghanim = require('../lib')
const { label } = require('../lib/utils')
const aghanim = new Aghanim({
  user: 'agens',
  pass: 'agens',
  db: 'agens'
})

describe('find', () => {
  let json
  let jsonDb

  beforeAll(async () => {
    await aghanim.connect('agens_graph')
  })

  beforeEach(async () => {
    json = {
      [label]: 'test',
      rel1: {
        [label]: 'test'
      },
      rel2: [
        {
          [label]: 'test',
          subRel: {
            [label]: 'test'
          }
        },
        {
          [label]: 'test',
          subRel: [
            {
              [label]: 'test'
            },
            {
              [label]: 'test'
            }
          ]
        }
      ]
    }
    await aghanim.createSchema(json)
    jsonDb = await aghanim.save(json)
  })

  afterEach(() => {
    return aghanim.deleteByQueryObject({ [label]: 'test' })
  })

  afterAll(() => {
    return aghanim.disconnect()
  })

  test('find by id', async () => {
    let result = await aghanim.findById(jsonDb._id)
    expect(result).toEqual(jsonDb)
  })
})
