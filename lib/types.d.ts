declare module 'konekto' {
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

  export enum OrderOptions {
    ASCENDING = 'ASC',
    DESCENDING = 'DESC'
  }

  export enum NullOrderOptions {
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
}
