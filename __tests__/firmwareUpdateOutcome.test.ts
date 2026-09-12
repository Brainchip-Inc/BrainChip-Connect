/**
 * Drives `performFota` against a simulated board through all three endings.
 *
 * The bug this pins: a board refuses firmware signed with a key it does not
 * trust silently, on the next boot, long after the transfer has succeeded.
 * Every step the phone can watch reports success, and the app used to report
 * success too, so a cryptographically rejected update told the customer it had
 * worked. The only way to know is to ask the board, once it is back up, which
 * image it is running.
 *
 * The simulated board below therefore models the reboot rather than the
 * transfer: it hands out an image list, accepts an upload into its spare slot,
 * and then comes back running either the new image or the old one. Nothing in
 * the transfer distinguishes the two cases, which is the point.
 *
 * @format
 */

import { decode, Encoder } from 'cbor-x';

const encoder = new Encoder({
  useRecords: false,
  structuredClone: false,
  tagUint8Array: false,
});

const DEVICE_ID = 'AA:BB:CC:DD:EE:FF';
const DEVICE_SERIAL = '0011223344556677';

const OLD_HASH = Buffer.from('11'.repeat(32), 'hex');
const NEW_HASH = Buffer.from('22'.repeat(32), 'hex');
const OLD_VERSION = '1.1.1';
const NEW_VERSION = '1.2.0';

const FIRMWARE_PATH = '/caches/akidatag-1.2.0.signed.bin';

/** A minimal but real MCUboot image, so the app's own reader accepts it. */
const buildFirmwareFile = (): Buffer => {
  const body = Buffer.alloc(1024, 0x5a);
  const keyHash = Buffer.from('a9'.repeat(32), 'hex');

  const entry = Buffer.alloc(4 + keyHash.length);
  entry.writeUInt16LE(0x01, 0);
  entry.writeUInt16LE(keyHash.length, 2);
  keyHash.copy(entry, 4);

  const tlvArea = Buffer.alloc(4 + entry.length);
  tlvArea.writeUInt16LE(0x6907, 0);
  tlvArea.writeUInt16LE(tlvArea.length, 2);
  entry.copy(tlvArea, 4);

  const header = Buffer.alloc(32);
  header.writeUInt32LE(0x96f3b83d, 0);
  header.writeUInt16LE(32, 8);
  header.writeUInt16LE(0, 10);
  header.writeUInt32LE(body.length, 12);
  header.writeUInt8(1, 20);
  header.writeUInt8(2, 21);
  header.writeUInt16LE(0, 22);

  return Buffer.concat([header, body, tlvArea]);
};

const mockFirmwareFile = buildFirmwareFile();

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/caches',
  TemporaryDirectoryPath: '/tmp',
  exists: jest.fn(async () => false),
  mkdir: jest.fn(async () => {}),
  unlink: jest.fn(async () => {}),
  readDir: jest.fn(async () => []),
  stat: jest.fn(async () => ({ size: mockFirmwareFile.length })),
  readFile: jest.fn(async () => mockFirmwareFile.toString('base64')),
}));

jest.mock('react-native-zip-archive', () => ({
  unzip: jest.fn(async (_zip: string, dest: string) => dest),
}));

/**
 * Stand-in for an AkidaTag speaking MCUmgr over the SMP characteristic.
 *
 * `acceptsUpdate` decides what happens across the reboot, which is the only
 * place the two endings differ: with it set the board comes back running the
 * staged image, without it the bootloader has thrown that image away and the
 * board is on its previous firmware again.
 */
class SimulatedBoard {
  acceptsUpdate = true;
  failUploadAtOffset: number | null = null;

  staged = false;
  rebooted = false;
  resetCount = 0;
  uploadedBytes = 0;

  private notify: ((frame: Buffer) => void) | null = null;
  private notifyUart: ((frame: string) => void) | null = null;

  reset(acceptsUpdate: boolean) {
    this.acceptsUpdate = acceptsUpdate;
    this.failUploadAtOffset = null;
    this.staged = false;
    this.rebooted = false;
    this.resetCount = 0;
    this.uploadedBytes = 0;
  }

  onSmpNotify(listener: (frame: Buffer) => void) {
    this.notify = listener;
  }

  onUartNotify(listener: (frame: string) => void) {
    this.notifyUart = listener;
  }

  /** The five-frame device-info burst, whose last frame is the serial. */
  sendDeviceInfo() {
    const values = ['AKIDA', 'TYPE', '5.3', '1.2.3', DEVICE_SERIAL];
    values.forEach((value, index) => {
      const frameType = index === 0 ? 1 : index === values.length - 1 ? 3 : 2;
      const payload = `1:${value},\r`;
      const frame = `${frameType},${index},${payload.length},${payload}`;
      setTimeout(() => this.notifyUart?.(frame), 0);
    });
  }

  private imageList() {
    const running = this.rebooted && this.acceptsUpdate;
    const images: object[] = [
      {
        slot: 0,
        version: running ? NEW_VERSION : OLD_VERSION,
        hash: new Uint8Array(running ? NEW_HASH : OLD_HASH),
        active: true,
        confirmed: true,
      },
    ];

    if (this.staged && !this.rebooted) {
      images.push({
        slot: 1,
        version: NEW_VERSION,
        hash: new Uint8Array(NEW_HASH),
        active: false,
        confirmed: false,
      });
    }

    return { images };
  }

  /**
   * Answer one SMP request.
   *
   * @returns The CBOR body to notify back, or null when the board stays quiet,
   *   which is what a reset looks like from the phone's side.
   */
  private respond(
    version: number,
    op: number,
    group: number,
    command: number,
    body: any,
  ): object | null {
    if (version === 0 && group === 0 && command === 6) {
      return { buf_size: 2048, buf_count: 4 };
    }
    if (group === 0 && command === 8) {
      return body?.query === 'mode' ? { mode: 0 } : { bootloader: 'MCUboot' };
    }
    if (group === 0 && command === 5) {
      this.resetCount += 1;
      this.rebooted = true;
      return null;
    }
    if (group === 1 && command === 0 && op === 0) {
      return this.imageList();
    }
    if (group === 1 && command === 1) {
      const offset = Number(body.off ?? 0);
      if (
        this.failUploadAtOffset !== null &&
        offset >= this.failUploadAtOffset
      ) {
        return { rc: 3 };
      }
      this.uploadedBytes = offset + body.data.length;
      if (this.uploadedBytes >= mockFirmwareFile.length) {
        this.staged = true;
      }
      return { rc: 0, off: this.uploadedBytes };
    }
    if (group === 1 && command === 0 && op === 2) {
      return { rc: 0 };
    }
    return { rc: 0 };
  }

  writeSmp(packet: Buffer) {
    const version = packet[0] >> 3;
    const op = packet[0] & 0x07;
    const group = packet.readUInt16BE(4);
    const command = packet[7];
    const payload = packet.subarray(8);
    const body = payload.length ? decode(payload) : {};

    const reply = this.respond(version, op, group, command, body);
    if (!reply) {
      return;
    }

    const encoded = Buffer.from(encoder.encode(reply));
    const header = Buffer.alloc(8);
    header.writeUInt8((version << 3) | (op + 1), 0);
    header.writeUInt16BE(encoded.length, 2);
    header.writeUInt16BE(group, 4);
    header.writeUInt8(packet[6], 6);
    header.writeUInt8(command, 7);

    const frame = Buffer.concat([header, encoded]);
    setTimeout(() => this.notify?.(frame), 0);
  }
}

const mockBoard = new SimulatedBoard();

jest.mock('react-native-ble-plx', () => {
  const device = {
    id: 'AA:BB:CC:DD:EE:FF',
    mtu: 247,
    requestMTU: jest.fn(async () => ({ mtu: 247 })),
    discoverAllServicesAndCharacteristics: jest.fn(async () => {}),
  };

  const write = async (
    _id: string,
    service: string,
    char: string,
    value: string,
  ) => {
    // The SMP service carries the update; the Nordic UART service carries the
    // device-info burst the reconnect uses to confirm the board's serial.
    if (service === '8d53dc1d-1db7-4cd3-868b-8a527460aa84') {
      mockBoard.writeSmp(Buffer.from(value, 'base64'));
      return;
    }
    if (char === '6e400002-b5a3-f393-e0a9-e50e24dcca9e') {
      mockBoard.sendDeviceInfo();
    }
  };

  return {
    State: { PoweredOn: 'PoweredOn' },
    BleManager: jest.fn().mockImplementation(() => ({
      connectToDevice: jest.fn(async () => device),
      devices: jest.fn(async () => [device]),
      isDeviceConnected: jest.fn(async () => true),
      cancelDeviceConnection: jest.fn(async () => device),
      onDeviceDisconnected: jest.fn(() => ({ remove: jest.fn() })),
      requestMTUForDevice: jest.fn(async () => device),
      stopDeviceScan: jest.fn(),
      startDeviceScan: jest.fn(),
      monitorCharacteristicForDevice: jest.fn(
        (
          _id: string,
          _service: string,
          char: string,
          listener: (
            error: Error | null,
            characteristic: { value: string },
          ) => void,
        ) => {
          if (char === 'da2e7828-fbce-4e01-ae9e-261174997c48') {
            mockBoard.onSmpNotify(frame =>
              listener(null, { value: frame.toString('base64') }),
            );
          }
          if (char === '6e400003-b5a3-f393-e0a9-e50e24dcca9e') {
            mockBoard.onUartNotify(frame =>
              listener(null, {
                value: Buffer.from(frame, 'utf-8').toString('base64'),
              }),
            );
          }
          return { remove: jest.fn() };
        },
      ),
      writeCharacteristicWithResponseForDevice: jest.fn(write),
      writeCharacteristicWithoutResponseForDevice: jest.fn(write),
    })),
  };
});

(global as unknown as { __DEV__: boolean }).__DEV__ = false;

const BleService = require('../src/services/ble/bleManager').default;

/** Run one whole update against the board as currently configured. */
const runUpdate = () =>
  BleService.performFota(DEVICE_ID, FIRMWARE_PATH, {
    expectedSerial: DEVICE_SERIAL,
  });

describe('performFota against a simulated board', () => {
  it('reports the update installed when the board comes back running it', async () => {
    mockBoard.reset(true);

    await expect(runUpdate()).resolves.toEqual({
      status: 'installed',
      version: '1.2.0',
    });
    expect(mockBoard.resetCount).toBe(1);
    expect(mockBoard.uploadedBytes).toBe(mockFirmwareFile.length);
  }, 60000);

  it('reports a refused update instead of success', async () => {
    mockBoard.reset(false);

    // Every step the phone can watch still succeeds: the whole image is
    // uploaded, the board accepts the confirm, and it restarts on request.
    await expect(runUpdate()).resolves.toEqual({
      status: 'rejected',
      runningVersion: '1.1.1',
    });
    expect(mockBoard.uploadedBytes).toBe(mockFirmwareFile.length);
    expect(mockBoard.resetCount).toBe(1);
  }, 60000);

  it('throws when the transfer itself fails, rather than resolving', async () => {
    mockBoard.reset(true);
    mockBoard.failUploadAtOffset = 0;

    await expect(runUpdate()).rejects.toThrow('Upload error at offset 0');
    expect(mockBoard.resetCount).toBe(0);
  }, 60000);
});
