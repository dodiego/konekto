const Konekto = require('../lib')
const konekto = new Konekto()

describe('save', () => {
  beforeAll(async () => {
    await konekto.connect()
    await konekto.createGraph('save_test')
    await konekto.setGraph('save_test')
  })

  afterEach(() => {
    return konekto.deleteByQueryObject({
      _label: [ 'test', 'test2', 'test3', 'test4' ]
    })
  })

  afterAll(() => {
    return konekto.disconnect()
  })

  test('cyclic object', async () => {
    let json = {
      _label: 'test1',
      omegalul: 'xd'
    }
    json.sel_rel = json
    await konekto.createSchema(json)
    let saveResult = await konekto.save(json)
    let findResult = await konekto.findById(saveResult._id)
    delete findResult._id
    expect(json).toEqual(findResult)
  })

  test('cyclic in middle object', async () => {
    let json = {
      _label: 'test1',
      omegalul: 'xd'
    }
    let otherJson = {
      _label: 'test2',
      aahaha: 15
    }
    json.sub_rel = otherJson
    otherJson.parent_rel = json
    otherJson.self_rel = otherJson
    await konekto.createSchema(json)
    let saveResult = await konekto.save(json)
    let findResult = await konekto.findById(saveResult._id)
    delete findResult._id
    delete findResult.sub_rel._id
    expect(json).toEqual(findResult)
  })
})
