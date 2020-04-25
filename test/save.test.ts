import Konekto from '../lib'
const konekto = new Konekto()
describe('save', () => {
  beforeAll(async () => {
    await konekto.connect()
    await konekto.raw({
      query: 'create table if not exists public.dates_save_test (_id text primary key, test_date date, document text)'
    })
    konekto.setSqlMappings({
      test: {
        table: 'dates_save_test',
        mappings: {
          test_date: { columnName: 'test_date' },
          document: { columnName: 'document', writeProjection: 'this::text' }
        }
      }
    })
    await konekto.createGraph('save_test')
    await konekto.setGraph('save_test')
  })

  afterEach(() => {
    return konekto.deleteByQueryObject({
      _label: ['test1', 'test', 'test2', 'test3', 'test4']
    })
  })

  afterAll(async () => {
    await konekto.raw({ query: 'drop table public.dates' })
    return konekto.disconnect()
  })

  test('cyclic object', async () => {
    const json: any = {
      _label: 'test1',
      omegalul: 'xd'
    }
    json.sel_rel = json
    await konekto.createSchema(json)
    await konekto.save(json)
    const findResult = await konekto.findByQueryObject({
      _label: 'test1',
      sel_rel: {}
    })
    delete findResult[0].sel_rel._id
    expect([json]).toEqual(findResult)
    expect(findResult.length).toBe(1)
  })

  test('cyclic in middle object', async () => {
    const json: any = {
      _label: 'test1',
      omegalul: 'xd'
    }
    const otherJson: any = {
      _label: 'test2',
      aahaha: 15
    }
    json.sub_rel = otherJson
    otherJson.parent_rel = json
    otherJson.self_rel = otherJson
    await konekto.createSchema(json)
    await konekto.save(json)
    const findResult = await konekto.findByQueryObject({
      _label: 'test1',
      sub_rel: {
        parent_rel: {},
        self_rel: {}
      }
    })
    delete findResult[0]._id
    delete findResult[0].sub_rel._id
    expect([json]).toEqual(findResult)
    expect(findResult.length).toBe(1)
  })

  test('update property of root object', async () => {
    const json = {
      _label: 'test1',
      omegalul: 'xd'
    }
    await konekto.createSchema(json)
    await konekto.save(json)
    const findResult = await konekto.findByQueryObject({
      _label: 'test1'
    })
    await konekto.save({ ...findResult[0], omegalul: 'lul' })
    const updatedFindResult = await konekto.findByQueryObject({
      _label: 'test1'
    })
    delete findResult[0]._id
    expect(findResult[0]).toHaveProperty('omegalul', 'xd')
    expect(updatedFindResult[0]).toHaveProperty('omegalul', 'lul')
    expect(findResult.length).toBe(1)
    expect(updatedFindResult.length).toBe(1)
  })

  test('add property of root object', async () => {
    const json = {
      _label: 'test1',
      omegalul: 'xd'
    }
    await konekto.createSchema(json)
    await konekto.save(json)
    const findResult = await konekto.findByQueryObject({
      _label: 'test1'
    })
    await konekto.save({ ...findResult[0], xd: 'lul' })
    const updatedFindResult = await konekto.findByQueryObject({
      _label: 'test1'
    })
    delete findResult[0]._id
    expect(findResult[0]).not.toHaveProperty('xd', 'lul')
    expect(updatedFindResult[0]).toHaveProperty('xd', 'lul')
    expect(findResult.length).toBe(1)
    expect(updatedFindResult.length).toBe(1)
  })

  test('delete property of root object', async () => {
    const json = {
      _label: 'test1',
      omegalul: 'xd'
    }
    await konekto.createSchema(json)
    await konekto.save(json)
    const findResult = await konekto.findByQueryObject({
      _label: 'test1'
    })
    await konekto.save({ ...findResult[0], omegalul: null })
    const updatedFindResult = await konekto.findByQueryObject({
      _label: 'test1'
    })
    delete findResult[0]._id
    expect(findResult[0]).toHaveProperty('omegalul', 'xd')
    expect(updatedFindResult[0]).not.toHaveProperty('omegalul')
    expect(findResult.length).toBe(1)
    expect(updatedFindResult.length).toBe(1)
  })

  test('update property of related object', async () => {
    const json = {
      _label: 'test1',
      rel: {
        _label: 'test2',
        omegalul: 'xd'
      }
    }
    await konekto.createSchema(json)
    await konekto.save(json)
    const findResult = await konekto.findByQueryObject({
      _label: 'test2'
    })
    await konekto.save({ ...findResult[0], omegalul: 'lul' })
    const updatedFindResult = await konekto.findByQueryObject({
      _label: 'test1',
      rel: {}
    })
    expect(findResult[0]).toHaveProperty('omegalul', 'xd')
    expect(updatedFindResult[0].rel).toHaveProperty('omegalul', 'lul')
    expect(findResult.length).toBe(1)
    expect(updatedFindResult.length).toBe(1)
  })

  test('add property of related object', async () => {
    const json = {
      _label: 'test1',
      rel: {
        _label: 'test2',
        omegalul: 'xd'
      }
    }
    await konekto.createSchema(json)
    await konekto.save(json)
    const findResult = await konekto.findByQueryObject({
      _label: 'test2'
    })
    await konekto.save({ ...findResult[0], xd: 'yes' })
    const updatedFindResult = await konekto.findByQueryObject({
      _label: 'test1',
      rel: {}
    })
    expect(findResult[0]).not.toHaveProperty('xd', 'yes')
    expect(updatedFindResult[0].rel).toHaveProperty('xd', 'yes')
    expect(findResult.length).toBe(1)
    expect(updatedFindResult.length).toBe(1)
  })

  test('remove property of related object', async () => {
    const json = {
      _label: 'test1',
      rel: {
        _label: 'test2',
        omegalul: 'xd'
      }
    }
    await konekto.createSchema(json)
    await konekto.save(json)
    const findResult = await konekto.findByQueryObject({
      _label: 'test2'
    })
    await konekto.save({ ...findResult[0], omegalul: null })
    const updatedFindResult = await konekto.findByQueryObject({
      _label: 'test1',
      rel: {}
    })
    expect(findResult[0]).toHaveProperty('omegalul')
    expect(updatedFindResult[0].rel).not.toHaveProperty('omegalul')
    expect(findResult.length).toBe(1)
    expect(updatedFindResult.length).toBe(1)
  })

  test('create new object and relate to existing one', async () => {
    const json = {
      _label: 'test1'
    }
    const rel = {
      _label: 'test2',
      omegalul: 'xd'
    }
    await konekto.createSchema(json)
    const rootId = await konekto.save(json)
    const findResult = await konekto.findByQueryObject({ _label: 'test1' })
    await konekto.save({
      _label: 'test1',
      _id: rootId,
      rel
    })
    const updatedFindResult = await konekto.findByQueryObject({
      _label: 'test1',
      rel: {}
    })
    expect(findResult).not.toHaveProperty('rel')
    delete updatedFindResult[0].rel._id
    expect(updatedFindResult[0]).toHaveProperty('rel', rel)
    expect(findResult.length).toBe(1)
    expect(updatedFindResult.length).toBe(1)
  })

  test('relate existing objects', async () => {
    const json1 = {
      _label: 'test1'
    }
    const json2 = {
      _label: 'test2'
    }
    await konekto.save(json1)
    await konekto.save(json2)
    const findResult1 = await konekto.findByQueryObject({ _label: 'test1' })
    const findResult2 = await konekto.findByQueryObject({ _label: 'test2' })
    await konekto.save({ ...findResult1[0], rel: { ...findResult2[0] } })
    const finalFindResult = await konekto.findByQueryObject({ _label: 'test1', rel: {} })
    expect(findResult1[0]).not.toHaveProperty('rel')
    expect(finalFindResult[0]).toHaveProperty('rel', findResult2[0])
    expect(findResult1.length).toBe(1)
    expect(finalFindResult.length).toBe(1)
  })

  test('insert node with array of numbers', async () => {
    const json = {
      _label: 'test1',
      prop: [1, 2, 3]
    }
    await konekto.save(json)
    const findResult = await konekto.findByQueryObject({})
    expect(findResult[0]).toHaveProperty('prop', [1, 2, 3])
  })

  test('insert node with array of mixed types', async () => {
    const json = {
      _label: 'test1',
      prop: [1, { _label: 'someDoc' }, null, 'xd']
    }
    await konekto.save(json)
    const findResult = await konekto.findByQueryObject({})
    expect(findResult[0]).toHaveProperty('prop', [1, { _label: 'someDoc' }, null, 'xd'])
  })

  test('insert node with relationship array of one element', async () => {
    const json = {
      _label: 'test1',
      rel: [
        {
          _label: 'test1'
        }
      ]
    }
    await konekto.save(json)
    const findResult = await konekto.findByQueryObject({ rel: { mandatory: true } })
    delete findResult[0]._id
    delete findResult[0].rel[0]._id
    expect(findResult).toEqual([json])
  })

  test('insert node with relationship array of two elements', async () => {
    const json = {
      _label: 'test1',
      rel: [
        {
          _label: 'test1'
        },
        {
          _label: 'test1'
        }
      ]
    }
    await konekto.save(json)
    const findResult = await konekto.findByQueryObject({ rel: { mandatory: true } })
    delete findResult[0]._id
    delete findResult[0].rel[0]._id
    delete findResult[0].rel[1]._id
    expect(findResult).toEqual([json])
  })

  test('add one more relationship to node', async () => {
    const json: any = {
      _label: 'test1',
      rel: {
        _label: 'test1'
      }
    }
    const rootId = await konekto.save(json)
    const findResult = await konekto.findByQueryObject({ rel: { mandatory: true } })
    json._id = rootId
    delete findResult[0].rel._id
    await konekto.save(json)
    const findResult2 = await konekto.findByQueryObject({ rel: { mandatory: true } })
    delete findResult2[0].rel[0]._id
    delete findResult2[0].rel[1]._id
    json.rel = [json.rel, json.rel]
    expect(findResult2).toEqual([json])
  })

  test('insert root node without label should throw error', async () => {
    await expect(
      konekto.save({
        a: 1
      })
    ).rejects.toThrow()
  })

  test('insert related node without label should throw error', async () => {
    await expect(
      konekto.save({
        _label: 'test',
        a: 1,
        b: {
          c: true
        }
      })
    ).rejects.toThrow()
  })

  test('insert deep related node without label should throw error', async () => {
    await expect(
      konekto.save({
        _label: 'test',
        a: 1,
        b: {
          _label: 'test',
          rel: [
            {
              _label: 'test'
            },
            {}
          ]
        }
      })
    ).rejects.toThrow()
  })

  test('object with property _json=true should be saved as node value', async () => {
    const json = {
      _label: 'test1',
      prop: {
        _json: true,
        a: true
      }
    }
    await konekto.save(json)
    const findResult = await konekto.findByQueryObject({ _label: 'test1' })
    delete findResult[0]._id
    expect([json]).toStrictEqual(findResult)
  })

  test('write projection', async () => {
    const json: any = {
      _label: 'test',
      document: {
        a: true,
        b: 1
      }
    }
    await konekto.createSchema(json)
    await konekto.save(json)
    const findResult = await konekto.findByQueryObject({ _label: 'test' })

    json.document = JSON.stringify(json.document)
    delete findResult[0]._id

    expect([json]).toStrictEqual(findResult)
  })
})
