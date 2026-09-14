/**
 * Drives `performFota` against a simulated board through each of its endings.
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
const OTHER_DEVICE_SERIAL = '8899aabbccddeeff';

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
  refusesToConfirm = false;
  keepsStagedImageAfterReboot = false;
  ignoresResetCommand = false;
  reportsSerial = true;
  reportsDifferentSerial = false;
  reportsImagesAfterReboot = true;

  staged = false;
  rebooted = false;
  resetCount = 0;
  uploadedBytes = 0;
  comesBackAfterReboot = true;

  private notify: ((frame: Buffer) => void) | null = null;
  private notifyUart: ((frame: string) => void) | null = null;

  reset(acceptsUpdate: boolean) {
    this.acceptsUpdate = acceptsUpdate;
    this.failUploadAtOffset = null;
    this.refusesToConfirm = false;
    this.keepsStagedImageAfterReboot = false;
    this.ignoresResetCommand = false;
    this.reportsSerial = true;
    this.reportsDifferentSerial = false;
    this.reportsImagesAfterReboot = true;
    this.staged = false;
    this.rebooted = false;
    this.resetCount = 0;
    this.uploadedBytes = 0;
    this.comesBackAfterReboot = true;
  }

  onSmpNotify(listener: (frame: Buffer) => void) {
    this.notify = listener;
  }

  onUartNotify(listener: (frame: string) => void) {
    this.notifyUart = listener;
  }

  /**
   * The five-frame device-info burst, whose last frame is the serial.
   *
   * Firmware that predates the serial frame ends the burst one frame early,
   * which is what `reportsSerial` models: everything else about the board is
   * normal, it simply never says which board it is. `reportsDifferentSerial`
   * is the other thing that can answer a scan, some second AkidaTag in the
   * room, which names itself perfectly well and is simply not the one.
   */
  sendDeviceInfo() {
    const serial = this.reportsDifferentSerial
      ? OTHER_DEVICE_SERIAL
      : DEVICE_SERIAL;
    const values = this.reportsSerial
      ? ['AKIDA', 'TYPE', '5.3', '1.2.3', serial]
      : ['AKIDA', 'TYPE', '5.3', '1.2.3'];
    values.forEach((value, index) => {
      const frameType = index === 0 ? 1 : index === values.length - 1 ? 3 : 2;
      const payload = `1:${value},\r`;
      const frame = `${frameType},${index},${payload.length},${payload}`;
      setTimeout(() => this.notifyUart?.(frame), 0);
    });
  }

  private imageList() {
    if (this.rebooted && !this.reportsImagesAfterReboot) {
      return { images: [] };
    }

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

    // The trailer that marks an image pending survives right up until the
    // bootloader looks at it; refusing the image is what scrambles it. So an
    // image the board never booted to is still pending, and one it turned down
    // is listed, where it is listed at all, with the flag cleared.
    if (this.staged && (!this.rebooted || this.keepsStagedImageAfterReboot)) {
      images.push({
        slot: 1,
        version: NEW_VERSION,
        hash: new Uint8Array(NEW_HASH),
        active: false,
        confirmed: false,
        pending: !this.rebooted,
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
      // A reset is answered with silence either way, so a board that never
      // acted on it looks exactly like one that did from the phone's side.
      if (!this.ignoresResetCommand) {
        this.resetCount += 1;
        this.rebooted = true;
      }
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
      return { rc: this.refusesToConfirm ? 3 : 0 };
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
      // Models what a BLE stack does with a board that is not there: the
      // request hangs until the caller's own timeout expires, and forever if
      // it did not set one, which is CoreBluetooth's documented behaviour.
      connectToDevice: jest.fn(
        async (_id: string, options?: { timeout?: number }) => {
          if (mockBoard.comesBackAfterReboot) {
            return device;
          }

          return new Promise((_resolve, reject) => {
            if (options?.timeout === undefined) {
              return;
            }
            setTimeout(
              () => reject(new Error('Device connection timed out')),
              options.timeout,
            );
          });
        },
      ),
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
const { useBleStore } = require('../src/app/store/useBleStore');

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

  it('gives up on a board that never comes back, instead of waiting forever', async () => {
    // iOS never abandons a connect request of its own accord, so every attempt
    // has to carry its own bound. Without one the update settles neither way
    // and the user watches "Checking the board" until they force-quit, which
    // is the silence this whole change exists to remove.
    mockBoard.reset(true);
    mockBoard.comesBackAfterReboot = false;
    jest.useFakeTimers();

    try {
      let settled = false;
      const update = runUpdate().finally(() => {
        settled = true;
      });

      for (let elapsed = 0; elapsed < 400000 && !settled; elapsed += 1000) {
        await jest.advanceTimersByTimeAsync(1000);
      }

      expect(settled).toBe(true);
      await expect(update).resolves.toEqual({
        status: 'unconfirmed',
        reason: 'unreachable',
      });
    } finally {
      jest.useRealTimers();
    }
  }, 60000);

  it('does not call a board it reached unreachable just because it would not say which board it is', async () => {
    // Firmware predating the serial frame comes back, advertises, and answers,
    // so the app has plainly reached it. Announcing that it could not be
    // reached would be false about the one thing the user can check.
    mockBoard.reset(true);
    mockBoard.reportsSerial = false;
    jest.useFakeTimers();

    try {
      let settled = false;
      const update = runUpdate().finally(() => {
        settled = true;
      });

      for (let elapsed = 0; elapsed < 400000 && !settled; elapsed += 1000) {
        await jest.advanceTimersByTimeAsync(1000);
      }

      expect(settled).toBe(true);
      await expect(update).resolves.toEqual({
        status: 'unconfirmed',
        reason: 'unrecognised',
      });
    } finally {
      jest.useRealTimers();
    }
  }, 60000);

  it('does not blame a second AkidaTag for not identifying itself', async () => {
    // Some other board in the room answering the scan says nothing at all
    // about the one being looked for: it named itself, and the name was not
    // the one wanted. The board being looked for was never reached.
    mockBoard.reset(true);
    mockBoard.reportsDifferentSerial = true;
    jest.useFakeTimers();

    try {
      let settled = false;
      const update = runUpdate().finally(() => {
        settled = true;
      });

      for (let elapsed = 0; elapsed < 400000 && !settled; elapsed += 1000) {
        await jest.advanceTimersByTimeAsync(1000);
      }

      expect(settled).toBe(true);
      await expect(update).resolves.toEqual({
        status: 'unconfirmed',
        reason: 'unreachable',
      });
    } finally {
      jest.useRealTimers();
    }
  }, 60000);

  it('restarts the board session when a transfer fails with the board still there', async () => {
    // The transfer tears the board's notification monitors down. Every ending
    // that reconnects puts them back by republishing the board; a failure that
    // leaves the board connected has to do the same, or the app keeps a
    // connection it can no longer hear anything over.
    mockBoard.reset(true);
    mockBoard.failUploadAtOffset = 0;

    const { setConnectedDevice } = useBleStore.getState();
    setConnectedDevice({
      id: DEVICE_ID,
      name: 'AkidaTag',
      rssi: null,
      deviceInfo: null,
      serviceUUIDs: null,
    });
    const before = useBleStore.getState().connectedDevice;

    try {
      await expect(runUpdate()).rejects.toThrow(
        'The board stopped accepting the firmware partway through',
      );

      const after = useBleStore.getState().connectedDevice;
      expect(after?.id).toBe(DEVICE_ID);
      expect(after).not.toBe(before);
    } finally {
      setConnectedDevice(null);
    }
  }, 60000);

  it('reports a board that never restarted, rather than calling it refused', async () => {
    // The reset never took effect, so the board is still up on its old
    // firmware with the image waiting in the spare slot. Calling that a
    // refusal would be wrong twice over: the board never looked at the image,
    // and it will install on the next power cycle.
    mockBoard.reset(true);
    mockBoard.ignoresResetCommand = true;

    await expect(runUpdate()).resolves.toEqual({
      status: 'not-restarted',
      runningVersion: '1.1.1',
    });
    expect(mockBoard.rebooted).toBe(false);
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

  it('still reports a refusal when the board leaves the image it turned down in place', async () => {
    // The bootloader is not required to erase what it refuses, and the board
    // that produced this bug does not. The image list then looks like the
    // not-restarted case apart from the trailer, which is why the trailer and
    // not the image's presence is what the two are told apart by.
    mockBoard.reset(false);
    mockBoard.keepsStagedImageAfterReboot = true;

    await expect(runUpdate()).resolves.toEqual({
      status: 'rejected',
      runningVersion: '1.1.1',
    });
    expect(mockBoard.rebooted).toBe(true);
  }, 60000);

  it('reports unconfirmed when there is no serial to recognise the board by', async () => {
    // Older firmware ends the device-info burst before the serial frame. The
    // board is then indistinguishable from any other AkidaTag in range after
    // the reboot, so whatever answers first cannot be asked what it is
    // running.
    mockBoard.reset(true);

    await expect(
      BleService.performFota(DEVICE_ID, FIRMWARE_PATH, {
        expectedSerial: null,
      }),
    ).resolves.toEqual({ status: 'unconfirmed', reason: 'unidentifiable' });
    expect(mockBoard.uploadedBytes).toBe(mockFirmwareFile.length);
    expect(mockBoard.resetCount).toBe(1);
  }, 60000);

  it('reports unconfirmed when the board comes back but will not say what it runs', async () => {
    // The board is recognised by its serial and is reachable, so the app did
    // get to ask; it is the answer that never came. That is a different fact
    // from a board that never came back, and it is announced differently.
    mockBoard.reset(true);
    mockBoard.reportsImagesAfterReboot = false;

    await expect(runUpdate()).resolves.toEqual({
      status: 'unconfirmed',
      reason: 'unanswered',
    });
    expect(mockBoard.resetCount).toBe(1);
  }, 60000);

  it('throws when the transfer itself fails, rather than resolving', async () => {
    mockBoard.reset(true);
    mockBoard.failUploadAtOffset = 0;

    await expect(runUpdate()).rejects.toThrow(
      'The board stopped accepting the firmware partway through',
    );
    expect(mockBoard.resetCount).toBe(0);
  }, 60000);

  it('throws when the board will not mark the image it stored for install', async () => {
    mockBoard.reset(true);
    mockBoard.refusesToConfirm = true;

    await expect(runUpdate()).rejects.toThrow(
      'The board would not install the firmware, error 3.',
    );
    expect(mockBoard.uploadedBytes).toBe(mockFirmwareFile.length);
    expect(mockBoard.resetCount).toBe(0);
  }, 60000);
});
