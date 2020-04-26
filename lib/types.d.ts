declare interface PropertyMap {
  [label: string]: {
    table: string
    mappings: {
      [key: string]: {
        columnName: string
        writeProjection?: string
        readProjection?: string
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

declare interface CreateIndexOptions {
  unique?: boolean
  type?: string
  order?: OrderOptions
  nullOrder?: NullOrderOptions
  where?: string
}
