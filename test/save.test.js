const Aghanim = require('../lib')
const { label } = require('../lib/utils')
const aghanim = new Aghanim()

describe('save', () => {
  beforeAll(async () => {
    await aghanim.connect()
    await aghanim.createGraph('save_test')
    await aghanim.setGraph('save_test')
  })

  afterEach(() => {
    return aghanim.deleteByQueryObject({
      [label]: [ 'test', 'test2', 'test3', 'test4' ]
    })
  })

  afterAll(() => {
    return aghanim.disconnect()
  })

  test('cyclic object', async () => {
    let json = {
      [label]: 'test1',
      omegalul: 'xd'
    }
    json.sel_rel = json
    await aghanim.createSchema(json)
    let saveResult = await aghanim.save(json)
    let findResult = await aghanim.findById(saveResult._id)
    delete findResult._id
    expect(json).toEqual(findResult)
  })

  test('cyclic in middle object', async () => {
    let json = {
      [label]: 'test1',
      omegalul: 'xd'
    }
    let otherJson = {
      [label]: 'test2',
      aahaha: 15
    }
    json.sub_rel = otherJson
    otherJson.parent_rel = json
    otherJson.self_rel = otherJson
    await aghanim.createSchema(json)
    let saveResult = await aghanim.save(json)
    let findResult = await aghanim.findById(saveResult._id)
    delete findResult._id
    delete findResult.sub_rel._id
    expect(json).toEqual(findResult)
  })
})
