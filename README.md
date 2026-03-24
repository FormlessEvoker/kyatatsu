# KYATATSU

A JavaScript library for managing data models and interfacing with Couchbase buckets.

Kyatatsu: Japanese for footstool. This module is named thus as a lightweight, non-ODM replacement for Ottoman.

> **Requires Node.js 18+ and is published as an ES module (`"type": "module"`).**

NOTE: this project is stale and has not been updated except for dependencies and ESM syntax. You are welcome to use it as you see fit, but there may be better alternatives out there.

## Installation

```sh
npm install kyatatsu
```

## Usage

### Setup

Configure and connect Kyatatsu once at startup (e.g. `server.js`):

```javascript
import kyatatsu from 'kyatatsu'

kyatatsu.couchbaseUrl = 'couchbase://127.0.0.1'
kyatatsu.bucketName = 'my_bucket'
kyatatsu.clusterUser = 'my_user'
kyatatsu.clusterPass = 'my_password'

await kyatatsu.connect()
```

### Defining a model

Create your models in their own files:

```javascript
import kyatatsu from 'kyatatsu'

const schema = {
  name: {
    required: true
  },
  birthday: {
    default: () => new Date()
  }
}

kyatatsu.registerModel('Person', schema)
const Person = kyatatsu.model('Person')

export default Person
```

### Creating documents

`Model.create(opts, createOpts?)` upserts a new document and returns the saved object:

```javascript
import Person from './models/person.js'

const person = await Person.create({ name: 'Alice' })
console.log(person._id)   // auto-generated UUID
console.log(person._type) // 'Person'
```

Pass `{ persistToDisc: true }` as the second argument to wait for disk persistence:

```javascript
const person = await Person.create({ name: 'Alice' }, { persistToDisc: true })
```

### Instantiating and saving

You can also instantiate a model with `new` and call `.save()` later:

```javascript
import Person from './models/person.js'

const person = new Person({ name: 'Bob' })
person.name = 'Robert'
const saved = await person.save()
```

### Querying

Run a N1QL query against the connected cluster:

```javascript
const rows = await kyatatsu.query(
  'SELECT * FROM `my_bucket` WHERE _type = $1',
  ['Person']
)
```

## Schema properties

Each key in a schema object accepts the following options:

| Option | Type | Description |
| --- | --- | --- |
| `required` | `boolean` | When `true`, an error is thrown if the property is missing at instantiation or save time |
| `default` | `() => value` | A zero-argument function returning the default value for the property |
| `type` | `'ref'` | Marks the property as a reference to another model; stored as `{ $ref, _type }` |

### Reference fields

A field marked `type: 'ref'` is stored as a reference object rather than an inline value:

```javascript
const historySchema = {
  subject: {
    required: true,
    type: 'ref'   // stored as { $ref: <id>, _type: <type> }
  },
  date: {
    default: () => new Date()
  },
  update: {
    required: true
  }
}
```

## API

### `kyatatsu.connect() → Promise<Cluster>`

Connects to Couchbase using the configured `couchbaseUrl`, `clusterUser`, and `clusterPass`. Stores the cluster instance internally.

### `kyatatsu.registerModel(name, schema)`

Registers a schema under the given model name. Must be called before `kyatatsu.model(name)`.

### `kyatatsu.model(name) → ModelConstructor`

Returns a constructor function for the named model. Throws if the model has not been registered.

### `Model.create(opts, createOpts?) → Promise<object>`

Creates, upserts, and returns a new document. Automatically assigns `_id` (UUID v4) and `_type`.

### `instance.save(saveOpts?) → Promise<object>`

Upserts the current instance to Couchbase and returns the saved document. Accepts `{ persistToDisc: true, debug: true }`.

### `kyatatsu.query(queryString, parameters?) → Promise<object[]>`

Runs a parameterised N1QL query. `parameters` is an optional array of positional arguments.

## Testing

```sh
npm test
```

The `test/` directory contains example model definitions for `Person` and `History`. Full unit tests are planned for a future release.

