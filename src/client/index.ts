import { Pool } from 'pg'

export async function getClient(serverUrl: string) {
  const pool = new Pool({
    connectionString: serverUrl
  })

  return {
    query: async (statement: { query: string; parameters?: [] }) => {
      const result = await pool.query(statement.query, statement.parameters)

      return result.rows
    },
    disconnect: () => pool.end()
  }
}
