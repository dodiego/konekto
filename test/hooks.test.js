const Konekto = require('../lib')
const konekto = new Konekto()

describe('hooks', () => {
  beforeAll(async () => {
    await konekto.connect()
    await konekto.createGraph('hooks_test')
    await konekto.setGraph('hooks_test')
  })

  describe('beforeCreate', () => {
    test('hide root node', async () => {
      const json = {
        _label: 'test',
        omegalul: 'xd'
      }
      await konekto.createSchema(json)
      const saveResult = await konekto.save(json, {
        hooks: {
          beforeCreate () {
            return false
          }
        }
      })
      expect(saveResult).toBeUndefined()
    })
    test('hide related node', async () => {
      const json = {
        _label: 'test',
        omegalul: 'xd',
        related: {
          _label: 'test2',
          kek: 'w'
        }
      }
      await konekto.createSchema(json)
      const saveResult = await konekto.save(json, {
        hooks: {
          beforeCreate (node) {
            if (node._label === 'test2') {
              return false
            }
            return true
          }
        }
      })
      delete saveResult._id
      delete json.related
      expect(saveResult).toStrictEqual(json)
    })
    test('hide related graph', async () => {
      const json = {
        _label: 'test',
        omegalul: 'xd',
        related: {
          _label: 'test2',
          kek: 'w',
          sub_related: {
            _label: 'test3',
            wat: 'js'
          }
        }
      }
      await konekto.createSchema(json)
      const saveResult = await konekto.save(json, {
        hooks: {
          beforeCreate (node) {
            if (node._label === 'test2') {
              return false
            }
            return true
          }
        }
      })
      delete json.related
      delete saveResult._id
      expect(saveResult).toStrictEqual(json)
    })

    test('hide related sub graph', async () => {
      const json = {
        _label: 'test',
        omegalul: 'xd',
        related: {
          _label: 'test2',
          kek: 'w',
          sub_related: {
            _label: 'test3',
            wat: 'js',
            deeper_related: {
              _label: 'test4',
              sadim: true
            }
          }
        }
      }
      await konekto.createSchema(json)
      const saveResult = await konekto.save(json, {
        hooks: {
          beforeCreate (node) {
            if (node._label === 'test3') {
              return false
            }
            return true
          }
        }
      })
      delete saveResult._id
      delete saveResult.related._id
      delete json.related.sub_related
      expect(saveResult).toStrictEqual(json)
    })
  })

  afterEach(() => {
    return konekto.deleteByQueryObject({
      _label: ['test', 'test2', 'test3', 'test4']
    })
  })

  afterAll(() => {
    return konekto.disconnect()
  })
})
