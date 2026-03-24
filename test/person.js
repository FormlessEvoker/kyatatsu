import kyatatsu from '../index.js'

const schema = {
  name: {
    required: true
  },
  dob: {
    required: false,
    default: () => new Date()
  },
  sex: {
    required: false
  }
}

kyatatsu.registerModel('Person', schema)
const Person = kyatatsu.model('Person')

Person.createNew = async function (opts) {
  const newPerson = {
    name: opts.name,
    dob: opts.dob,
    sex: opts.sex || 'male'
  }

  const { default: History } = await import('./history.js')
  const person = await Person.create(newPerson)
  await History.create({ subject: person, update: person })
  return person
}

Person.prototype.update = async function (update) {
  Object.assign(this, update)

  const { default: History } = await import('./history.js')
  const person = await this.save()
  await History.create({ subject: person, update })
  return person
}

export default Person