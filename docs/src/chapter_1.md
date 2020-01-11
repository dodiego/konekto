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
const father = {_label: "person", _id: "father"}
const mother = {_label: "person", _id: "mother"}
const child = {_label: "person", _id: "child"}
const dog = {_label: "animal", _id: "dog"}
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
  is_married_with: {_id: "mother"},
  owns: {_id: "dog"}
}, {
  _id: "mother",
  _label: "person",
  is_married_with: {_id: "father"},
  owns: {_id: "dog"}
}, {
  _id: "child",
  _label: "person",
  parents: [{_id: "father"}, {_id: "mother"}],
  owns: {_id: "dog"},
  imaginary_friends: [{_id: "aslan"}]
}, {
  _id: "dog",
  _label: "animal"
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
  is_married_with: {_id: "mother"},
  owns: {_id: "dog"}
}, {
  _id: "mother",
  _label: "person",
  is_married_with: {_id: "father"},
  owns: {_id: "dog"}
}, {
  _id: "child",
  _label: "person",
  parents: [{_id: "father"}, {_id: "mother"}],
  owns: {_id: "dog"},
  imaginary_friends: [{_id: "aslan"}]
}, {
  _id: "dog",
  _label: "animal"
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
