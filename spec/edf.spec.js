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

        test('contains the names of each signal', async () => {
          const edf = await Edf.fromBuffer(get('edfBuffer'))
          expect(edf.signalNames).toEqual([
            'EEG Fpz-Cz',
            'Temp rectal',
          ])
        })

        test('contains the signal metadata', async () => {
          const edf = await Edf.fromBuffer(get('edfBuffer'))
          const eegSignal = edf.getSignal('EEG Fpz-Cz')
          const tempSignal = edf.getSignal('Temp rectal')
          expect(eegSignal.metadata.get('transducerType')).toBe('AgAgCl cup electrodes')
          expect(eegSignal.metadata.get('physicalDimension')).toBe('uV')
          expect(eegSignal.metadata.get('prefiltering')).toBe('HP:0.1Hz LP:75Hz N:50Hz')
          expect(tempSignal.metadata.get('transducerType')).toBe('Rectal thermistor')
          expect(tempSignal.metadata.get('physicalDimension')).toBe('degC')
          expect(tempSignal.metadata.get('prefiltering')).toBe('LP:0.1Hz (first order)')
        })

        test('contains the signal physical min and max', async () => {
          const edf = await Edf.fromBuffer(get('edfBuffer'))
          const eegSignal = edf.getSignal('EEG Fpz-Cz')
          const tempSignal = edf.getSignal('Temp rectal')
          expect(eegSignal.metadata.get('physicalMinimum')).toBe(-440)
          expect(eegSignal.metadata.get('physicalMaximum')).toBe(510)
          expect(tempSignal.metadata.get('physicalMinimum')).toBe(34.4)
          expect(tempSignal.metadata.get('physicalMaximum')).toBe(40.2)
        })

        test('contains the signal digital min and max', async () => {
          const edf = await Edf.fromBuffer(get('edfBuffer'))
          const eegSignal = edf.getSignal('EEG Fpz-Cz')
          const tempSignal = edf.getSignal('Temp rectal')
          expect(eegSignal.metadata.get('digitalMinimum')).toBe(-2048)
          expect(eegSignal.metadata.get('digitalMaximum')).toBe(2047)
          expect(tempSignal.metadata.get('digitalMinimum')).toBe(-2048)
          expect(tempSignal.metadata.get('digitalMaximum')).toBe(2047)
        })
      })
    })

    describe('with EDF+ data that contains signal measurements', () => {
      def('edfBuffer', () => fs.readFileSync(__dirname + '/resources/20200115_231509_PLD.edf'))

      describe('returns an Edf object that', () => {
        test('contains the measurements of each signal', async () => {
          const edf = await Edf.fromBuffer(get('edfBuffer'))
          const leakSignal = edf.getSignal('Leak.2s')
          const crcSignal = edf.getSignal('Crc16')
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
          // expect(crcSignal).toHaveLength(169)
          expect(crcSignal.slice(0, 3).toArray()).toEqual(Int16Array.from([-27479, 17000, -7973]))
        })

        describe('can be converted into an Arrow table that', () => {
          test('has each signal as a column', async () => {
            const edf = await Edf.fromBuffer(get('edfBuffer'))
            const table = edf.toTable()
            const fieldNames = table.schema.fields.map((f) => f.name)
            expect(fieldNames).toEqual(edf.signalNames)
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
            expect(column.toArray()).toEqual(edf.getSignal('Leak.2s').toArray())
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
            expect(column.field.metadata).toEqual(edf.getSignal('Leak.2s').metadata)
          })
        })
      })
    })
  })
})
