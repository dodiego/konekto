import Konekto from '../lib'
const konekto = new Konekto()

describe('find sql', () => {
  beforeAll(async () => {
    await konekto.connect()
    await konekto.createGraph('find_sql_test')
    await konekto.setGraph('find_sql_test')
    await konekto.raw({
      query: 'create table if not exists dates_find_sql_test (_id text primary key, test_date date, document json)'
    })
  })

  beforeEach(() => {
    konekto.setSqlMappings({
      test: {
        table: 'dates_find_sql_test',
        mappings: {
          test_date: { columnName: 'test_date' },
          document: { columnName: 'document' }
        }
      }
    })
  })

  afterEach(async () => {
    return konekto.deleteByQueryObject({
      _label: ['test', 'test2', 'test3', 'test4']
    })
  })

  afterAll(async () => {
    await konekto.raw({ query: 'drop table dates_find_sql_test' })
    return konekto.disconnect()
  })
  test('sql where equal', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    await konekto.createSchema(json)
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      _where: { filter: 'this._id = :id', params: { id } },
      _sqlWhere: { filter: 'test_date = :date', table: 'dates_find_sql_test', params: { date: '2013-07-09' } }
    })
    delete findResult._id
    expect(json).toStrictEqual(findResult)
  })

  test('sql where different', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      _where: { filter: 'this._id = :id', params: { id } },
      _sqlWhere: { filter: "test_date != '2013-07-10'", table: 'dates_find_sql_test' }
    })
    delete findResult._id
    expect(json).toStrictEqual(findResult)
  })

  test('sql where greater than', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      _where: { filter: 'this._id = :id', params: { id } },
      _sqlWhere: { filter: "test_date > '2013-07-08'", table: 'dates_find_sql_test' }
    })
    delete findResult._id
    expect(json).toStrictEqual(findResult)
  })

  test('sql where greater than equal', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      _where: { filter: 'this._id = :id', params: { id } },
      _sqlWhere: { filter: "test_date >= '2013-07-09'", table: 'dates_find_sql_test' }
    })
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql where lesser than', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      _where: { filter: 'this._id = :id', params: { id } },
      _sqlWhere: { filter: "test_date < '2013-07-10'", table: 'dates_find_sql_test' }
    })
    delete findResult._id
    expect(json).toStrictEqual(findResult)
  })

  test('sql where lesser than equal', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      _where: { filter: 'this._id = :id', params: { id } },
      _sqlWhere: { filter: "test_date <= '2013-07-09'", table: 'dates_find_sql_test' }
    })
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql where not', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      _where: { filter: 'this._id = :id', params: { id } },
      _sqlWhere: {
        filter: "NOT dates_find_sql_test.test_date = '2013-07-08'",
        table: 'dates_find_sql_test'
      }
    })
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql where greater than and lesser than', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      _where: { filter: 'this._id = :id', params: { id } },
      _sqlWhere: {
        filter: "dates_find_sql_test.test_date > '2013-07-08' AND test_date < '2019-07-10'",
        table: 'dates_find_sql_test'
      }
    })
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql where greater than or lesser than', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      _where: { filter: 'this._id = :id', params: { id } },
      _sqlWhere: {
        filter: "dates_find_sql_test.test_date > '2013-07-08' OR dates_find_sql_test.test_date < '2019-07-09'",
        table: 'dates_find_sql_test'
      }
    })
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql where boolean', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      _where: { filter: 'this._id = :id', params: { id } },
      _sqlWhere: { filter: "(test_date = '2013-07-09') and true", table: 'dates_find_sql_test' }
    })
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql where between', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      _where: { filter: 'this._id = :id', params: { id } },
      _sqlWhere: { filter: "test_date BETWEEN '2013-07-08' AND '2019-07-09'", table: 'dates_find_sql_test' }
    })
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql where cast', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      _where: { filter: 'this._id = :id', params: { id } },
      _sqlWhere: { filter: "test_date::text = '2013-07-09'", table: 'dates_find_sql_test' }
    })
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql where function', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      _where: { filter: 'this._id = :id', params: { id } },
      _sqlWhere: { filter: "date_part('year', test_date) = 2013", table: 'dates_find_sql_test' }
    })
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql projection', async () => {
    const json: any = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject(
      {
        _label: 'test',
        _where: { filter: 'this._id = :id', params: { id } },
        _sqlWhere: { filter: "date_part('year', test_date) = 2013", table: 'dates_find_sql_test' }
      },
      {
        customSqlProjections: {
          dates_find_sql_test: {
            year: "date_part('year', this.test_date )"
          }
        }
      }
    )
    json.year = 2013
    delete findResult._id

    expect(json).toStrictEqual(findResult)
  })

  test('sql substitution', async () => {
    const json = {
      _label: 'test',
      test_date: '2013-07-09'
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject(
      {
        _label: 'test',
        _where: { filter: 'this._id = :id', params: { id } },
        _sqlWhere: { filter: "date_part('year', test_date) = 2013", table: 'dates_find_sql_test' }
      },
      {
        customSqlProjections: {
          dates_find_sql_test: {
            test_date: "date_part('year', this.test_date)::text"
          }
        }
      }
    )
    json.test_date = '2013'
    delete findResult._id
    expect(json).toStrictEqual(findResult)
  })

  test('sql json', async () => {
    const json = {
      _label: 'test',
      document: {
        some_fields: 'NICE'
      }
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findOneByQueryObject({
      _label: 'test',
      _where: { filter: 'this._id = :id', params: { id } }
    })
    delete findResult._id
    expect(json).toStrictEqual(findResult)
  })

  test('find by id with sql', async () => {
    const json = {
      _label: 'test',
      document: {
        some_fields: 'NICE'
      }
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findById(id)
    delete findResult._id
    expect(json).toStrictEqual(findResult)
  })

  test('find with default read projection', async () => {
    konekto.setSqlMappings({
      test: {
        table: 'dates_find_sql_test',
        mappings: {
          test_date: { columnName: 'test_date' },
          document: { columnName: 'document', readProjection: 'this::text' }
        }
      }
    })
    const json: any = {
      _label: 'test',
      document: {
        some_fields: 'NICE'
      }
    }
    const id = await konekto.save(json)
    const findResult = await konekto.findById(id)
    delete findResult._id
    json.document = JSON.stringify(json.document)
    expect(json).toStrictEqual(findResult)
  })
})
