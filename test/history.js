import kyatatsu from '../index.js'

const schema = {
  subject: {
    required: true,
    type: 'ref'
  },
  date: {
    default: () => new Date()
  },
  update: {
    required: true
  }
}

kyatatsu.registerModel('History', schema)
const History = kyatatsu.model('History')

export default History