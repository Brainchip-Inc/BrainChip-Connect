/**
 * Pins which advertising devices the app is willing to put in the device list.
 *
 * The filter keys on the AKD1500 accelerator id in the manufacturer data,
 * which every board the app serves carries, so it must admit an AkidaTag and
 * a BrainBoard1500 alike and nothing else. It is checked through the scan
 * itself rather than through the matcher alone, because the scan adds a
 * second rule: a board with no name has nothing for the list to show.
 *
 * @format
 */

import { Buffer } from 'buffer';

const mockStartDeviceScan = jest.fn();
const mockStopDeviceScan = jest.fn();

jest.mock('react-native-ble-plx', () => ({
  BleManager: jest.fn(() => ({
    startDeviceScan: (...args: unknown[]) => mockStartDeviceScan(...args),
    stopDeviceScan: () => mockStopDeviceScan(),
    onStateChange: jest.fn(() => ({ remove: jest.fn() })),
  })),
  State: { PoweredOn: 'PoweredOn' },
}));

const bleService = require('../src/services/ble/bleManager').default;

/** Manufacturer data exactly as the firmware broadcasts it. */
const advertisement = (protocol: string, firmware: string, part: string) =>
  Buffer.from(`${protocol}${firmware}${part}`, 'latin1').toString('base64');

const AKIDA_TAG = {
  id: 'AA:BB:CC:DD:EE:01',
  name: 'AkidaTag',
  manufacturerData: advertisement('53', '241', 'AKD1500'),
};

const BRAIN_BOARD = {
  id: 'AA:BB:CC:DD:EE:02',
  name: 'BrainBoard1500',
  manufacturerData: advertisement('53', '100', 'AKD1500'),
};

const NAMELESS_BOARD = {
  id: 'AA:BB:CC:DD:EE:03',
  name: null,
  manufacturerData: advertisement('53', '241', 'AKD1500'),
};

const HEADPHONES = {
  id: 'AA:BB:CC:DD:EE:04',
  name: 'WH-1000XM5',
  manufacturerData: Buffer.from([0x4c, 0x00, 0x07, 0x19]).toString('base64'),
};

/**
 * Run one scan over the given advertisements.
 *
 * @param advertising - Everything the radio reports during the scan.
 * @returns The names of the devices the scan offered to the list.
 */
const namesOfferedFor = (advertising: object[]): string[] => {
  const found: string[] = [];

  mockStartDeviceScan.mockImplementation(
    (_uuids: unknown, _options: unknown, callback: Function) => {
      advertising.forEach(device => callback(null, device));
    },
  );

  const stopScan = bleService.scanDevices((device: { name: string }) =>
    found.push(device.name),
  );
  stopScan();

  return found;
};

beforeEach(() => {
  mockStartDeviceScan.mockReset();
});

describe('which devices discovery offers to the list', () => {
  it('offers every board carrying the accelerator, whichever board it is', () => {
    expect(namesOfferedFor([AKIDA_TAG, BRAIN_BOARD])).toEqual([
      'AkidaTag',
      'BrainBoard1500',
    ]);
  });

  it('leaves out a device that is not built around the accelerator', () => {
    expect(namesOfferedFor([HEADPHONES, BRAIN_BOARD])).toEqual([
      'BrainBoard1500',
    ]);
  });

  it('leaves out a board that advertises no name to show', () => {
    expect(namesOfferedFor([NAMELESS_BOARD, AKIDA_TAG])).toEqual(['AkidaTag']);
  });
});
