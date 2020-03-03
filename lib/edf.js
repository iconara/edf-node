const arrow = require('apache-arrow')
const Tal = require('./tal')

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

const STRING_TYPE = 'string'
const FLOAT_TYPE = 'float'
const INT_TYPE = 'int'

const HEADER_FIELDS = [
  {name: 'version', size: 8, type: INT_TYPE},
  {name: 'patientId', size: 80, type: STRING_TYPE},
  {name: 'recordingId', size: 80, type: STRING_TYPE},
  {name: 'startDate', size: 8, type: STRING_TYPE},
  {name: 'startTime', size: 8, type: STRING_TYPE},
  {name: 'headerSize', size: 8, type: INT_TYPE},
  {name: 'reserved', size: 44, type: STRING_TYPE},
  {name: 'recordCount', size: 8, type: INT_TYPE},
  {name: 'recordDuration', size: 8, type: FLOAT_TYPE},
  {name: 'signalCount', size: 4, type: INT_TYPE},
]

const HEADER_SIZE = HEADER_FIELDS.reduce((sum, field) => sum + field.size, 0)

const SIGNAL_HEADER_FIELDS = [
  {name: 'label', size: 16, type: STRING_TYPE},
  {name: 'transducerType', size: 80, type: STRING_TYPE},
  {name: 'physicalDimension', size: 8, type: STRING_TYPE},
  {name: 'physicalMinimum', size: 8, type: FLOAT_TYPE},
  {name: 'physicalMaximum', size: 8, type: FLOAT_TYPE},
  {name: 'digitalMinimum', size: 8, type: INT_TYPE},
  {name: 'digitalMaximum', size: 8, type: INT_TYPE},
  {name: 'prefiltering', size: 80, type: STRING_TYPE},
  {name: 'sampleCount', size: 8, type: INT_TYPE},
  {name: 'reserved', size: 32, type: STRING_TYPE},
]

const ANNOTATIONS_SIGNAL_LABEL = 'EDF Annotations'
const CRC_SIGNAL_LABEL = 'Crc16'

const START_TIMESTAMP_METADATA_KEY = 'startTimestamp'
const DURATION_METADATA_KEY = 'duration'
const ANNOTATIONS_METADATA_KEY = 'annotations'
const LABEL_METADATA_KEY = 'label'
const SAMPLE_COUNT_METADATA_KEY = 'sampleCount'

const ASCII_ENCODING = 'ascii'

function parseHeader (buffer) {
  const header = {}
  let offset = 0
  for (const headerField of HEADER_FIELDS) {
    const value = buffer.toString(ASCII_ENCODING, offset, offset + headerField.size)
    if (headerField.type === FLOAT_TYPE) {
      header[headerField.name] = parseFloat(value)
    } else if (headerField.type === INT_TYPE) {
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
      const value = buffer.toString(ASCII_ENCODING, start, end)
      if (field.type === FLOAT_TYPE) {
        signals[n].set(field.name, parseFloat(value))
      } else if (field.type === INT_TYPE) {
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

function parseSignalRecord (buffer, offset, sampleCount) {
  const recordValues = Int16Array.from(signalValues(buffer.subarray(offset), sampleCount))
  return arrow.Int16Vector.from(recordValues)
}

function parseSignalRecords (buffer, header, signalMetadata) {
  const sampleCounts = signalMetadata.map((metadata) => metadata.get(SAMPLE_COUNT_METADATA_KEY))
  const signalLabels = signalMetadata.map((metadata) => metadata.get(LABEL_METADATA_KEY))
  const signalChunks = sampleCounts.map(() => new Array(header.recordCount))
  let offset = header.headerSize
  for (let recordIndex = 0; recordIndex < header.recordCount; recordIndex++) {
    for (let signalIndex = 0; signalIndex < header.signalCount; signalIndex++) {
      const sampleCount = sampleCounts[signalIndex]
      if (signalLabels[signalIndex] === ANNOTATIONS_SIGNAL_LABEL || signalLabels[signalIndex] === CRC_SIGNAL_LABEL) {
        signalChunks[signalIndex][recordIndex] = Tal.fromBuffer(buffer.subarray(offset, offset + sampleCount * 2))
      } else {
        signalChunks[signalIndex][recordIndex] = parseSignalRecord(buffer, offset, sampleCount)
      }
      offset += sampleCount * 2
    }
  }
  return signalChunks
}

function filterAnnotations (tals) {
  return tals.flatMap((chunk) => {
    if (chunk.annotations[0].duration === undefined && chunk.annotations[0].note === undefined) {
      return chunk.annotations.slice(1)
    } else {
      return chunk
    }
  })
}

function parseSignals (buffer, header, signalMetadata) {
  const signalChunks = parseSignalRecords(buffer, header, signalMetadata)
  const signalColumns = []
  const annotations = []
  signalMetadata.forEach((metadata, signalIndex) => {
    const name = metadata.get(LABEL_METADATA_KEY)
    if (name === ANNOTATIONS_SIGNAL_LABEL) {
      annotations.push(...filterAnnotations(signalChunks[signalIndex]))
    } else if (name !== CRC_SIGNAL_LABEL) {
      const field = arrow.Field.new(name, new arrow.Int16(), false, metadata)
      const column = arrow.Column.new(field, ...signalChunks[signalIndex])
      signalColumns.push(column)
    }
  })
  return [signalColumns, annotations]
}

class Edf {
  static fromBuffer (buffer) {
    const header = parseHeader(buffer)
    const signalMetadata = parseSignalHeader(buffer.subarray(HEADER_SIZE), header.signalCount)
    const [signalColumns, annotations] = parseSignals(buffer, header, signalMetadata)
    const table = arrow.Table.new(signalColumns)
    table.schema.metadata.set(START_TIMESTAMP_METADATA_KEY, parseDateTime(header))
    table.schema.metadata.set(DURATION_METADATA_KEY, header.recordDuration * header.recordCount * 1000)
    table.schema.metadata.set(ANNOTATIONS_METADATA_KEY, JSON.stringify(annotations))
    return new Edf(table, annotations)
  }

  constructor (table, annotations) {
    this._table = table
    this._annotations = annotations
  }

  get startTimestamp () {
    return this._table.schema.metadata.get(START_TIMESTAMP_METADATA_KEY)
  }

  get duration () {
    return this._table.schema.metadata.get(DURATION_METADATA_KEY)
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

  get annotations () {
    return this._annotations
  }
}

module.exports = Edf
