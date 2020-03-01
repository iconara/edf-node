function parseAnnotations (buffer) {
  const tals = []
  const endOffset = buffer.length
  let startOffset = 0
  let offset = 0
  for (; offset < endOffset - 1; offset++) {
    if (buffer[offset] === 0x14 && buffer[offset + 1] === 0x00) {
      if (startOffset < offset) {
        tals.push(...parseAnnotation(buffer, startOffset, offset))
      }
      offset++
      for (; offset < endOffset && buffer[offset] === 0x00; offset++) ;
      startOffset = offset
    }
  }
  return tals
}

function parseAnnotation (buffer, originalStartOffset, endOffset) {
  let chunks = []
  let includesDuration = false
  let startOffset = originalStartOffset
  for (let offset = startOffset; offset < endOffset; offset++) {
    const b = buffer[offset]
    if (b === 0x14 || b === 0x15) {
      if (b === 0x15) {
        includesDuration = true
      }
      if (startOffset < offset) {
        const chunk = buffer.toString('utf8', startOffset, offset)
        chunks.push(chunk)
      }
      startOffset = offset + 1
    }
  }
  if (startOffset < endOffset) {
    const chunk = buffer.toString('utf8', startOffset, endOffset)
    chunks.push(chunk)
  }
  const onset = parseFloat(chunks[0]) * 1000
  const duration = includesDuration ? parseFloat(chunks[1]) * 1000 : undefined
  const notes = chunks.slice(includesDuration ? 2 : 1)
  if (notes.length === 0) {
    return [new Annotation(onset, duration, undefined)]
  } else {
    return notes.map((note) => new Annotation(onset, duration, note))
  }
}

class Annotation {
  constructor (onset, duration, note) {
    this._onset = onset
    this._duration = duration
    this._note = note
  }

  get onset () {
    return this._onset
  }

  get duration () {
    return this._duration
  }

  get note () {
    return this._note
  }
}

class Tal {
  static fromBuffer (buffer) {
    return new Tal(parseAnnotations(buffer))
  }

  constructor (annotations) {
    this._annotations = annotations
  }

  get annotations () {
    return this._annotations
  }
}

module.exports = Tal
