import Konekto from './lib/index.js'

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

export default Konekto
