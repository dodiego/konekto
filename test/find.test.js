const Aghanim = require('../lib')
const { label, order, skip, limit, where } = require('../lib/utils')
const aghanim = new Aghanim({
  user: 'agens',
  pass: 'agens',
  db: 'agens'
})

let json
let jsonDb

beforeAll(async () => {
  await aghanim.connect('agens_graph')
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
        [label]: 'test',
        name: 'abc',
        sub_rel: {
          [label]: 'test2',
          number: 5
        }
      },
      {
        [label]: 'test',
        name: 'ghi',
        sub_rel: [
          {
            [label]: 'test'
          },
          {
            [label]: 'test2',
            number: 15
          }
        ]
      }
    ]
  }
  await aghanim.createSchema(json)
  jsonDb = await aghanim.save(json)
})

afterEach(() => {
  return aghanim.deleteByQueryObject({ [label]: [ 'test', 'test2' ] })
})

afterAll(() => {
  return aghanim.disconnect()
})

test('find by id', async () => {
  let result = await aghanim.findById(jsonDb._id)
  expect(result).toEqual(jsonDb)
})

test('find by label', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: 'test'
  })
  expect(result.length).toBe(4)
})

test('find by multiple labels', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: [ 'test', 'test2' ]
  })
  expect(result.length).toBe(7)
})

test('order by field', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: [ 'test' ],
    [order]: 'name'
  })
  expect(result.map(n => n.name)).toEqual([ 'abc', 'def', 'ghi', undefined ])
})

test('order by field desceding', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: [ 'test' ],
    [order]: '!name'
  })
  expect(result.map(n => n.name)).toEqual([ undefined, 'ghi', 'def', 'abc' ])
})

test('skip', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: [ 'test' ],
    [skip]: 2
  })
  expect(result.map(n => n.name)).toEqual([ 'ghi', undefined ])
})

test('limit', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: [ 'test' ],
    [limit]: 2
  })
  expect(result.map(n => n.name)).toEqual([ 'def', 'abc' ])
})

test('paginate', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: [ 'test' ],
    [limit]: 2,
    [skip]: 1,
    [order]: 'name'
  })
  expect(result.map(n => n.name)).toEqual([ 'def', 'ghi' ])
})

test('where equals', async () => {
  let result = await aghanim.findByQueryObject({
    [where]: 'number = 15'
  })
  expect(result).toEqual([ jsonDb.rel2[1].sub_rel[1] ])
})

test('where number greater than', async () => {
  let result = await aghanim.findByQueryObject({
    [where]: 'number > 14'
  })
  expect(result).toEqual([ jsonDb.rel2[1].sub_rel[1] ])
})

test('where number greater equal than', async () => {
  let result = await aghanim.findByQueryObject({
    [where]: 'number >= 15'
  })
  expect(result).toEqual([ jsonDb.rel2[1].sub_rel[1] ])
})

test('where number lesser than', async () => {
  let result = await aghanim.findByQueryObject({
    [where]: 'number < 6'
  })
  expect(result).toEqual([ jsonDb.rel2[0].sub_rel ])
})

test('where number lesser equal than', async () => {
  let result = await aghanim.findByQueryObject({
    [where]: 'number <= 5'
  })
  expect(result).toEqual([ jsonDb.rel2[0].sub_rel ])
})

test('where or', async () => {
  let result = await aghanim.findByQueryObject({
    [where]: 'number = 15 OR number = 10'
  })
  expect(result).toEqual([ jsonDb.rel1, jsonDb.rel2[1].sub_rel[1] ])
})

test('where string starts with', async () => {
  let result = await aghanim.findByQueryObject({
    [where]: 'name STARTSWITH "a"'
  })
  delete jsonDb.rel2[0].sub_rel
  expect(result).toEqual([ jsonDb.rel2[0] ])
})

test('where string ends with', async () => {
  let result = await aghanim.findByQueryObject({
    [where]: 'name ENDSWITH "c"'
  })
  delete jsonDb.rel2[0].sub_rel
  expect(result).toEqual([ jsonDb.rel2[0] ])
})
