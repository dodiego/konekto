const Aghanim = require('../lib')
const { label } = require('../lib/utils')
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
        [label]: 'test2',
        date: new Date()
      }
    ]
  }
  await aghanim.createSchema(json)
  jsonDb = await aghanim.save(json)

  jsonDb.rel2 = jsonDb.rel2.sort((a, b) => a.name.localeCompare(b.name))
  jsonDb.rel2[1].sub_rel = jsonDb.rel2[1].sub_rel.sort((a, b) => a[label].localeCompare(b[label]))
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
  expect(result.length).toBe(8)
})

test('order by field', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: [ 'test' ],
    order: 'name'
  })
  expect(result.map(n => n.name)).toEqual([ 'abc', 'def', 'ghi', undefined ])
})

test('order by field desceding', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: [ 'test' ],
    order: '!name'
  })
  expect(result.map(n => n.name)).toEqual([ undefined, 'ghi', 'def', 'abc' ])
})

test('skip', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: [ 'test' ],
    skip: 2
  })
  expect(result.map(n => n.name)).toEqual([ 'ghi', undefined ])
})

test('limit', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: [ 'test' ],
    limit: 2
  })
  expect(result.map(n => n.name)).toEqual([ 'def', 'abc' ])
})

test('paginate', async () => {
  let result = await aghanim.findByQueryObject({
    [label]: [ 'test' ],
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
  expect(result).toEqual([ jsonDb.rel2[0].sub_rel ])
})

test('where number lesser equal than', async () => {
  let result = await aghanim.findByQueryObject({
    where: 'number <= 5'
  })
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

  result = result.sort((a, b) => a.name.localeCompare(b.name))
  result[1].sub_rel = result[1].sub_rel.sort((a, b) => a[label].localeCompare(b[label]))

  expect(result).toEqual(jsonDb.rel2)
})
