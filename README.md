# Aghanim
 
## What is it?
Aghanim is an node.js OGM (Object-Graph Mapper) intended to be used with neo4j and
focused on simplicity.

## Why?
Aghanim differs from any other Object-Whatever mapper because it doesn't require any
configuration to get started, this means that you don't have to create Models,
worry with migrations or trying to figure out how you gonna break your objects to persist or query them.

## Getting Started

### Requirements

You need a [neo4j](https://neo4j.com/download/) database running

### Installation

`npm install aghanim` or `yarn add aghanim`

### Usage

```javascript
const Aghanim = require('aghanim')
const aghanim = new Aghanim() // this needs a local neo4j with disabled auth running
```
or

```javascript
const Aghanim = require('aghanim')
const aghanim = require({
  host: 'localhost', // defauts to 'localhost'
  protocol: 'bolt', // defaults to 'bolt'
  auth: { // not required if you disabed auth
    username: 'neo4j',
    password: 'neo4j'
  }
})
```

