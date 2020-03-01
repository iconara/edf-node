const fs = require('fs')
const Tal = require('../lib/tal')

describe('Tal', () => {
  describe('.fromBuffer', () => {
    describe('with an encoded TAL containing only an onset', () => {
      def('talBuffer', () => Buffer.from('+123\x14\x14\x00', 'utf8'))

      test('returns an annotation with an onset, no duration, and no note', () => {
        const tal = Tal.fromBuffer(get('talBuffer'))
        expect(tal.annotations[0].onset).toBe(123000)
        expect(tal.annotations[0].duration).toBeUndefined()
        expect(tal.annotations[0].note).toBeUndefined()
      })
    })

    describe('when the onset is a float', () => {
      def('talBuffer', () => Buffer.from('+1.25\x14\x14\x00', 'utf8'))

      test('returns an annotation with an onset, no duration, and no notes', () => {
        const tal = Tal.fromBuffer(get('talBuffer'))
        expect(tal.annotations[0].onset).toBe(1250)
      })
    })

    describe('with an encoded TAL containing an onset and a note', () => {
      def('talBuffer', () => Buffer.from('+12\x14\x14A note\x14\x00', 'utf8'))

      test('returns an annotation with an onset, no duration, and no notes', () => {
        const tal = Tal.fromBuffer(get('talBuffer'))
        expect(tal.annotations[0].onset).toBe(12000)
        expect(tal.annotations[0].duration).toBeUndefined()
        expect(tal.annotations[0].note).toBe('A note')
      })
    })

    describe('with an encoded TAL containing an onset and duration', () => {
      def('talBuffer', () => Buffer.from('+12\x1523\x14\x00', 'utf8'))

      test('returns an annotation with an onset, no duration, and no notes', () => {
        const tal = Tal.fromBuffer(get('talBuffer'))
        expect(tal.annotations[0].onset).toBe(12000)
        expect(tal.annotations[0].duration).toBe(23000)
        expect(tal.annotations[0].note).toBeUndefined()
      })
    })

    describe('with an encoded TAL containing an onset, duration, and a note', () => {
      def('talBuffer', () => Buffer.from('+12\x1542\x14A note\x14\x00', 'utf8'))

      test('returns an annotation with an onset, no duration, and no notes', () => {
        const tal = Tal.fromBuffer(get('talBuffer'))
        expect(tal.annotations[0].onset).toBe(12000)
        expect(tal.annotations[0].duration).toBe(42000)
        expect(tal.annotations[0].note).toBe('A note')
      })
    })

    describe('with an encoded TAL containing an onset, and multiple notes', () => {
      def('talBuffer', () => Buffer.from('+12\x14Note 1\x14Note 2\x14Note 3\x14\x00', 'utf8'))

      test('returns an annotation per note', () => {
        const tal = Tal.fromBuffer(get('talBuffer'))
        expect(tal.annotations[0].onset).toBe(12000)
        expect(tal.annotations[0].duration).toBeUndefined()
        expect(tal.annotations[0].note).toEqual('Note 1')
        expect(tal.annotations[1].onset).toBe(12000)
        expect(tal.annotations[1].duration).toBeUndefined()
        expect(tal.annotations[1].note).toEqual('Note 2')
        expect(tal.annotations[2].onset).toBe(12000)
        expect(tal.annotations[2].duration).toBeUndefined()
        expect(tal.annotations[2].note).toEqual('Note 3')
      })
    })

    describe('with an encoded TAL containing an onset, duration, and multiple notes', () => {
      def('talBuffer', () => Buffer.from('+12\x152.5\x14Note 1\x14Note 2\x14\x00', 'utf8'))

      test('returns an annotation per note', () => {
        const tal = Tal.fromBuffer(get('talBuffer'))
        expect(tal.annotations[0].onset).toBe(12000)
        expect(tal.annotations[0].duration).toBe(2500)
        expect(tal.annotations[0].note).toEqual('Note 1')
        expect(tal.annotations[1].onset).toBe(12000)
        expect(tal.annotations[1].duration).toBe(2500)
        expect(tal.annotations[1].note).toEqual('Note 2')
      })
    })

    describe('with an encoded TAL ending with a long string of zeroes', () => {
      def('talBuffer', () => Buffer.from('+12\x14Note\x14\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00', 'utf8'))

      test('ignores the trailing zeroes', () => {
        const tal = Tal.fromBuffer(get('talBuffer'))
        expect(tal.annotations[0].onset).toBe(12000)
        expect(tal.annotations[0].duration).toBeUndefined()
        expect(tal.annotations[0].note).toEqual('Note')
      })
    })

    describe('with an encoded TAL with multiple annotations', () => {
      def('talBuffer', () => {
        const buffer = fs.readFileSync(__dirname + '/resources/20200115_231501_EVE.edf')
        return Buffer.concat([
          buffer.subarray(768 + 40 * 0, 768 + 40 * 0 + 38),
          buffer.subarray(768 + 40 * 1, 768 + 40 * 1 + 38),
          buffer.subarray(768 + 40 * 2, 768 + 40 * 2 + 38),
          buffer.subarray(768 + 40 * 3, 768 + 40 * 3 + 38),
          buffer.subarray(768 + 40 * 4, 768 + 40 * 4 + 38),
        ])
      })

      test('contains all annotations', () => {
        const tal = Tal.fromBuffer(get('talBuffer'))
        expect(tal.annotations).toHaveLength(10)
        expect(tal.annotations.find((a) => a.onset === 0 && a.duration === undefined && a.note === undefined)).toBeTruthy()
        expect(tal.annotations.find((a) => a.onset === 0 && a.duration === 0 && a.note === 'Recording starts')).toBeTruthy()
        expect(tal.annotations.find((a) => a.onset === 13560000 && a.duration === 24000 && a.note === 'Obstructive Apnea')).toBeTruthy()
      })
    })
  })
})
