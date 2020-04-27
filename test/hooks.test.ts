import Konekto from '../lib'
const konekto = new Konekto()

describe('hooks', () => {
  beforeAll(async () => {
    await konekto.connect()
    await konekto.createGraph('hooks_test')
    await konekto.setGraph('hooks_test')
  }, 3000)

  afterEach(() => {
    return konekto.deleteByQueryObject({
      _label: ['test', 'test2', 'test3', 'test4']
    })
  })

  afterAll(async () => {
    await konekto.disconnect()
  }, 3000)

  describe('beforeSave', () => {
    test('should throw error when hook returns false on root node', async () => {
      const json = {
        _label: 'test',
        omegalul: 'xd'
      }
      await konekto.createSchema(json)
      expect(
        konekto.save(json, {
          hooks: {
            beforeSave() {
              return false
            }
          }
        })
      ).rejects.toThrowError()
    })
    test('should throw error when hook returns false on related node', async () => {
      const json = {
        _label: 'test',
        omegalul: 'xd',
        related: {
          _label: 'test2',
          kek: 'w'
        }
      }
      await konekto.createSchema(json)
      expect(
        konekto.save(json, {
          hooks: {
            beforeSave(node) {
              return false
            }
          }
        })
      ).rejects.toThrowError()
    })
  })
})
