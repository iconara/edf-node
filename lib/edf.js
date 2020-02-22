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
    signals[n] = {}
    let offset = 0
    for (const field of SIGNAL_HEADER_FIELDS) {
      const start = offset + (n * field.size)
      const end = start + field.size
      const value = buffer.toString('ascii', start, end)
      if (field.type === 'float') {
        signals[n][field.name] = parseFloat(value)
      } else if (field.type === 'int') {
        signals[n][field.name] = parseInt(value)
      } else {
        signals[n][field.name] = value.trim()
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
  constructor (metadata, signals) {
    this._metadata = metadata
    this._signals = signals
  }

  static async fromBuffer (buffer) {
    const header = parseHeader(buffer)
    const signals = parseSignalHeader(buffer.subarray(HEADER_SIZE), header.signalCount)
    if (buffer.length > header.headerSize) {
      let offset = header.headerSize
      for (const signal of signals) {
        signal.data = Int16Array.from(signalValues(buffer.subarray(offset), signal.sampleCount))
        offset += signal.sampleCount * 2
      }
    }
    const metadata = {
      startDateTime: parseDateTime(header),
    }
    return new Edf(metadata, signals)
  }

  get startDateTime () {
    return this._metadata.startDateTime
  }

  get signals () {
    return this._signals
  }
}

module.exports = Edf
