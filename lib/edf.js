const arrow = require('apache-arrow')

const MONTHS = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
]

function parseDateTime ({startDate, startTime, recordingId}) {
  const [hour, minute, second] = startTime.split('.').map((s) => parseInt(s))
  const edfPlusDateMatch = recordingId.match(/Startdate (\d\d)-(\w+)-(\d{4})/)
  if (edfPlusDateMatch) {
    const [, day, month, year] = edfPlusDateMatch
    return Date.UTC(parseInt(year), MONTHS.indexOf(month), parseInt(day), hour, minute, second)
  } else {
    const [day, month, year] = startDate.split('.').map((s) => parseInt(s))
    return Date.UTC((year >= 85 ? 1900 : 2000) + year, month - 1, day, hour, minute, second)
  }
}

const HEADER_FIELDS = [
  {name: 'version', size: 8, type: 'int'},
  {name: 'patientId', size: 80, type: 'string'},
  {name: 'recordingId', size: 80, type: 'string'},
  {name: 'startDate', size: 8, type: 'string'},
  {name: 'startTime', size: 8, type: 'string'},
  {name: 'headerSize', size: 8, type: 'int'},
  {name: 'reserved', size: 44, type: 'string'},
  {name: 'recordCount', size: 8, type: 'int'},
  {name: 'recordDuration', size: 8, type: 'float'},
  {name: 'signalCount', size: 4, type: 'int'},
]

const HEADER_SIZE = HEADER_FIELDS.reduce((sum, field) => sum + field.size, 0)

const SIGNAL_HEADER_FIELDS = [
  {name: 'label', size: 16, type: 'string'},
  {name: 'transducerType', size: 80, type: 'string'},
  {name: 'physicalDimension', size: 8, type: 'string'},
  {name: 'physicalMinimum', size: 8, type: 'float'},
  {name: 'physicalMaximum', size: 8, type: 'float'},
  {name: 'digitalMinimum', size: 8, type: 'int'},
  {name: 'digitalMaximum', size: 8, type: 'int'},
  {name: 'prefiltering', size: 80, type: 'string'},
  {name: 'sampleCount', size: 8, type: 'int'},
  {name: 'reserved', size: 32, type: 'string'},
]

function parseHeader (buffer) {
  const header = {}
  let offset = 0
  for (const headerField of HEADER_FIELDS) {
    const value = buffer.toString('ascii', offset, offset + headerField.size)
    if (headerField.type === 'float') {
      header[headerField.name] = parseFloat(value)
    } else if (headerField.type === 'int') {
      header[headerField.name] = parseInt(value)
    } else {
      header[headerField.name] = value.trim()
    }
    offset += headerField.size
  }
  return header
}

function parseSignalHeader (buffer, signalCount) {
  const signals = []
  for (let n = 0; n < signalCount; n++) {
    signals[n] = new Map()
    let offset = 0
    for (const field of SIGNAL_HEADER_FIELDS) {
      const start = offset + (n * field.size)
      const end = start + field.size
      const value = buffer.toString('ascii', start, end)
      if (field.type === 'float') {
        signals[n].set(field.name, parseFloat(value))
      } else if (field.type === 'int') {
        signals[n].set(field.name, parseInt(value))
      } else {
        signals[n].set(field.name, value.trim())
      }
      offset += signalCount * field.size
    }
  }
  return signals
}

function* signalValues (buffer, sampleCount) {
  for (let i = 0; i < sampleCount; i++) {
    yield buffer.readInt16LE(i * 2)
  }
}

class Edf {
  static async fromBuffer (buffer) {
    const header = parseHeader(buffer)
    const recordDuration = header.recordDuration * 1000
    const duration = recordDuration * header.recordCount
    const signalMetadata = parseSignalHeader(buffer.subarray(HEADER_SIZE), header.signalCount)
    const sampleCounts = signalMetadata.map((metadata) => metadata.get('sampleCount'))
    const signalChunks = sampleCounts.map(() => new Array(header.recordCount))
    let offset = header.headerSize
    for (let recordIndex = 0; recordIndex < header.recordCount; recordIndex++) {
      for (let signalIndex = 0; signalIndex < signalMetadata.length; signalIndex++) {
        const sampleCount = sampleCounts[signalIndex]
        const recordValues = Int16Array.from(signalValues(buffer.subarray(offset), sampleCount))
        signalChunks[signalIndex][recordIndex] = arrow.Int16Vector.from(recordValues)
        offset += sampleCount * 2
      }
    }
    const signalColumns = signalMetadata
      .map((metadata, signalIndex) => {
        const name = metadata.get('label')
        const field = arrow.Field.new(name, new arrow.Int16(), false, metadata)
        return arrow.Column.new(field, ...signalChunks[signalIndex])
      })
      .filter((column) => column.name !== 'Crc16')
    const table = arrow.Table.new(signalColumns)
    table.schema.metadata.set('startTimestamp', parseDateTime(header))
    table.schema.metadata.set('duration', duration)
    return new Edf(table)
  }

  constructor (table) {
    this._table = table
  }

  get startTimestamp () {
    return this._table.schema.metadata.get('startTimestamp')
  }

  get duration () {
    return this._table.schema.metadata.get('duration')
  }

  get length () {
    return this._table.count()
  }

  get timestamps () {
    return this._createTimestampGenerator()
  }

  * _createTimestampGenerator () {
    const start = this.startTimestamp
    const end = start + this.duration
    const step = this.duration / this.length
    for (let ts = start; ts < end; ts += step) {
      yield ts
    }
  }

  get signalNames () {
    return this._table.schema.fields.map((field) => field.name)
  }

  getSignal (name) {
    return this._table.getColumn(name)
  }

  toTable () {
    return this._table
  }
}

module.exports = Edf
