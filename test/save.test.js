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
      _label: ['test1', 'test', 'test2', 'test3', 'test4']
    })
  })

  afterAll(() => {
    return konekto.disconnect()
  })

  test('cyclic object', async () => {
    const json = {
      _label: 'test1',
      omegalul: 'xd'
    }
    json.sel_rel = json
    await konekto.createSchema(json)
    const saveResult = await konekto.save(json)
    const findResult = await konekto.findById(saveResult._id)
    delete findResult._id
    expect(json).toEqual(findResult)
  })

  test('cyclic in middle object', async () => {
    const json = {
      _label: 'test1',
      omegalul: 'xd'
    }
    const otherJson = {
      _label: 'test2',
      aahaha: 15
    }
    json.sub_rel = otherJson
    otherJson.parent_rel = json
    otherJson.self_rel = otherJson
    await konekto.createSchema(json)
    const saveResult = await konekto.save(json)
    const findResult = await konekto.findById(saveResult._id)
    delete findResult._id
    delete findResult.sub_rel._id
    expect(json).toEqual(findResult)
  })

  test('save wkt', async () => {
    const json = {
      _label: 'test1',
      omegalul: 'xd',
      _wkt: new wkx.Point(0, 0).toWkt()
    }
    await konekto.createSchema(json)
    const saveResult = await konekto.save(json)
    const findResult = await konekto.findById(saveResult._id)
    delete findResult._id
    expect(json).toEqual(findResult)
  })

  test('save multiple wkts', async () => {
    const json = {
      _label: 'test1',
      omegalul: 'xd',
      _wkt: new wkx.Point(0, 0).toWkt(),
      related: {
        _label: 'test1',
        _wkt: new wkx.Point(0, 1).toWkt()
      }
    }
    await konekto.createSchema(json)
    const saveResult = await konekto.save(json)
    const findResult = await konekto.findById(saveResult._id)
    delete findResult._id
    delete findResult.related._id
    expect(json).toEqual(findResult)
  })

  test('save xd wkts', async () => {
    const json = {
      _label: 'test',
      omegalul: 'xd',
      _wkt: new wkx.Point(0, 0).toWkt(),
      related: {
        _label: 'test',
        _wkt: new wkx.Point(0, 1).toWkt()
      }
    }
    await konekto.createSchema(json)
    const saveResult = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      where: `id({this}) = ${saveResult._id}`
    })
    delete findResult._id
    delete json.related
    expect(json).toEqual(findResult)
  })
})
