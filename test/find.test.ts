import Konekto from '../lib'
const konekto = new Konekto()

describe('find', () => {
  beforeAll(async () => {
    await konekto.connect()
    await konekto.createGraph('find_test')
    await konekto.setGraph('find_test')
  })

  afterEach(() => {
    return konekto.deleteByQueryObject({})
  })

  afterAll(async () => {
    return konekto.disconnect()
  })

  async function insertJson (json) {
    await konekto.createSchema(json)
    const id = await konekto.save(json)
    json._id = id
    return json
  }

  test('find by id', async () => {
    const json = {
      _label: 'test'
    }
    const result = await insertJson(json)
    const findResult = await konekto.findById(result._id)
    expect(result).toEqual(findResult)
  })

  test('find by label', async () => {
    const result1 = await insertJson({
      _label: 'test'
    })
    await insertJson({
      _label: 'test2'
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test'
    })
    expect(findResult).toStrictEqual([result1])
  })

  test('find by multiple labels', async () => {
    const result1 = await insertJson({
      _label: 'test'
    })
    const result2 = await insertJson({
      _label: 'test2'
    })
    const findResult = await konekto.findByQueryObject({
      _label: ['test', 'test2']
    })
    expect(findResult).toStrictEqual([result1, result2])
  })

  test('order by field', async () => {
    const result1 = await insertJson({
      _label: 'test',
      name: 'b'
    })
    const result2 = await insertJson({
      _label: 'test',
      name: 'a'
    })
    const result3 = await insertJson({
      _label: 'test',
      name: 'c'
    })
    const findResult = await konekto.findByQueryObject({
      _label: ['test'],
      _order: 'name'
    })
    expect(findResult).toStrictEqual([result2, result1, result3])
  })

  test('order by field desceding', async () => {
    const result1 = await insertJson({
      _label: 'test',
      name: 'b'
    })
    const result2 = await insertJson({
      _label: 'test',
      name: 'a'
    })
    const result3 = await insertJson({
      _label: 'test',
      name: 'c'
    })
    const findResult = await konekto.findByQueryObject({
      _label: ['test'],
      _order: '!name'
    })
    expect(findResult).toStrictEqual([result3, result1, result2])
  })

  test('skip', async () => {
    await insertJson({
      _label: 'test',
      name: 'a'
    })
    const result2 = await insertJson({
      _label: 'test',
      name: 'b'
    })
    const result3 = await insertJson({
      _label: 'test',
      name: 'c'
    })
    const findResult = await konekto.findByQueryObject({
      _label: ['test'],
      _skip: 1
    })
    expect(findResult).toStrictEqual([result2, result3])
  })

  test('limit', async () => {
    await insertJson({
      _label: 'test',
      name: 'a'
    })
    await insertJson({
      _label: 'test',
      name: 'b'
    })
    await insertJson({
      _label: 'test',
      name: 'c'
    })
    const findResult = await konekto.findByQueryObject({
      _label: ['test'],
      _limit: 2
    })
    expect(findResult.length).toBe(2)
  })

  test('paginate', async () => {
    await insertJson({
      _label: 'test',
      name: 'a'
    })
    const result2 = await insertJson({
      _label: 'test',
      name: 'b'
    })
    const result3 = await insertJson({
      _label: 'test',
      name: 'c'
    })
    const findResult = await konekto.findByQueryObject({
      _label: ['test'],
      _limit: 2,
      _skip: 1
    })
    expect(findResult).toStrictEqual([result2, result3])
  })

  test('where equals', async () => {
    const result = await insertJson({
      _label: 'test',
      number: 10
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.number = 10' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where different', async () => {
    const result = await insertJson({
      _label: 'test',
      number: 10
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.number <> 9' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where number equals sum expression', async () => {
    const result = await insertJson({
      _label: 'test',
      number: 10
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.number = 5 + 5' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where number equals minus expression', async () => {
    const result = await insertJson({
      _label: 'test',
      number: 10
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.number = 15 - 5' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where number equals multiplication expression', async () => {
    const result = await insertJson({
      _label: 'test',
      number: 10
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.number = 2 * 5' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where number equals division expression', async () => {
    const result = await insertJson({
      _label: 'test',
      number: 10
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.number = 20 / 2' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where number equals exponentiation expression', async () => {
    const result = await insertJson({
      _label: 'test',
      number: 4
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.number = 2 ^ 2' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where number equals exponentiation expression using negative', async () => {
    const result = await insertJson({
      _label: 'test',
      number: 4
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.number = -2 ^ 2' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where number equals modulo division', async () => {
    const result = await insertJson({
      _label: 'test',
      number: 4
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.number % 2 = 0' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where boolean equals false', async () => {
    const result = await insertJson({
      _label: 'test',
      bool_prop: false
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.bool_prop = false' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where boolean equals true', async () => {
    const result = await insertJson({
      _label: 'test',
      bool_prop: true
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.bool_prop = true' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where property is null', async () => {
    const result = await insertJson({
      _label: 'test',
      null_prop: null
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.null_prop IS NULL' }
    })
    delete result.null_prop
    expect([result]).toStrictEqual(findResult)
  })

  test('where property is not null', async () => {
    const result = await insertJson({
      _label: 'test',
      prop: true
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.prop IS NOT NULL' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where number greater than', async () => {
    const result = await insertJson({
      _label: 'test',
      number: 10
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.number > 9' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where number greater equal than', async () => {
    const result = await insertJson({
      _label: 'test',
      number: 10
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.number >= 10' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where number lesser than', async () => {
    const result = await insertJson({
      _label: 'test',
      number: 10
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.number < 11' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where number lesser equal than', async () => {
    const result = await insertJson({
      _label: 'test',
      number: 10
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.number <= 10' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where or', async () => {
    const result = await insertJson({
      _label: 'test',
      number: 10
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.number > 9 OR this.number < 5' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where and', async () => {
    const result = await insertJson({
      _label: 'test',
      number: 10,
      bool_prop: true
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'this.number = 10 AND this.bool_prop = true' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where not', async () => {
    const result = await insertJson({
      _label: 'test',
      number: 10
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: 'NOT this.number < 10' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where string starts with', async () => {
    const result = await insertJson({
      _label: 'test',
      str: 'abc'
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: "this.str STARTS WITH 'a'" }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where string ends with', async () => {
    const result = await insertJson({
      _label: 'test',
      str: 'abc'
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: "this.str ENDS WITH 'c'" }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where string contains', async () => {
    const result = await insertJson({
      _label: 'test',
      str: 'abc'
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: "this.str CONTAINS 'b'" }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('where in', async () => {
    const result = await insertJson({
      _label: 'test',
      list: ['a', 1, true]
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      _where: { filter: '1 IN this.list' }
    })
    expect([result]).toStrictEqual(findResult)
  })

  test('mandatory relationship', async () => {
    const result = await insertJson({
      _label: 'test',
      sub_rel: {
        _label: 'test2'
      }
    })
    await insertJson({
      _label: 'test'
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      sub_rel: {
        mandatory: true
      }
    })
    delete findResult[0].sub_rel._id
    expect(findResult).toStrictEqual([result])
  })

  test('optional relationship', async () => {
    const result = await insertJson({
      _label: 'test',
      sub_rel: {
        _label: 'test2'
      }
    })
    const result2 = await insertJson({
      _label: 'test3'
    })
    const findResult = await konekto.findByQueryObject({
      _label: ['test', 'test3'],
      sub_rel: {}
    })
    delete findResult[0].sub_rel._id
    expect(findResult).toStrictEqual([result, result2])
  })

  test('order relationship', async () => {
    const result = await insertJson({
      _label: 'test',
      rel: [
        {
          _label: 'test',
          prop: 'c'
        },
        {
          _label: 'test2',
          prop: 'a'
        }
      ]
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      rel: {
        _order: 'prop'
      }
    })
    delete findResult[0].rel[0]._id
    delete findResult[0].rel[1]._id
    result.rel = result.rel.reverse()
    expect([result]).toStrictEqual(findResult)
  })

  test('where relationship', async () => {
    const result = await insertJson({
      _label: 'test',
      rel: [
        {
          _label: 'test',
          prop: 'c'
        },
        {
          _label: 'test2',
          prop: 'a'
        }
      ]
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      rel: {
        _where: { filter: "this.prop = 'c'" }
      }
    })
    delete findResult[0].rel[0]._id
    result.rel.pop()
    expect([result]).toStrictEqual(findResult)
  })

  test('paginate relationship', async () => {
    const result = await insertJson({
      _label: 'test',
      rel: [
        {
          _label: 'test',
          prop: 'a'
        },
        {
          _label: 'test2',
          prop: 'b'
        },
        {
          _label: 'test2',
          prop: 'c'
        }
      ]
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      rel: {
        _skip: 1,
        _limit: 1
      }
    })
    delete findResult[0].rel[0]._id
    result.rel.shift()
    result.rel.pop()
    expect([result]).toStrictEqual(findResult)
  })

  test('relationship of relationship', async () => {
    const result = await insertJson({
      _label: 'test',
      rel: {
        _label: 'test2',
        sub_rel: {
          _label: 'test'
        }
      }
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      rel: {
        mandatory: true,
        sub_rel: {
          mandatory: true
        }
      }
    })
    delete findResult[0].rel._id
    delete findResult[0].rel.sub_rel._id
    expect([result]).toStrictEqual(findResult)
  })

  test('relationship of relationship of relationship', async () => {
    const result = await insertJson({
      _label: 'test',
      rel: {
        _label: 'test2',
        sub_rel: {
          _label: 'test',
          other_rel: {
            _label: 'test3'
          }
        }
      }
    })
    const findResult = await konekto.findByQueryObject({
      _label: 'test',
      rel: {
        mandatory: true,
        sub_rel: {
          mandatory: true,
          other_rel: {
            mandatory: true
          }
        }
      }
    })
    delete findResult[0].rel._id
    delete findResult[0].rel.sub_rel._id
    delete findResult[0].rel.sub_rel.other_rel._id
    expect([result]).toStrictEqual(findResult)
  })
})
