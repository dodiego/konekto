## Overview

### What

Konekto is an object-graph mapper for [agensgraph](https://bitnine.net/agensgraph/)

### Why

When persisting data, people usually choose one over two solutions:

- Relational databases ([Postgres](https://www.postgresql.org/), [MySQL](https://www.mysql.com/), etc)

- Document ([Mongodb](https://www.mongodb.com/))

There are some pros and cons with each one:

- Relational databases

- Pros:

- Data in different sources is connected through foreign keys

- Very robust and mature (around since middle 70's) and heavily used until present day

- Great ecossistem and many production-ready solutions out of the box

- Great data consistency trough schema definitions

- Cons:

- Schema changes require migrations and these become harder and harder as the database grows in complexity

- Low flexibility and way harder to build systems that rely on dynamic data

- Document databases

- Pros:

- Highly flexible data, you can basically store any json and it just works

- Since data is dynamic, migrations are not needed and it is very easy to scale applications from simple to complex ones.

- Cons:

- No relation between data, you must store all related data in a single document

So, you either go to strongly typed and related data or highly dynamic and unrelated data. There are forms that you can work around the cons of each solution, but you require some extra knowledge, do some work of your own and the chances of things getting messy are quite high. What can we do, then?

#### Graphs FTW

Graph databases are great because the data is dynamic and related to each other, you get the flexibility of documents and the relations of relational databases, futhermore, graph database handle connected data far better than relational ones due its nature (you can check more about this [right here](https://neo4j.com/blog/demining-the-join-bomb-with-graph-queries/))

### Requirements

You need a [Agensgraph](https://bitnine.net/agensgraph/) database running

#### AgensGraph - Manual installation

Follow the instructions at https://bitnine.net/agensgraph-downloads/ for your operational system

#### AgensGraph - Using Docker

`docker run -p 5432:5432 -it bitnine/agensgraph:v2.1.1 agens`

### Installation

`npm install konekto`

### Getting Started

```javascript

const Konekto =  require('konekto')const user =  'agens'const password =  'agens'const host =  'localhost'const port = 5432const database =  'agens'const konekto =  new  Konekto(`postgresql://${user}:${password}@${host}:${port}/${database}`)async  function  run () { // connecting to the database await konekto.connect() const json = { _label: "xd", some_prop: "lul", some_relationship: { _label: "omegalul", other_prop: 1 } } // creating some basic schema await konekto.createSchema(json) // inserting data const id = await konekto.save(json) json._id = id json.more_prop = true, // adding more properties json.some_prop = undefined // removing properties // updating data in the database await konekto.save(json) // querying const jsonDb = await konekto.findById(id) // updating related data jsonDb.some_relationship.other_prop = 1.5 await konekto.save(jsonDb.some_relationship) // delete data await konekto.deleteById(id) // when deleting by id, you delete individual jsons, not the whole graph const relatedJsonDb = await konekto.findById(jsonDb.some_relationship._id) relatedJsonDb !== undefined && relatedJsonDb.other_prop === jsonDb.some_relationship // true}
```

## Core concepts

### Label

a name that indicates where a node or a relationship should be stored (think of it as table or collection name)

#### Rules:

- must be a string

- must be lowercase

- only alhanumeric characters and `_` is allowed

- must stard with `_` or a letter

#### Examples:

- `"label"`

- `"other_label"`

- `"other_label2"`

- `"_another_label"`

### Node

Any json which all keys map to primitive values or arrays that contains primitive values

#### Rules:

- all property names must follow the same rules as [labels](#label-rules)

- all nodes must have a property `_label` which the value follow the same rules as [labels](#label-rules) and it defines where the node will be stored

#### Examples:

- empty node

```javascript

{ "_label": "some_label"}
```

- node with some simple values

```javascript

{ "_label": "other_label", "str_prop": "xd", "number_prop": 1, "boolean_prop": true,}
```

- node with array

```javascript

{ "_label": "some_label", "array_prop": [1, null, "aaa", { "xd": "lul"}]}
```

### Relationship

a json property where the value is a json or an array of jsons. The relationship name is the property key itself.

#### Rules:

- the property key name follow the same rules as [labels](label-rules)

- when referencing an array, the array must contain ONLY jsons, otherwise it will be saved as a simple property in the node

#### Examples:

- relating two nodes

```javascript

{ "_label": "label1", "some_rel": { "_label": "label2" }}
```

- relating two nodes and saving it as a relationship array

```javascript

{ "_label": "label1", "some_rel": [{ "_label": "label2" }]}
```

- relating various nodes in a relationship array

```javascript

{ "_label": "a", "rel": [ {"_label": "b"}, {"_label": "a"}, {"_label": "c"} ]}
```

## Saving Data

Konekto uses only one method for inserting and updating data to the database: `save`.

### How it works

When calling save, konekto will iterate recursively on every object present on the json passed and will create/update all the nodes and relationships that it encouters following some rules:

- if the object doesn't have a property `_label`, an error will be thrown

- if the object have a property `_id` and the id exists in the database, a update on that node will be performed, adding, modifying or deleting properties

- if the object have a property `_id` and the id doesn't exist in the database, a insert will be made with the passed `_id`

- if the object doesn't have a property `_id`, konekto will generate a `_id` and will insert the node

### Examples:

#### insert one node

```javascript
let rootId = await konekto.save({ _label: 'mylabel' })
```

#### insert node with custom id

```javascript
let rootId = await konekto.save({
  _label: 'mylabel',
  _id: 'myCustomId'
}) // rootId = "myCustomId"
```

#### update node

```javascript
let rootId = await konekto.save({
  _label: 'mylabel',
  some_prop: 'xd',
  some_num: 10
})
await konekto.save({
  _label: 'mylabel',
  _id: rootId,
  other_prop: true, // adding new property
  some_num: null, // deleting old property
  some_prop: 5.2 // updating old property
})
```

#### insert and relate two new nodes

```javascript
await konekto.save({
  _label: 'mylabel',
  some_rel: { _label: 'other_label' }
})
```

#### add relationship to existing node

```javascript
    const json = {
      _label: 'test1'
    }
    const rel = {
      _label: 'test2',
      omegalul: 'xd'
    }
    const id = await konekto.save(json)
    await konekto.save({
      _label: 'test1' // use _label + _id to reference an existent node
      _id: id,
      rel
    })
```

#### saving value as object instead of node + relationship

```javascript
await konekto.save({
  _label: 'test1',
  prop: {
    _json: true,
    a: true
  }
})
```

## Querying data

There are two methods to query data:

- findById

- findByQueryObject

### FindById
