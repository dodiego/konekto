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
    const id = await konekto.save(json)
    const findResult = await konekto.findById(id)
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
    const id = await konekto.save(json)
    const findResult = await konekto.findById(id)
    delete findResult._id
    delete findResult.sub_rel._id
    expect(json).toEqual(findResult)
  })

  test('update property of root object', async () => {
    const json = {
      _label: 'test1',
      omegalul: 'xd'
    }
    await konekto.createSchema(json)
    const id = await konekto.save(json)
    const findResult = await konekto.findById(id)
    await konekto.save({ ...findResult, omegalul: 'lul' })
    const updatedFindResult = await konekto.findById(id)
    delete findResult._id
    expect(findResult).toHaveProperty('omegalul', 'xd')
    expect(updatedFindResult).toHaveProperty('omegalul', 'lul')
  })

  test('add property of root object', async () => {
    const json = {
      _label: 'test1',
      omegalul: 'xd'
    }
    await konekto.createSchema(json)
    const id = await konekto.save(json)
    const findResult = await konekto.findById(id)
    await konekto.save({ ...findResult, xd: 'lul' })
    const updatedFindResult = await konekto.findById(id)
    delete findResult._id
    expect(findResult).not.toHaveProperty('xd', 'lul')
    expect(updatedFindResult).toHaveProperty('xd', 'lul')
  })

  test('delete property of root object', async () => {
    const json = {
      _label: 'test1',
      omegalul: 'xd'
    }
    await konekto.createSchema(json)
    const id = await konekto.save(json)
    const findResult = await konekto.findById(id)
    await konekto.save({ ...findResult, omegalul: null })
    const updatedFindResult = await konekto.findById(id)
    delete findResult._id
    expect(findResult).toHaveProperty('omegalul')
    expect(updatedFindResult).not.toHaveProperty('omegalul')
  })

  test('update property of related object', async () => {
    const json = {
      _label: 'test1',
      rel: {
        _label: 'test1',
        omegalul: 'xd'
      }
    }
    await konekto.createSchema(json)
    const id = await konekto.save(json)
    const findResult = await konekto.findById(id)
    await konekto.save({ ...findResult.rel, omegalul: 'lul' })
    const updatedFindResult = await konekto.findById(findResult.rel._id)
    expect(findResult.rel).toHaveProperty('omegalul', 'xd')
    expect(updatedFindResult).toHaveProperty('omegalul', 'lul')
  })

  test('add property of related object', async () => {
    const json = {
      _label: 'test1',
      rel: {
        _label: 'test1',
        omegalul: 'xd'
      }
    }
    await konekto.createSchema(json)
    const id = await konekto.save(json)
    const findResult = await konekto.findById(id)
    await konekto.save({ ...findResult.rel, xd: 'yes' })
    const updatedFindResult = await konekto.findById(findResult.rel._id)
    expect(findResult.rel).not.toHaveProperty('xd', 'yes')
    expect(updatedFindResult).toHaveProperty('xd', 'yes')
  })

  test('remove property of related object', async () => {
    const json = {
      _label: 'test1',
      rel: {
        _label: 'test1',
        omegalul: 'xd'
      }
    }
    await konekto.createSchema(json)
    const id = await konekto.save(json)
    const findResult = await konekto.findById(id)
    await konekto.save({ ...findResult.rel, omegalul: null })
    const updatedFindResult = await konekto.findById(findResult.rel._id)
    expect(findResult.rel).toHaveProperty('omegalul')
    expect(updatedFindResult).not.toHaveProperty('omegalul')
  })

  test('create and relate objects', async () => {
    const json = {
      _label: 'test1'
    }
    const rel = {
      _label: 'test1',
      omegalul: 'xd'
    }
    await konekto.createSchema(json)
    const id = await konekto.save(json)
    const findResult = await konekto.findById(id)
    await konekto.save({
      ...findResult,
      rel
    })
    const updatedFindResult = await konekto.findById(id)
    expect(findResult).not.toHaveProperty('rel')
    delete updatedFindResult.rel._id
    expect(updatedFindResult).toHaveProperty('rel', rel)
  })

  test('relate existing objects', async () => {
    const json1 = {
      _label: 'test1'
    }
    const json2 = {
      _label: 'test2'
    }
    const id1 = await konekto.save(json1)
    const id2 = await konekto.save(json2)
    const findResult1 = await konekto.findById(id1)
    const findResult2 = await konekto.findById(id2)
    await konekto.save({ ...findResult1, rel: { ...findResult2 } })
    const finalFindResult = await konekto.findById(id1)
    expect(findResult1).not.toHaveProperty('rel')
    expect(finalFindResult).toHaveProperty('rel', findResult2)
  })
})
