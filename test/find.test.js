const Konekto = require('../lib')
const konekto = new Konekto()
describe('find', () => {
  let json
  let jsonDb
  beforeAll(async () => {
    await konekto.connect()
    await konekto.createGraph('find_test')
    await konekto.setGraph('find_test')
  })

  beforeEach(async () => {
    json = {
      _label: 'test',
      name: 'def',
      rel1: {
        _label: 'test2',
        number: 10
      },
      rel2: [
        {
          _label: 'test3',
          name: 'abc',
          sub_rel: {
            _label: 'test2',
            number: 5,
            deeper_rel: {
              _label: 'test4',
              value: 'xd'
            }
          }
        },
        {
          _label: 'test3',
          name: 'ghi',
          sub_rel: [
            {
              _label: 'test',
              bool_property: false
            },
            {
              _label: 'test2',
              number: 15
            }
          ]
        },
        {
          _label: 'test3',
          date: new Date().toISOString()
        }
      ]
    }
    await konekto.createSchema(json)
    jsonDb = await konekto.save(json)
  })

  afterEach(() => {
    return konekto.deleteByQueryObject({
      _label: ['test', 'test2', 'test3', 'test4']
    })
  })

  afterAll(() => {
    return konekto.disconnect()
  })

  test('find by id', async () => {
    const result = await konekto.findById(jsonDb._id)
    result.rel2 = result.rel2.sort((a, b) => a.name.localeCompare(b.name))
    result.rel2[1].sub_rel = result.rel2[1].sub_rel.sort((a, b) => a._label.localeCompare(b._label))
    expect(result).toEqual(jsonDb)
  })

  test('find by label', async () => {
    const result = await konekto.findByQueryObject({
      _label: 'test'
    })
    expect(result.length).toBe(2)
  })

  test('find by multiple labels', async () => {
    const result = await konekto.findByQueryObject({
      _label: ['test', 'test2', 'test3', 'test4']
    })
    expect(result.length).toBe(9)
  })

  test('order by field', async () => {
    const result = await konekto.findByQueryObject({
      _label: ['test', 'test3'],
      order: 'name'
    })
    expect(result.map(n => n.name)).toEqual(['abc', 'def', 'ghi', undefined, undefined])
  })

  test('order by field desceding', async () => {
    const result = await konekto.findByQueryObject({
      _label: ['test', 'test3'],
      order: '!name'
    })
    expect(result.map(n => n.name)).toEqual([undefined, undefined, 'ghi', 'def', 'abc'])
  })

  test('skip', async () => {
    const result = await konekto.findByQueryObject({
      _label: ['test3'],
      skip: 2
    })
    expect(result.map(n => n.name)).toEqual([undefined])
  })

  test('limit', async () => {
    const result = await konekto.findByQueryObject({
      _label: ['test', 'test3'],
      limit: 2
    })
    expect(result.map(n => n.name)).toEqual(['def', undefined])
  })

  test('paginate', async () => {
    const result = await konekto.findByQueryObject({
      _label: ['test3', 'test'],
      limit: 2,
      skip: 1,
      order: 'name'
    })
    expect(result.map(n => n.name)).toEqual(['def', 'ghi'])
  })

  test('where equals', async () => {
    const result = await konekto.findByQueryObject({
      where: '{this}.number = 15'
    })
    expect(result).toEqual([jsonDb.rel2[1].sub_rel[1]])
  })
  test('where boolean', async () => {
    const result = await konekto.findByQueryObject({
      where: '{this}.bool_property = false'
    })
    expect(result).toEqual([jsonDb.rel2[1].sub_rel[0]])
  })

  test('where number greater than', async () => {
    const result = await konekto.findByQueryObject({
      where: '{this}.number > 14'
    })
    expect(result).toEqual([jsonDb.rel2[1].sub_rel[1]])
  })

  test('where number greater equal than', async () => {
    const result = await konekto.findByQueryObject({
      where: '{this}.number >= 15'
    })
    expect(result).toEqual([jsonDb.rel2[1].sub_rel[1]])
  })

  test('where number lesser than', async () => {
    const result = await konekto.findByQueryObject({
      where: '{this}.number < 6'
    })
    delete jsonDb.rel2[0].sub_rel.deeper_rel
    expect(result).toEqual([jsonDb.rel2[0].sub_rel])
  })

  test('where number lesser equal than', async () => {
    const result = await konekto.findByQueryObject({
      where: '{this}.number <= 5'
    })
    delete jsonDb.rel2[0].sub_rel.deeper_rel
    expect(result).toEqual([jsonDb.rel2[0].sub_rel])
  })

  test('where or', async () => {
    const result = await konekto.findByQueryObject({
      where: '{this}.number = 15 OR {this}.number = 10'
    })
    expect(result).toEqual([jsonDb.rel1, jsonDb.rel2[1].sub_rel[1]])
  })

  test('where string starts with', async () => {
    const result = await konekto.findByQueryObject({
      where: '{this}.name STARTSWITH "a"'
    })
    delete jsonDb.rel2[0].sub_rel
    expect(result).toEqual([jsonDb.rel2[0]])
  })

  test('where string ends with', async () => {
    const result = await konekto.findByQueryObject({
      where: '{this}.name ENDSWITH "c"'
    })
    delete jsonDb.rel2[0].sub_rel
    expect(result).toEqual([jsonDb.rel2[0]])
  })

  test('where string contains', async () => {
    const result = await konekto.findByQueryObject({
      where: '{this}.value CONTAINS "d"'
    })
    expect(result).toEqual([jsonDb.rel2[0].sub_rel.deeper_rel])
  })

  test('mandatory relationship', async () => {
    const result = await konekto.findByQueryObject({
      sub_rel: {
        mandatory: true
      }
    })
    expect(result.length).toBe(2)
    for (const item of result) {
      expect(item).toHaveProperty('sub_rel')
    }
  })

  test('optional relationship', async () => {
    const result = await konekto.findByQueryObject({
      _label: 'test3',
      sub_rel: {}
    })
    delete jsonDb.rel2[0].sub_rel.deeper_rel
    expect(result).toEqual(expect.arrayContaining(jsonDb.rel2))
  })

  test('order relationship', async () => {
    const result = await konekto.findByQueryObject({
      _label: 'test3',
      sub_rel: {
        order: 'number'
      }
    })
    delete jsonDb.rel2[0].sub_rel.deeper_rel
    jsonDb.rel2[1].sub_rel = jsonDb.rel2[1].sub_rel.sort((a, b) => (a.number && b.number ? a.number > b.number : 1))
    jsonDb.rel2.pop()
    expect(result).toEqual(jsonDb.rel2)
  })

  test('where relationship', async () => {
    const result = await konekto.findByQueryObject({
      sub_rel: {
        where: '{this}.number = 5'
      }
    })
    jsonDb.rel2.pop()
    jsonDb.rel2.pop()
    delete jsonDb.rel2[0].sub_rel.deeper_rel
    expect(result).toEqual(expect.arrayContaining(jsonDb.rel2))
  })

  test('paginate relationship', async () => {
    const result = await konekto.findByQueryObject({
      sub_rel: {
        order: 'number',
        skip: 1,
        limit: 1
      }
    })
    jsonDb.rel2.shift()
    jsonDb.rel2.pop()
    jsonDb.rel2[0].sub_rel.shift()
    expect(result).toEqual(expect.arrayContaining(jsonDb.rel2))
  })

  test('relationship of relationship', async () => {
    const result = await konekto.findByQueryObject({
      rel2: {
        mandatory: true,
        sub_rel: {
          mandatory: true
        }
      }
    })
    delete jsonDb.rel1
    delete jsonDb.rel2[0].sub_rel.deeper_rel
    jsonDb.rel2.pop()
    for (const item of result) {
      expect(item).toHaveProperty('rel2')
      for (const subItem of item.rel2) {
        expect(subItem).toHaveProperty('sub_rel')
      }
    }
  })

  test('relationship of relationship of relationship', async () => {
    const result = await konekto.findByQueryObject({
      rel2: {
        mandatory: true,
        sub_rel: {
          mandatory: true,
          deeper_rel: {
            mandatory: true
          }
        }
      }
    })
    delete jsonDb.rel1
    jsonDb.rel2.pop()
    jsonDb.rel2.pop()
    expect(result).toEqual([jsonDb])
  })
})
