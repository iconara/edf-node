const fs = require('fs')
const Edf = require('../lib/edf')

describe('Edf', () => {
  describe('.fromBuffer', () => {
    describe('with EDF+ data that contains a header', () => {
      def('edfBuffer', () => Buffer.from('0       MCH-0234567 F 16-SEP-1987 Haagse_Harry                                          Startdate 16-SEP-1987 PSG-1234/1987 NN Telemetry03                              16.09.8720.35.00768     Reserved field of 44 characters             2880    30      2   EEG Fpz-Cz      Temp rectal     AgAgCl cup electrodes                                                           Rectal thermistor                                                               uV      degC    -440    34.4    510     40.2    -2048   -2048   2047    2047    HP:0.1Hz LP:75Hz N:50Hz                                                         LP:0.1Hz (first order)                                                          15000   3       Reserved for EEG signal        Reserved for Body temperature    ', 'ascii'))

      describe('returns an Edf object that', () => {
        test('contains the start date time, interpreted as an UTC instant', async () => {
          const edf = await Edf.fromBuffer(get('edfBuffer'))
          expect(edf.startDateTime).toBe(Date.UTC(1987, 8, 16, 20, 35, 0))
        })

        describe('when the start date does not appear in the record ID field', () => {
          def('edfBuffer', () => Buffer.from(get('edfBuffer').toString('ascii').replace('Startdate 16-SEP-1987', '                     '), 'ascii'))

          test('falls back on the start date field', async () => {
            const edf = await Edf.fromBuffer(get('edfBuffer'))
            expect(edf.startDateTime).toBe(Date.UTC(1987, 8, 16, 20, 35, 0))
          })

          describe('and the year is 2020', () => {
            def('edfBuffer', () => {
              const modifiedHeader = get('edfBuffer')
                .toString('ascii')
                .replace('Startdate 16-SEP-1987', '                     ')
                .replace('16.09.87', '16.09.19')
              return Buffer.from(modifiedHeader, 'ascii')
            })

            test('falls back on the start date field', async () => {
              const edf = await Edf.fromBuffer(get('edfBuffer'))
              expect(edf.startDateTime).toBe(Date.UTC(2019, 8, 16, 20, 35, 0))
            })
          })
        })

        test('contains the record duration', async () => {
          const edf = await Edf.fromBuffer(get('edfBuffer'))
          expect(edf.duration).toBe(30 * 2880 * 1000)
        })

        test('contains signal metadata for each signal', async () => {
          const edf = await Edf.fromBuffer(get('edfBuffer'))
          expect(edf.signals).toHaveLength(2)
        })

        test('contains the signal labels', async () => {
          const edf = await Edf.fromBuffer(get('edfBuffer'))
          expect(edf.signals[0].label).toBe('EEG Fpz-Cz')
          expect(edf.signals[1].label).toBe('Temp rectal')
        })

        test('contains the signal transducer types', async () => {
          const edf = await Edf.fromBuffer(get('edfBuffer'))
          expect(edf.signals[0].transducerType).toBe('AgAgCl cup electrodes')
          expect(edf.signals[1].transducerType).toBe('Rectal thermistor')
        })

        test('contains the signal physical dimensions', async () => {
          const edf = await Edf.fromBuffer(get('edfBuffer'))
          expect(edf.signals[0].physicalDimension).toBe('uV')
          expect(edf.signals[1].physicalDimension).toBe('degC')
        })

        test('contains the signal physical min and max', async () => {
          const edf = await Edf.fromBuffer(get('edfBuffer'))
          expect(edf.signals[0].physicalMinimum).toBe(-440)
          expect(edf.signals[0].physicalMaximum).toBe(510)
          expect(edf.signals[1].physicalMinimum).toBe(34.4)
          expect(edf.signals[1].physicalMaximum).toBe(40.2)
        })

        test('contains the signal digital min and max', async () => {
          const edf = await Edf.fromBuffer(get('edfBuffer'))
          expect(edf.signals[0].digitalMinimum).toBe(-2048)
          expect(edf.signals[0].digitalMaximum).toBe(2047)
          expect(edf.signals[1].digitalMinimum).toBe(-2048)
          expect(edf.signals[1].digitalMaximum).toBe(2047)
        })

        test('contains the signal prefiltering', async () => {
          const edf = await Edf.fromBuffer(get('edfBuffer'))
          expect(edf.signals[0].prefiltering).toBe('HP:0.1Hz LP:75Hz N:50Hz')
          expect(edf.signals[1].prefiltering).toBe('LP:0.1Hz (first order)')
        })

        test('contains the signal sample counts', async () => {
          const edf = await Edf.fromBuffer(get('edfBuffer'))
          expect(edf.signals[0].sampleCount).toBe(15000)
          expect(edf.signals[1].sampleCount).toBe(3)
        })
      })
    })

    describe('with EDF+ data that contains signal measurements', () => {
      def('edfBuffer', () => fs.readFileSync(__dirname + '/resources/20200115_231509_PLD.edf'))

      describe('returns an Edf object that', () => {
        test('contains the measurements of each signal', async () => {
          const edf = await Edf.fromBuffer(get('edfBuffer'))
          expect(edf.signals[3].data).toHaveLength(169 * 30)
          expect(edf.signals[3].data.slice(0, 120)).toEqual(Int16Array.from([
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
          expect(edf.signals[9].data).toHaveLength(169)
          expect(edf.signals[9].data.slice(0, 3)).toEqual(Int16Array.from([-27479, 17000, -7973]))
        })

        describe('can be converted into an Arrow table that', () => {
          test('has each signal as a column', async () => {
            const edf = await Edf.fromBuffer(get('edfBuffer'))
            const table = edf.toTable()
            const fieldNames = table.schema.fields.map((f) => f.name)
            expect(fieldNames).toEqual([
              'MaskPress.2s',
              'Press.2s',
              'EprPress.2s',
              'Leak.2s',
              'RespRate.2s',
              'TidVol.2s',
              'MinVent.2s',
              'Snore.2s',
              'FlowLim.2s',
              'Crc16',
            ])
          })

          test('has each signal\'s measurements', async () => {
            const edf = await Edf.fromBuffer(get('edfBuffer'))
            const table = edf.toTable()
            const column = table.getColumn('Leak.2s')
            expect(Array.from(column)).toEqual(Array.from(edf.signals[3].data))
          })

          test('contains the file metadata', async () => {
            const edf = await Edf.fromBuffer(get('edfBuffer'))
            const table = edf.toTable()
            expect(table.schema.metadata.get('startDateTime')).toBe(1579130110000)
            expect(table.schema.metadata.get('duration')).toBe(60 * 169 * 1000)
          })

          test('contains the signal metadata', async () => {
            const edf = await Edf.fromBuffer(get('edfBuffer'))
            const table = edf.toTable()
            const column = table.getColumn('Leak.2s')
            expect(column.field.metadata.get('transducerType')).toBe('')
            expect(column.field.metadata.get('physicalDimension')).toBe('L/s')
            expect(column.field.metadata.get('physicalMinimum')).toBe(0)
            expect(column.field.metadata.get('physicalMaximum')).toBe(2)
            expect(column.field.metadata.get('digitalMinimum')).toBe(0)
            expect(column.field.metadata.get('digitalMaximum')).toBe(100)
            expect(column.field.metadata.get('prefiltering')).toBe('')
            expect(column.field.metadata.get('sampleCount')).toBe(30)
          })
        })
      })
    })
  })
})
