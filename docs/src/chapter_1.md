## Installation

`npm install konekto`

## Overview

Konekto is an object-graph mapper for [agensgraph](https://bitnine.net/agensgraph/)

## Motivation

When persisting data, people usually choose one over two solutions:

-   Relational databases ([Postgres](https://www.postgresql.org/), [MySQL](https://www.mysql.com/), etc)
    
-   Document ([Mongodb](https://www.mongodb.com/))
    

There are some pros and cons with each one:

-   Relational databases
    
    -   Pros:
        
        -   Data in different sources is connected through foreign keys
        -   Very robust and mature (around since middle 70's) and heavily used until present day
        -   Great ecossistem and many production-ready solutions out of the box
        -   Great data consistency trough schema definitions
    -   Cons:
        
        -   Schema changes require migrations and these become harder and harder as the database grows in complexity
        -   Low flexibility and way harder to build systems that rely on dynamic data
-   Document databases
    
    -   Pros:
        
        -   Highly flexible data, you can basically store any json and it just works
        -   Since data is dynamic, migrations are not needed and it is very easy to scale applications from simple to complex ones.
    -   Cons:
        
        -   No relation between data, you must store all related data in a single document

So, you either go to strongly typed and related data or highly dynamic and unrelated data. There are forms that you can work around the cons of each solution, but you require some extra knowledge, do some work of your own and the chances of things getting messy are quite high. What can we do, then?

#### Graphs FTW

Graph databases are great because the data is dynamic and related to each other, you get the flexibility of documents and the relations of relational databases, futhermore, graph database handle connected data far better than relational ones due its nature (you can check more about this [right here](https://neo4j.com/blog/demining-the-join-bomb-with-graph-queries/))

## Requirements

You need a [Agensgraph](https://bitnine.net/agensgraph/) database running

### AgensGraph - Manual installation

Follow the instructions at https://bitnine.net/agensgraph-downloads/ for your operational system

### AgensGraph - Using Docker

`docker run -p 5432:5432 -it bitnine/agensgraph:v2.1.1 agens`

## Concepts

### Labels

A label is a name that indicates where a [node](#nodes) should be stored (you can think of it as table or collection name)

#### Rules

- must be a string
- must be lowercase
- only alhanumeric characters and `_` is allowed
- must stard with `_` or a letter

#### Examples

-   `"label"`
-   `"other_label"`    
-   `"other_label2"` 
-   `"_another_label"`

### Nodes

A node is a JSON where every property value is a primitive value.

#### Primitive values
- Number
- String
- Date
- Boolean
- JSON with a property `_document: true`
- Array where some item is a primitive type

#### Rules
- Every node must have a property `_label: '<some_string>'` to specify the label of that node
- Every property key must follow the same rules as [labels](#labels)

#### Examples

-   empty node
```javascript
{ "_label": "some_label"}
```

-   node with some simple values
```javascript
{ 
  "_label": "other_label", 
  "str_prop": "xd", 
  "number_prop": 1, 
  "boolean_prop": true
}
```

-   node with array
```javascript
{ 
  "_label": "some_label", 
  "array_prop": [1, null, "aaa", { "xd": "lul"}]
}
```

- node with json property
```javascript
{
  "_label": "label",
  "complex_prop": {
    "_document": true,
    "properties here": "have no naming rules",
    "nestedObject": {
      "description": "only the root object must have the _document annotiation, everything inside is treated as a regular json"
    }
  }
}
```

### Relationship

A relationship is a connection between two or more nodes and it is represented as a property whose value is a json or an array of jsons, where the json must be a valid [node](#node)

#### Rules
- the property key name must follow the same rules as [labels](#labels)
- when referencing an array, the array must contain ONLY jsons that are valid [nodes](#nodes), otherwise it will be saved as a simple property in the node

#### Examples 

For the next examples, lets consider the following nodes:

```javascript
const nodeA = { "_label": "parent" }
const nodeB = { "_label": "related" }
const nodeC = { "_label": "related2" }
```

- Creating a relationship named "some_relation" from `nodeA` to `nodeB`
```javascript
nodeA.some_relation = nodeB
```

- Creating a relationship named "other_relation" from `nodeA` to `nodeB` and `nodeC`
```javascript
nodeA.other_relation = [nodeB, nodeC]
```
- Creating a single element relationship array named "another_relation" from `nodeA` to `nodeC`
```javascript
nodeA.another_relation = [nodeC]
```

## Visualizing a JSON as a graph

Lets use a more realistic example for this and build a family graph, consider the following jsons:
```javascript
const father = {_label: "person", _id: "father", name: "Kratos", god: true, height: 210}
const mother = {_label: "person", _id: "mother", name: "Faye", god: false, height: 180}
const child = {_label: "person", _id: "child", name: "Atreus", height: 160, god: true}
const dog = {_label: "animal", _id: "dog", name: "Fenrir"}
const aslan = {_label: "mythical", _id: "aslan"}
const narnia = {_label: "place", _id: "narnia"}
```

For now, there is no connection between the them, so lets create some:
```javascript
father.is_married_with = mother
mother.is_married_with = father
child.parents = [father, mother]
father.owns = dog
child.owns = dog
mother.owns = dog
child.imaginary_friends = [aslan]
aslan.lives_in = narnia
```

Now, we can visualize the entire graph as a json array:
```javascript
[{
  _id: "father",
  _label: "person",
  name: "Kratos",
  god: true,
  height: 210,
  is_married_with: {_id: "mother"},
  owns: {_id: "dog"}
}, {
  _id: "mother",
  _label: "person",
  name: "Faye",
  god: false,
  height: 180,
  is_married_with: {_id: "father"},
  owns: {_id: "dog"}
}, {
  _id: "child",
  _label: "person",
  name: "Atreus",
  height: 160,
  god: true,
  parents: [{_id: "father"}, {_id: "mother"}],
  owns: {_id: "dog"},
  imaginary_friends: [{_id: "aslan"}]
}, {
  _id: "dog",
  _label: "animal",
  name: "Fenrir"
},{
  _íd: "aslan",
  _label: "mythical",
  lives_in: {_id: "narnia"}
}, {
  _id: "narnia",
  _label: "place"
}]
```

The structure itself is pretty self explanatory, reading the graph we can tell that:
- we reference nodes by using its ids
- father, mother and child are persons
- father and mother are married to each other
- child have mother and father as parents
- father, mother and child owns a dog, which is an animal
- child have an imaginary friend, but it can have more in the future (currently it's a single element array)
- the imaginary friend lives in narnia
- narnia is a place

Now that you know the basic concepts and how to visualize json as graph, lets start using Konekto!

## Writing data with save

Konekto only have one method for both insert and update, which is `save`.

### How it works

When calling save, konekto will iterate recursively on every object present on the json passed and will create/update all the nodes and relationships that it encouters following some rules:

-   if the node doesn't have a property `_label`, an error will be thrown
-   if the node have a property `_id` and the id exists in the database, a update on that node will be performed, adding, modifying or deleting properties    
-   if the node have a property `_id` and the id doesn't exist in the database, a insert will be made with the passed `_id`
-   if the node doesn't have a property `_id`, konekto will generate a `_id` and will insert the node
- Existing relationships are preserved and new ones are created

### Usage

#### Insert graph

Lets create the graph of the [previous section](#visualizing-a-json-as-a-graph)
```javascript
await konekto.save([{
  _id: "father",
  _label: "person",
  name: "Kratos",
  god: true,
  height: 210,
  is_married_with: {_id: "mother"},
  owns: {_id: "dog"}
}, {
  _id: "mother",
  _label: "person",
  name: "Faye",
  god: false,
  height: 180,
  is_married_with: {_id: "father"},
  owns: {_id: "dog"}
}, {
  _id: "child",
  _label: "person",
  name: "Atreus",
  height: 160,
  parents: [{_id: "father"}, {_id: "mother"}],
  owns: {_id: "dog"},
  imaginary_friends: [{_id: "aslan"}]
}, {
  _id: "dog",
  _label: "animal",
  name: "Fenrir"
},{
  _íd: "aslan",
  _label: "mythical",
  lives_in: {_id: "narnia"}
}, {
  _id: "narnia",
  _label: "place"
}])
```

Now that we have some data and we used custom ids for every node, we can perform some update operations:

#### Update a single node

```javascript
await konekto.save({
  _id: "father",
  _label: "person", // we need _id + _label to reference a node
  age: 30 // adding new property
```

#### Update multiple nodes

```javascript
await konekto.save([{
  _id: "fater",
  _label: "person",
  age: null // setting a property to null or undefined will delete that property
}, {
  _id: "mother",
  _label: "person",
  job_title: "programmer"
}]) // this call will update both father and mother nodes

await konekto.save({
  _id: "child",
  _label: "person",
  age: 4,
  parents: {
    _id: "father",
    _label: "person",
    job_title: "data scientist"
  } // the "parents" relationship between child and father already exists,   so its unaltered
}) // updates child and father with a new property
```

#### Insert new nodes and relate with existing ones

```javascript
await konekto.save({
  _id: "child",
  _label: "person",
  age: 4, // update property with new value
  owns: {
    _label: "toy",
    _id: "toy",
    name: "car toy"
  } 
}) // now child owns a dog and a toy, the "owns" relationship of child is now an array
```

#### relate two existing nodes

```javascript
await konekto.save({
  _id: "dog",
  _label: "animal",
  destroyed: [{_id: "toy", _label: "toy"}]
}) // both dog and toy exists, but the "destroyed" relationship didn't, so it's created
```

#### saving jsons as documents

```javascript
await konekto.save({
  _id: "toy",
  _label: "toy",
  current_specs: {
    wheels: 3,
    color: "rusty",
    doors: false,
    _document: true
  }
})
```

## Querying data with the query object

Lets consider that we want to query some data from [this graph](#visualizing-a-json-as-a-graph)

### Query all data

Just pass an empty object to `findByQueryObject` and you get an array of every node in the database

```javascript
const nodes = await konekto.findByQueryObject({})
console.log(nodes)
```

You will notice that  `nodes` is a flat array, with every node in the database, but no relationship between them, lets leave it like that for now, we will show later how to query nodes and their relationships .

### Filtering with _where

Well, querying every single node seems a bit of a overkill, we need to filter some of that result to get something more useful, here we gonna introduce the first operator of the query object: `_where`.

`_where` is a property of the query object and its value is a json with two fields: `filter` (which is mandatory) and `params` (which is optional). `filter` is a string that contains a [cypher where](https://neo4j.com/docs/cypher-manual/current/clauses/where/) and it is very much like a regular SQL where with some caveats:
- to reference the current node, you must use the notation `{this}`, this will be more clear on the following examples
- strings must be single quoted

`params` is a object map where the keys are referenced in `filter` and values are injected using a parameterized query

That said, lets see some examples:

#### Filter by string

```javascript
const child = await konekto.findOneByQueryObject({
  _where: {filter: '{this}.name = "Atreus"'}
}) // findOneByQueryObject is the same as findByQueryObject, but it returns the first item of the resulting array
```

#### Filter by number

```javascript
const result = await konekto.findByQueryObject({
  _where: {filter: '{this}.height >= 180'}
}) // returns Kratos and Faye, not in this particular order
```

#### Filter by boolean

```javascript
const father = await konekto.findOneByQueryObject({
  _where: {filter: '{this}.god = true'}
})
```

#### Using parameters

```javascript
const Faye = await konekto.findOneByQueryObject({
  _where: {filter: '{this}.god = :is_god', params: {is_god: false}}
})
```

### Ordering with _order

It's possible to order the results by one or more fields using the `_order` operator. You can pass either a string container the property by which you want to order or an array of strings specifiying multiple properties to order your data. Also, you can tell if you want ascending order (default) or descending, to use desceding order, just prefix the field with a `!`, this is valid both when order by one or multiple fields.

#### Order by one field

```javascript
const [child, father, mother] = await konekto.findByQueryObject({
  _order: 'name'
})
```

#### Order by one field descending

```javascript
const [father, mother, child] = await konekto.findByQueryObject({
  _order: '!height'
})
```

#### Order by multiple fields

```javascript
const [mother, child, father] = await konekto.findByQueryObject({
  _order: ['god', 'name']
})
```

#### Order by multiple fields and mixing ascending and descending

```javascript
const [mother, father, child] = await konekto.findByQueryObject({
  _order: ['god', '!name']
}) 
```
