declare module 'konekto' {
  interface PropertyMap {
    [label: string]: {
      table: string
      mappings: {
        [key: string]: {
          columnName: string
          writeProjection?: string
        }
      }
    }
  }

  enum OrderOptions {
    ASCENDING = 'ASC',
    DESCENDING = 'DESC'
  }

  enum NullOrderOptions {
    FIRST = 'FIRST',
    LAST = 'LAST'
  }

  interface CreateIndexOptions {
    unique?: boolean
    type?: string
    order?: OrderOptions
    nullOrder?: NullOrderOptions
    where?: string
  }
}
