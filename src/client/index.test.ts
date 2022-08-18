import { getClient } from './index'

const postgresServerUrl = 'postgres://konekto:konekto@localhost:5432/konekto'

describe('Postgres Client', () => {
  it('Should be able to connect and disconnect from database', async () => {
    const client = await getClient(postgresServerUrl)

    await client.disconnect()
  })
  it('Should be able to execute a sql query and return result', async () => {
    const client = await getClient(postgresServerUrl)

    const queryResult = await client.query({
      query: 'select version()'
    })

    expect(queryResult).toStrictEqual([
      {
        version:
          'PostgreSQL 11.16 (Debian 11.16-1.pgdg90+1) on x86_64-pc-linux-gnu, compiled by gcc (Debian 6.3.0-18+deb9u1) 6.3.0 20170516, 64-bit'
      }
    ])

    await client.disconnect()
  })
})
