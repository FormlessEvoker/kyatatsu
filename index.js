//  Author: Grayson M. Dubois (@FormlessEvoker)
import { connect } from 'couchbase'
import { v4 as uuidv4 } from 'uuid'

class Kyatatsu {
  constructor(opts = {}) {
    // Set properties from opts
    this.couchbaseUrl = opts.couchbaseUrl ?? 'couchbase://127.0.0.1'
    this.bucketName = opts.bucketName ?? 'default'
    this.clusterUser = opts.clusterUser ?? opts.bucketName ?? ''
    this.clusterPass = opts.clusterPass ?? ''

    // Init utilities
    this.cluster = null

    // Will contain all the models that we have
    this.models = {}

    this.errors = {
      noQueryResults: this._NoQueryResultsError,
      modelNotRegistered: this._ModelNotRegisteredError,
      missingProperty: this._MissingPropertyError,
    }
  }

  async connect() {
    this.cluster = await connect(this.couchbaseUrl, {
      username: this.clusterUser || this.bucketName || '',
      password: this.clusterPass || '',
    })
    return this.cluster
  }

  registerModel(name, schema) {
    this.models[name] = schema
  }

  model(name) {
    const kyatatsu = this
    const schema = this.models[name]
    if (schema == null) throw kyatatsu.errors.modelNotRegistered(name)

    // Return an object constructor for a model
    function model(opts = {}) {
      // Copy the keys into 'this' instance
      for (const key in schema) {
        if (Object.hasOwn(opts, key)) {
          this[key] = opts[key]
        } else if (schema[key].default != null) {
          this[key] = typeof schema[key].default === 'function'
            ? schema[key].default()
            : schema[key].default
        } else if (schema[key].required) {
          if (opts[key] != null) {
            this[key] = opts[key]
          } else {
            throw kyatatsu.errors.missingProperty(name, key)
          }
        }
      }

      if (opts._id) this._id = opts._id
      if (opts._type) this._type = opts._type

      this.save = async function (saveOpts = {}) {
        if (this._id == null) this._id = uuidv4()
        if (this._type == null) this._type = name
        const keyspaceRef = `${this._type}:${this._id}`

        const update = {
          _id: this._id,
          _type: this._type,
        }

        if (saveOpts.debug) {
          console.log(`pre-update for kyatatsu model:\n${JSON.stringify(this, null, 4)}`)
          console.log(`schema for kyatatsu model:\n${JSON.stringify(schema, null, 4)}`)
        }

        for (const key in schema) {
          if (Object.hasOwn(this, key)) {
            // If I have a value for this property
            if (this[key] != null && schema[key].type === 'ref') {
              // If property is reference, save as a ref
              update[key] = {
                $ref: this[key]['$ref'] ?? this[key]._id,
                _type: this[key]._type,
              }
            } else {
              // otherwise just copy it onto the update
              update[key] = this[key]
            }
          } else {
            // If I don't have a value for this property
            if (schema[key].default != null) {
              // If there is a default value specified in the schema, use it
              update[key] = typeof schema[key].default === 'function'
                ? schema[key].default()
                : schema[key].default
            } else if (schema[key].required) {
              // If the schema states this is required, error
              throw kyatatsu.errors.missingProperty(name, key)
            }
          }
        }

        if (saveOpts.debug) {
          console.log(`update for kyatatsu model:\n${JSON.stringify(update, null, 4)}`)
        }

        const upsertOpts = saveOpts.persistToDisc === true
          ? { durabilityPersistTo: 1 }
          : {}

        const collection = kyatatsu.cluster.bucket(kyatatsu.bucketName).defaultCollection()

        await collection.upsert(keyspaceRef, update, upsertOpts)
        const result = await collection.get(keyspaceRef)
        return result.content
      }
    }

    model.create = async function (opts = {}, createOpts = {}) {
      const newModel = {}

      for (const key in schema) {
        if (Object.hasOwn(opts, key)) {
          // If I have a value for this property
          if (opts[key] != null && schema[key].type === 'ref') {
            // If property is reference, save as a ref
            newModel[key] = {
              $ref: opts[key]['$ref'] ?? opts[key]._id,
              _type: opts[key]._type,
            }
          } else {
            // otherwise just copy it onto the update
            newModel[key] = opts[key]
          }
        } else {
          // If I don't have a value for this property
          if (schema[key].default != null) {
            // If there is a default value specified in the schema, use it
            newModel[key] = typeof schema[key].default === 'function'
              ? schema[key].default()
              : schema[key].default
          } else if (schema[key].required) {
            // If the schema states this is required, error
            throw kyatatsu.errors.missingProperty(name, key)
          }
        }
      }

      const id = uuidv4()
      newModel._id = id
      newModel._type = name

      const keyspaceRef = `${name}:${id}`

      const upsertOpts = createOpts.persistToDisc === true
        ? { durabilityPersistTo: 1 }
        : {}

      const collection = kyatatsu.cluster.bucket(kyatatsu.bucketName).defaultCollection()

      await collection.upsert(keyspaceRef, newModel, upsertOpts)
      const result = await collection.get(keyspaceRef)
      return result?.content ?? null
    }

    return model
  }

  async query(queryString, parameters = []) {
    const options = { parameters }

    try {
      const res = await this.cluster.query(queryString, options)
      return res.rows
    } catch (err) {
      if (err.cause?.first_error_code === 3000) {
        err.info = `Syntax error in N1QL query: ${queryString}`
      }
      throw err
    }
  }

  // Custom Errors
  _NoQueryResultsError(query) {
    return new Error(`No document results for query ${query}`)
  }

  _ModelNotRegisteredError(modelName) {
    return new Error(`No model registered with name: ${modelName}`)
  }

  _MissingPropertyError(name, key) {
    return new Error(`While instantiating model ${name}: Missing required property ${key}`)
  }
}

export default new Kyatatsu()
