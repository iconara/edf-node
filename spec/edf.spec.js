const Edf = require('../lib/edf')

const EDF_HEADER_BUFFER = Buffer.from('0       MCH-0234567 F 16-SEP-1987 Haagse_Harry                                          Startdate 16-SEP-1987 PSG-1234/1987 NN Telemetry03                              16.09.8720.35.00768     Reserved field of 44 characters             2880    30      2   EEG Fpz-Cz      Temp rectal     AgAgCl cup electrodes                                                           Rectal thermistor                                                               uV      degC    -440    34.4    510     40.2    -2048   -2048   2047    2047    HP:0.1Hz LP:75Hz N:50Hz                                                         LP:0.1Hz (first order)                                                          15000   3       Reserved for EEG signal        Reserved for Body temperature    ', 'ascii')

describe('Edf', () => {
  describe('.fromBuffer', () => {
    test('returns an Edf object', async () => {
      const edf = await Edf.fromBuffer(EDF_HEADER_BUFFER)
      expect(edf instanceof Edf).toBeTruthy()
    })

    describe('returns an Edf object that', () => {
      test('contains the start date time, interpreted as an UTC instant', async () => {
        const edf = await Edf.fromBuffer(EDF_HEADER_BUFFER)
        expect(edf.startDateTime).toBe(Date.UTC(1987, 8, 16, 20, 35, 0))
      })

      describe('when the start date does not appear in the record ID field', () => {
        test('falls back on the start date field', async () => {
          let edfHeader = Buffer.from(EDF_HEADER_BUFFER.toString('ascii').replace('Startdate 16-SEP-1987', '                     '), 'ascii')
          const edf = await Edf.fromBuffer(edfHeader)
          expect(edf.startDateTime).toBe(Date.UTC(1987, 8, 16, 20, 35, 0))
        })

        describe('and the year is 2020', () => {
          test('falls back on the start date field', async () => {
            const modifiedHeader = EDF_HEADER_BUFFER
              .toString('ascii')
              .replace('Startdate 16-SEP-1987', '                     ')
              .replace('16.09.87', '16.09.19')
            let edfHeader = Buffer.from(modifiedHeader, 'ascii')
            const edf = await Edf.fromBuffer(edfHeader)
            expect(edf.startDateTime).toBe(Date.UTC(2019, 8, 16, 20, 35, 0))
          })
        })
      })

      test('contains signal metadata for each signal', async () => {
        const edf = await Edf.fromBuffer(EDF_HEADER_BUFFER)
        expect(edf.signals).toHaveLength(2)
      })

      test('contains the signal labels', async () => {
        const edf = await Edf.fromBuffer(EDF_HEADER_BUFFER)
        expect(edf.signals[0].label).toBe('EEG Fpz-Cz')
        expect(edf.signals[1].label).toBe('Temp rectal')
      })

      test('contains the signal transducer types', async () => {
        const edf = await Edf.fromBuffer(EDF_HEADER_BUFFER)
        expect(edf.signals[0].transducerType).toBe('AgAgCl cup electrodes')
        expect(edf.signals[1].transducerType).toBe('Rectal thermistor')
      })

      test('contains the signal physical dimensions', async () => {
        const edf = await Edf.fromBuffer(EDF_HEADER_BUFFER)
        expect(edf.signals[0].physicalDimension).toBe('uV')
        expect(edf.signals[1].physicalDimension).toBe('degC')
      })

      test('contains the signal physical min and max', async () => {
        const edf = await Edf.fromBuffer(EDF_HEADER_BUFFER)
        expect(edf.signals[0].physicalMinimum).toBe(-440)
        expect(edf.signals[0].physicalMaximum).toBe(510)
        expect(edf.signals[1].physicalMinimum).toBe(34.4)
        expect(edf.signals[1].physicalMaximum).toBe(40.2)
      })

      test('contains the signal digital min and max', async () => {
        const edf = await Edf.fromBuffer(EDF_HEADER_BUFFER)
        expect(edf.signals[0].digitalMinimum).toBe(-2048)
        expect(edf.signals[0].digitalMaximum).toBe(2047)
        expect(edf.signals[1].digitalMinimum).toBe(-2048)
        expect(edf.signals[1].digitalMaximum).toBe(2047)
      })

      test('contains the signal prefiltering', async () => {
        const edf = await Edf.fromBuffer(EDF_HEADER_BUFFER)
        expect(edf.signals[0].prefiltering).toBe('HP:0.1Hz LP:75Hz N:50Hz')
        expect(edf.signals[1].prefiltering).toBe('LP:0.1Hz (first order)')
      })

      test('contains the signal sample counts', async () => {
        const edf = await Edf.fromBuffer(EDF_HEADER_BUFFER)
        expect(edf.signals[0].sampleCount).toBe(15000)
        expect(edf.signals[1].sampleCount).toBe(3)
      })
    })
  })
})
