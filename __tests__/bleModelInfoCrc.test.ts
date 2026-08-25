/**
 * Pins the BLE model-transfer INFO header CRC to the firmware's layout.
 *
 * The firmware CRCs 124 header bytes — 15 uint32 LE fields in model_meta_t
 * order followed by the 64-byte null-padded model name — and then the raw
 * program_info bytes. Any drift in that layout makes the board reject every
 * model transfer with "INFO CRC FAIL", so the expected value below is an exact
 * number cross-checked against the reference sender
 * (spark/source/utils/send_model_via_ble.py).
 *
 * @format
 */

import CRC32 from 'crc-32';
import fs from 'fs';
import path from 'path';

const INFO_FIXTURE = path.join(__dirname, 'fixtures', 'kws_program_info.bin');
const mockInfoBytes = fs.readFileSync(INFO_FIXTURE);

jest.mock('react-native-ble-plx', () => ({
  BleManager: jest.fn().mockImplementation(() => ({
    onStateChange: jest.fn(() => ({ remove: jest.fn() })),
  })),
  Device: jest.fn(),
  State: { PoweredOn: 'PoweredOn', PoweredOff: 'PoweredOff' },
  Subscription: jest.fn(),
}));

jest.mock('react-native-zip-archive', () => ({ unzip: jest.fn() }));

// cbor-x ships ESM only; the CRC path does not touch it.
jest.mock('cbor-x', () => ({
  decode: jest.fn(),
  Encoder: jest.fn().mockImplementation(() => ({ encode: jest.fn() })),
}));

jest.mock('react-native-fs', () => ({
  TemporaryDirectoryPath: '/tmp',
  stat: jest.fn(async () => ({ size: mockInfoBytes.length })),
  readFile: jest.fn(async () => mockInfoBytes.toString('base64')),
  exists: jest.fn(async () => false),
  mkdir: jest.fn(),
  unlink: jest.fn(),
  readDir: jest.fn(async () => []),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const BleService = require('../src/services/ble/bleManager').default;

/** mfcc_fs as the firmware sees it: IEEE-754 single-precision bits. */
const floatBits = (value: number): number => {
  const buf = Buffer.alloc(4);
  buf.writeFloatLE(value);
  return buf.readUInt32LE(0);
};

describe('computeCombinedCRC32 (kws_edge_learning)', () => {
  const args = [
    58600, // total_length
    [49, 10, 1], // input_shape
    [1, 1, 150], // output_shape
    0x00101000, // flash_address
    true, // is_edge_learned
    0x000a0003, // num_edge_classes (neurons<<16 | classes)
    INFO_FIXTURE, // info binary path
    'kws', // model_name
    floatBits(123.56967163085938), // mfcc_fs_bits
    10, // silence_class
    11, // unknown_class
    1, // inference_mode: async
  ] as const;

  it('packs a 124-byte header: 15 uint32 fields + model_name[64]', async () => {
    const bufSpy = jest.spyOn(CRC32, 'buf');

    await BleService.computeCombinedCRC32(...args);

    const header = bufSpy.mock.calls[0][0] as Buffer;
    expect(header.length).toBe(124);
    // Spot-check the two fields the old layout had no room for.
    expect(header.readUInt32LE(11 * 4)).toBe(floatBits(123.56967163085938));
    expect(header.readUInt32LE(14 * 4)).toBe(1);

    bufSpy.mockRestore();
  });

  it('matches the firmware CRC over the real 1664-byte info binary', async () => {
    expect(mockInfoBytes.length).toBe(1664);

    const crc = await BleService.computeCombinedCRC32(...args);

    expect(crc >>> 0).toBe(0x970df4c7);
  });

  it('does not fall back to the pre-revision 108-byte layout', async () => {
    const crc = await BleService.computeCombinedCRC32(...args);

    // 0xF3E0670D = 11-field / 108-byte header, 0x6E8952FD = 124-byte header
    // with the four new fields left at zero.
    expect(crc >>> 0).not.toBe(0xf3e0670d);
    expect(crc >>> 0).not.toBe(0x6e8952fd);
  });
});
