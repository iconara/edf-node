const fs = require('fs')
const Edf = require('../lib/edf')

describe('Edf', () => {
  describe('.fromBuffer', () => {
    def('edfBuffer', () => fs.readFileSync(__dirname + '/resources/20200115_231509_PLD.edf'))

    describe('returns an Edf object that', () => {
      test('contains the start date time, interpreted as an UTC instant', () => {
        const edf = Edf.fromBuffer(get('edfBuffer'))
        expect(edf.startTimestamp).toBe(Date.UTC(2020, 0, 15, 23, 15, 10))
      })

      describe('when the start date does not appear in the record ID field', () => {
        def('edfBuffer', () => Buffer.from(get('edfBuffer').toString('ascii').replace('Startdate 15-JAN-2020', '                     '), 'ascii'))

        test('falls back on the start date field', () => {
          const edf = Edf.fromBuffer(get('edfBuffer'))
          expect(edf.startTimestamp).toBe(Date.UTC(2020, 0, 15, 23, 15, 10))
        })

        describe('and the year is before 2000', () => {
          def('edfBuffer', () => {
            const modifiedHeader = get('edfBuffer')
              .toString('ascii')
              .replace('15.01.20', '16.09.87')
            return Buffer.from(modifiedHeader, 'ascii')
          })

          test('falls back on the start date field', () => {
            const edf = Edf.fromBuffer(get('edfBuffer'))
            expect(edf.startTimestamp).toBe(Date.UTC(1987, 8, 16, 23, 15, 10))
          })
        })
      })

      test('contains the record duration', () => {
        const edf = Edf.fromBuffer(get('edfBuffer'))
        expect(edf.duration).toBe(60 * 169 * 1000)
      })

      test('contains the total number of measurements', () => {
        const edf = Edf.fromBuffer(get('edfBuffer'))
        expect(edf.length).toBe(30 * 169)
      })

      test('can generate the timestamps for the signal measurements', () => {
        const edf = Edf.fromBuffer(get('edfBuffer'))
        const timestamps = Array.from(edf.timestamps)
        expect(timestamps[0]).toBe(edf.startTimestamp)
        expect(timestamps[1]).toBe(edf.startTimestamp + edf.duration/edf.length)
        expect(timestamps[edf.length - 1]).toBe(edf.startTimestamp + edf.duration - edf.duration/edf.length)
      })

      test('contains each signal, except for the checksum signal', () => {
        const edf = Edf.fromBuffer(get('edfBuffer'))
        expect(edf.signalNames).not.toInclude('Crc16')
        expect(edf.signalNames).toEqual([
          'MaskPress.2s',
          'Press.2s',
          'EprPress.2s',
          'Leak.2s',
          'RespRate.2s',
          'TidVol.2s',
          'MinVent.2s',
          'Snore.2s',
          'FlowLim.2s',
        ])
      })

      test('contains the signal metadata', () => {
        let modifiedBuffer = get('edfBuffer').toString('ascii')
        modifiedBuffer = ''
          + modifiedBuffer.substr(0, 256 + 16 * 10 + 80 * 3)
          + 'No transducer'
          + modifiedBuffer.substr(256 + 16 * 10 + 80 * 3 + 13, 6 * 80 + 8 * 10 * 5 + 80 * 4)
          + 'No prefiltering'
          + modifiedBuffer.substr(256 + 16 * 10 + 80 * 3 + 13 + 6 * 80 + 8 * 10 * 5 + 80 * 4 + 15)
        const edf = Edf.fromBuffer(Buffer.from(modifiedBuffer, 'ascii'))
        const leakSignal = edf.getSignal('Leak.2s')
        const snoreSignal = edf.getSignal('Snore.2s')
        expect(leakSignal.metadata.get('transducerType')).toBe('No transducer')
        expect(leakSignal.metadata.get('physicalDimension')).toBe('L/s')
        expect(leakSignal.metadata.get('prefiltering')).toBe('No prefiltering')
        expect(snoreSignal.metadata.get('transducerType')).toBe('')
        expect(snoreSignal.metadata.get('physicalDimension')).toBe('')
        expect(snoreSignal.metadata.get('prefiltering')).toBe('')
      })

      test('contains the signal physical min and max', () => {
        const edf = Edf.fromBuffer(get('edfBuffer'))
        const leakSignal = edf.getSignal('Leak.2s')
        const snoreSignal = edf.getSignal('Snore.2s')
        expect(leakSignal.metadata.get('physicalMinimum')).toBe(0)
        expect(leakSignal.metadata.get('physicalMaximum')).toBe(2)
        expect(snoreSignal.metadata.get('physicalMinimum')).toBe(0)
        expect(snoreSignal.metadata.get('physicalMaximum')).toBe(5)
      })

      test('contains the signal digital min and max', () => {
        const edf = Edf.fromBuffer(get('edfBuffer'))
        const leakSignal = edf.getSignal('Leak.2s')
        const snoreSignal = edf.getSignal('Snore.2s')
        expect(leakSignal.metadata.get('digitalMinimum')).toBe(0)
        expect(leakSignal.metadata.get('digitalMaximum')).toBe(100)
        expect(snoreSignal.metadata.get('digitalMinimum')).toBe(0)
        expect(snoreSignal.metadata.get('digitalMaximum')).toBe(250)
      })

      test('contains the measurements of each signal', () => {
        const edf = Edf.fromBuffer(get('edfBuffer'))
        const leakSignal = edf.getSignal('Leak.2s')
        const snoreSignal = edf.getSignal('Snore.2s')
        expect(leakSignal).toHaveLength(169 * 30)
        expect(leakSignal.slice(0, 120).toArray()).toEqual(Int16Array.from([
          2, 3, 5, 4, 3, 0, 3, 4, 2, 4,
          3, 3, 3, 3, 2, 3, 3, 2, 3, 2,
          2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
          2, 2, 2, 2, 2, 0, 2, 2, 1, 1,
          1, 2, 1, 1, 1, 1, 1, 1, 1, 1,
          2, 2, 2, 2, 2, 2, 1, 1, 2, 1,
          2, 2, 2, 2, 1, 1, 1, 1, 1, 2,
          2, 1, 1, 2, 2, 2, 2, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 2, 2, 1, 3, 2, 2, 2,
          1, 1, 1, 1, 1, 2, 2, 1, 1, 1,
        ]))
        expect(snoreSignal).toHaveLength(169 * 30)
        expect(snoreSignal.slice(0, 120).toArray()).toEqual(Int16Array.from([
          0, 0, 0, 0, 0, 0, 1, 1, 1, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        ]))
      })

      describe('can be converted into an Arrow table that', () => {
        test('has each signal as a column', () => {
          const edf = Edf.fromBuffer(get('edfBuffer'))
          const table = edf.toTable()
          const fieldNames = table.schema.fields.map((f) => f.name)
          expect(fieldNames).toEqual(edf.signalNames)
        })

        test('has each signal\'s measurements', () => {
          const edf = Edf.fromBuffer(get('edfBuffer'))
          const table = edf.toTable()
          const column = table.getColumn('Leak.2s')
          expect(column.toArray()).toEqual(edf.getSignal('Leak.2s').toArray())
        })

        test('contains the file metadata', () => {
          const edf = Edf.fromBuffer(get('edfBuffer'))
          const table = edf.toTable()
          expect(table.schema.metadata.get('startTimestamp')).toBe(1579130110000)
          expect(table.schema.metadata.get('duration')).toBe(60 * 169 * 1000)
        })

        test('contains the signal metadata', () => {
          const edf = Edf.fromBuffer(get('edfBuffer'))
          const table = edf.toTable()
          const column = table.getColumn('Leak.2s')
          expect(column.field.metadata).toEqual(edf.getSignal('Leak.2s').metadata)
        })
      })
    })

    describe('with EDF annotations', () => {
      def('edfBuffer', () => fs.readFileSync(__dirname + '/resources/20200115_231501_EVE.edf'))

      describe('returns an Edf object that', () => {
        test('does not contain an annotations signal', () => {
          const edf = Edf.fromBuffer(get('edfBuffer'))
          expect(edf.signalNames).not.toInclude('EDF Annotations')
        })

        test('does not contain record offset annotations', () => {
          const edf = Edf.fromBuffer(get('edfBuffer'))
          const offsetAnnotations = edf.annotations.filter((a) => a.onset === 0 && a.duration === undefined && a.note === undefined)
          expect(offsetAnnotations).toBeEmpty()
        })

        test('contains annotations', () => {
          const edf = Edf.fromBuffer(get('edfBuffer'))
          const startAnnotation = edf.annotations[0]
          const apneaAnnotation = edf.annotations[2]
          expect(startAnnotation.onset).toEqual(0)
          expect(startAnnotation.duration).toEqual(0)
          expect(startAnnotation.note).toEqual('Recording starts')
          expect(apneaAnnotation.onset).toEqual(13759000)
          expect(apneaAnnotation.duration).toEqual(11000)
          expect(apneaAnnotation.note).toEqual('Obstructive Apnea')
        })
      })

      describe('can be converted into an Arrow table that', () => {
        test('contains the JSON encoded annotations in the metadata', () => {
          const edf = Edf.fromBuffer(get('edfBuffer'))
          const table = edf.toTable()
          const annotations = JSON.parse(table.schema.metadata.get('annotations'))
          const startAnnotation = annotations[0]
          const apneaAnnotation = annotations[2]
          expect(startAnnotation.onset).toEqual(0)
          expect(startAnnotation.duration).toEqual(0)
          expect(startAnnotation.note).toEqual('Recording starts')
          expect(apneaAnnotation.onset).toEqual(13759000)
          expect(apneaAnnotation.duration).toEqual(11000)
          expect(apneaAnnotation.note).toEqual('Obstructive Apnea')
        })
      })
    })
  })
})
