export interface PropertyMap {
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

declare enum OrderOptions {
  ASCENDING = 'ASC',
  DESCENDING = 'DESC'
}

declare enum NullOrderOptions {
  FIRST = 'FIRST',
  LAST = 'LAST'
}

export interface CreateIndexOptions {
  unique?: boolean
  type?: string
  order?: OrderOptions
  nullOrder?: NullOrderOptions
  where?: string
}
