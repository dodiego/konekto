# Konekto

## What is it?

Konekto is an node.js OGM (Object-Graph Mapper) intended to be used with [AgensGraph](https://bitnine.net/) and
focused on simplicity.

## Why?

Konekto differs from any other Object-Whatever mapper because it doesn't require any
configuration to get started, this means that you don't have to create Models,
worry with migrations or trying to figure out how you gonna transform your objects to persist or query them.

## Requirements

You need a [Agensgraph](https://bitnine.net/agensgraph/) database running

### AgensGraph - Manual installation

Follow the instructions at https://bitnine.net/agensgraph-downloads/ for your operational system

### AgensGraph - Using Docker

`docker run -p 5432:5432 -it bitnine/agensgraph:v2.1.1 agens`

## Installation

`npm install konekto`  
or  
`yarn add konekto`

## Tutorial

### Creating the client

```javascript
const Konekto = require('konekto')
const konekto = new Konekto() // this needs a agensgraph running at postgresql://agens:agens@localhost:5432/agens
```

You can also pass a [connection string](https://node-postgres.com/features/connecting#connection-uri) or a [node-postgres client configuration object](https://node-postgres.com/features/connecting#programmatic)

```javascript
const Konekto = require('konekto')
const konekto = new Konekto({
  host: 'localhost',
  port: 5432,
  user: 'agens',
  pass: 'agens',
  database: 'agens'
})
```

```javascript
const Konekto = require('konekto')
const user = 'agens'
const password = 'agens'
const host = 'localhost'
const port = 5432
const database = 'agens'
const konekto = new Konekto(`postgresql://${user}:${password}@${host}:${port}/${database}`)
```
