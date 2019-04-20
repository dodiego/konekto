const Aghanim = require('../lib')
const { label } = require('../lib/utils')
const aghanim = new Aghanim()

let json
let jsonDb

beforeAll(async () => {
  await aghanim.connect()
  await aghanim.setGraph('agens_graph')
})

beforeEach(async () => {
  json = {
    [label]: 'test',
    name: 'def',
    rel1: {
      [label]: 'test2',
      number: 10
    },
    rel2: [
      {
        [label]: 'test3',
        name: 'abc',
        sub_rel: {
          [label]: 'test2',
          number: 5,
          deeper_rel: {
            [label]: 'test4',
            value: 'xd'
          }
        }
      },
      {
        [label]: 'test3',
        name: 'ghi',
        sub_rel: [
          {
            [label]: 'test',
            bool_property: false
          },
          {
            [label]: 'test2',
            number: 15
          }
        ]
      },
      {
        [label]: 'test3',
        date: new Date().toISOString()
      }
    ]
  }
  await aghanim.createSchema(json)
  jsonDb = await aghanim.save(json)
})

afterEach(() => {
  return aghanim.deleteByQueryObject({
    [label]: [ 'test', 'test2', 'test3', 'test4' ]
  })
})

afterAll(() => {
  return aghanim.disconnect()
})

test('find by id', async () => {
  let result = await aghanim.findById(jsonDb._id)
  result.rel2 = result.rel2.sort((a, b) => a.name.localeCompare(b.name))
  result.rel2[1].sub_rel = result.rel2[1].sub_rel.sort((a, b) => a[label].localeCompare(b[label]))
  expect(result).toEqual(jsonDb)
})

test('find by label', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: 'test'
  })
  expect(result.length).toBe(2)
})

test('find by multiple labels', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: [ 'test', 'test2', 'test3', 'test4' ]
  })
  expect(result.length).toBe(9)
})

test('order by field', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: [ 'test', 'test3' ],
    order: 'name'
  })
  expect(result.map(n => n.name)).toEqual([ 'abc', 'def', 'ghi', undefined, undefined ])
})

test('order by field desceding', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: [ 'test', 'test3' ],
    order: '!name'
  })
  expect(result.map(n => n.name)).toEqual([ undefined, undefined, 'ghi', 'def', 'abc' ])
})

test('skip', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: [ 'test3' ],
    skip: 2
  })
  expect(result.map(n => n.name)).toEqual([ undefined ])
})

test('limit', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: [ 'test', 'test3' ],
    limit: 2
  })
  expect(result.map(n => n.name)).toEqual([ 'def', undefined ])
})

test('paginate', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: [ 'test3', 'test' ],
    limit: 2,
    skip: 1,
    order: 'name'
  })
  expect(result.map(n => n.name)).toEqual([ 'def', 'ghi' ])
})

test('where equals', async () => {
  let result = await aghanim.findByQueryObject({
    where: 'number = 15'
  })
  expect(result).toEqual([ jsonDb.rel2[1].sub_rel[1] ])
})
test('where boolean', async () => {
  let result = await aghanim.findByQueryObject({
    where: 'bool_property = false'
  })
  expect(result).toEqual([ jsonDb.rel2[1].sub_rel[0] ])
})

test('where number greater than', async () => {
  let result = await aghanim.findByQueryObject({
    where: 'number > 14'
  })
  expect(result).toEqual([ jsonDb.rel2[1].sub_rel[1] ])
})

test('where number greater equal than', async () => {
  let result = await aghanim.findByQueryObject({
    where: 'number >= 15'
  })
  expect(result).toEqual([ jsonDb.rel2[1].sub_rel[1] ])
})

test('where number lesser than', async () => {
  let result = await aghanim.findByQueryObject({
    where: 'number < 6'
  })
  delete jsonDb.rel2[0].sub_rel.deeper_rel
  expect(result).toEqual([ jsonDb.rel2[0].sub_rel ])
})

test('where number lesser equal than', async () => {
  let result = await aghanim.findByQueryObject({
    where: 'number <= 5'
  })
  delete jsonDb.rel2[0].sub_rel.deeper_rel
  expect(result).toEqual([ jsonDb.rel2[0].sub_rel ])
})

test('where or', async () => {
  let result = await aghanim.findByQueryObject({
    where: 'number = 15 OR number = 10'
  })
  expect(result).toEqual([ jsonDb.rel1, jsonDb.rel2[1].sub_rel[1] ])
})

test('where string starts with', async () => {
  let result = await aghanim.findByQueryObject({
    where: 'name STARTSWITH "a"'
  })
  delete jsonDb.rel2[0].sub_rel
  expect(result).toEqual([ jsonDb.rel2[0] ])
})

test('where string ends with', async () => {
  let result = await aghanim.findByQueryObject({
    where: 'name ENDSWITH "c"'
  })
  delete jsonDb.rel2[0].sub_rel
  expect(result).toEqual([ jsonDb.rel2[0] ])
})

test('mandatory relationship', async () => {
  let result = await aghanim.findByQueryObject({
    sub_rel: {
      mandatory: true
    }
  })
  let nodeIndex = jsonDb.rel2.findIndex(n => n.date)
  jsonDb.rel2.splice(nodeIndex, 1)
  delete jsonDb.rel2[0].sub_rel.deeper_rel
  expect(result).toEqual(expect.arrayContaining(jsonDb.rel2))
})

test('optional relationship', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: 'test3',
    sub_rel: {}
  })
  delete jsonDb.rel2[0].sub_rel.deeper_rel
  expect(result).toEqual(expect.arrayContaining(jsonDb.rel2))
})

test('order relationship', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: 'test3',
    sub_rel: {
      order: 'number'
    }
  })
  delete jsonDb.rel2[0].sub_rel.deeper_rel
  jsonDb.rel2[1].sub_rel = jsonDb.rel2[1].sub_rel.sort((a, b) => (a.number && b.number ? a.number > b.number : 1))
  expect(result).toEqual(jsonDb.rel2)
})

test('where relationship', async () => {
  let result = await aghanim.findByQueryObject({
    sub_rel: {
      where: 'name = "abc"'
    }
  })
  jsonDb.rel2.pop()
  jsonDb.rel2.pop()
  delete jsonDb.rel2[0].sub_rel.deeper_rel
  expect(result).toEqual(jsonDb.rel2)
})

test('paginate relationship', async () => {
  let result = await aghanim.findByQueryObject({
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
  let result = await aghanim.findByQueryObject({
    rel2: {
      mandatory: true,
      sub_rel: {
        mandatory: true
      }
    }
  })
  delete jsonDb.rel1
  delete jsonDb.rel2[0].sub_rel.deeper_rel
  expect(result).toEqual([ jsonDb ])
})

test('relationship of relationship of relationship', async () => {
  let result = await aghanim.findByQueryObject({
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
  expect(result).toEqual([ jsonDb ])
})
