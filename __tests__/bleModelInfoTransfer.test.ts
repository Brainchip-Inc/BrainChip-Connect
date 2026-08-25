/**
 * Drives a complete `sendModelZip` against a simulated board.
 *
 * `bleModelInfoCrc.test.ts` pins the CRC helper in isolation; it cannot catch
 * the other half of the protocol revision: the app must also WRITE aa0f-aa12,
 * or the board rebuilds the header from its own zeroed defaults and rejects a
 * CRC that was computed over the real values.
 *
 * The fake peripheral below therefore ignores the app's CRC helper entirely: it
 * reassembles `model_meta_t` from the characteristics it actually received and
 * recomputes `model_info_hdr_crc32` the way `file_transfer.c` does (124 header
 * bytes || raw program_info bytes, Zephyr `crc32_ieee`, implemented here from
 * the polynomial so the check is not circular). That is the exact comparison
 * that produced "INFO CRC FAIL: computed=0x6E8952FD expected=0xF3E0670D" on
 * real hardware before this fix.
 *
 * Fixtures are byte-identical copies of the kws_edge_learning package
 * (`kws_program_info.bin` and `info.yaml`) so the transfer carries the same
 * metadata a user would deploy. Run with FW_LOG=1 to print the board-side log.
 *
 * @format
 */

import fs from 'fs';
import path from 'path';

const FW_LOG = process.env.FW_LOG === '1';

const mockFixtures = path.join(__dirname, 'fixtures');
const mockInfoBytes = fs.readFileSync(
  path.join(mockFixtures, 'kws_program_info.bin'),
);
const mockInfoYaml = fs.readFileSync(
  path.join(mockFixtures, 'kws_edge_learning_info.yaml'),
);
// Only the length of kws_program_data.bin reaches the INFO header (via
// total_length), so the 56936-byte payload is synthesised rather than vendored.
// Its bytes still have to survive the DATA transfer intact, since the board
// CRCs what it receives against the CRC the app announced.
const mockDataBytes = Buffer.from(
  Array.from({ length: 56936 }, (_, i) => (i * 31 + 7) & 0xff),
);

const mockPkgDir = '/tmp/model_unzip/kws_edge_learning';
const mockVfs: Record<string, Buffer> = {
  [`${mockPkgDir}/info.yaml`]: mockInfoYaml,
  [`${mockPkgDir}/kws_program_info.bin`]: mockInfoBytes,
  [`${mockPkgDir}/kws_program_data.bin`]: mockDataBytes,
};

jest.mock('react-native-fs', () => ({
  TemporaryDirectoryPath: '/tmp',
  exists: jest.fn(async () => false),
  mkdir: jest.fn(async () => {}),
  unlink: jest.fn(async () => {}),
  // The zip holds one directory; sendModelZip descends into it.
  readDir: jest.fn(async (dir: string) =>
    dir.includes('kws_edge_learning')
      ? Object.keys(mockVfs).map(p => ({
          name: p.split('/').pop(),
          path: p,
          isDirectory: () => false,
        }))
      : [
          {
            name: 'kws_edge_learning',
            path: mockPkgDir,
            isDirectory: () => true,
          },
        ],
  ),
  stat: jest.fn(async (p: string) => ({ size: mockVfs[p].length })),
  readFile: jest.fn(async (p: string, encoding: string) =>
    encoding === 'utf8'
      ? mockVfs[p].toString('utf8')
      : mockVfs[p].toString('base64'),
  ),
}));

jest.mock('react-native-zip-archive', () => ({
  unzip: jest.fn(async (_zip: string, dest: string) => dest),
}));

/** GATT UUIDs owned by the firmware's file transfer service (aa00 base). */
const CHAR = {
  fileTransfer: 'f000aa01-0451-4000-b000-000000000000',
  ack: 'f000aa02-0451-4000-b000-000000000000',
  fileSize: 'f000aa04-0451-4000-b000-000000000000',
  app: 'f000aa05-0451-4000-b000-000000000000',
  crc: 'f000aa06-0451-4000-b000-000000000000',
  transferType: 'f000aa07-0451-4000-b000-000000000000',
  inputShape: 'f000aa08-0451-4000-b000-000000000000',
  outputShape: 'f000aa09-0451-4000-b000-000000000000',
  flashAddress: 'f000aa0a-0451-4000-b000-000000000000',
  totalLength: 'f000aa0b-0451-4000-b000-000000000000',
  isEdgeLearned: 'f000aa0c-0451-4000-b000-000000000000',
  numEdgeClasses: 'f000aa0d-0451-4000-b000-000000000000',
  fsName: 'f000aa0e-0451-4000-b000-000000000000',
  mfccFs: 'f000aa0f-0451-4000-b000-000000000000',
  silenceClass: 'f000aa10-0451-4000-b000-000000000000',
  unknownClass: 'f000aa11-0451-4000-b000-000000000000',
  inferenceMode: 'f000aa12-0451-4000-b000-000000000000',
};

const ACK_FLASH_ERASE_DONE = 0xee;
const ACK_FLASH_WRITE_DONE = 0xcc;
const ACK_CRC_FAIL = 0xbb;

const TRANSFER_TYPE_INFO = 0x00;

/**
 * Zephyr's crc32_ieee_update (poly 0xedb88320), which complements the running
 * value on entry and exit, the same convention as zlib.crc32(data, seed), so
 * the firmware, the reference sender and the app all chain identically.
 */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32IeeeUpdate = (buf: Buffer, crc: number): number => {
  let c = ~crc >>> 0;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return ~c >>> 0;
};

const hex = (v: number) =>
  `0x${(v >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;

/**
 * Stand-in for the board's file transfer service: stores metadata as it
 * arrives on the aa0X characteristics, then validates a completed transfer the
 * same way file_transfer_write() does.
 */
class SimulatedBoard {
  meta = {
    totalLength: 0,
    inputShape: [0, 0, 0],
    outputShape: [0, 0, 0],
    flashAddress: 0,
    isEdgeLearned: 0,
    numEdgeClasses: 0,
    mfccFsBits: 0,
    silenceClass: 0,
    unknownClass: 0,
    inferenceMode: 0,
    fsName: '',
    modelName: '',
  };

  expectedCrc = 0;
  transferType = -1;
  announcedSize = 0;
  received: Buffer[] = [];
  receivedLen = 0;

  writeOrder: string[] = [];
  acks: number[] = [];
  log: string[] = [];
  infoCrc: number | null = null;
  infoExpectedCrc: number | null = null;
  dataCrc: number | null = null;
  infoBytes: Buffer = Buffer.alloc(0);

  private ackListener: ((code: number) => void) | null = null;

  onAck(listener: (code: number) => void) {
    this.ackListener = listener;
  }

  private say(line: string) {
    this.log.push(line);
    if (FW_LOG) console.log(`[FW] ${line}`);
  }

  private sendAck(code: number) {
    this.acks.push(code);
    // Notifications arrive asynchronously, after the write completes.
    setTimeout(() => this.ackListener?.(code), 0);
  }

  write(charUUID: string, payload: Buffer) {
    this.writeOrder.push(charUUID);
    const u32 = () => payload.readUInt32LE(0);

    switch (charUUID) {
      case CHAR.transferType:
        this.transferType = payload[0];
        this.say(`Transfer type set (${hex(payload[0])})`);
        break;
      case CHAR.fsName:
        this.meta.fsName = payload.toString('utf8');
        // Firmware: model_name = basename of the fs_name path.
        this.meta.modelName = this.meta.fsName.split('/').pop() ?? '';
        break;
      case CHAR.fileSize:
        this.announcedSize = u32();
        this.received = [];
        this.receivedLen = 0;
        this.say(`Flash erase done, expecting ${this.announcedSize} bytes`);
        this.sendAck(ACK_FLASH_ERASE_DONE);
        break;
      case CHAR.crc:
        this.expectedCrc = u32();
        break;
      case CHAR.totalLength:
        this.meta.totalLength = u32();
        break;
      case CHAR.inputShape:
        this.meta.inputShape = this.readShape(payload);
        break;
      case CHAR.outputShape:
        this.meta.outputShape = this.readShape(payload);
        break;
      case CHAR.flashAddress:
        this.meta.flashAddress = u32();
        break;
      case CHAR.isEdgeLearned:
        this.meta.isEdgeLearned = u32();
        break;
      case CHAR.numEdgeClasses:
        this.meta.numEdgeClasses = u32();
        break;
      case CHAR.mfccFs:
        this.meta.mfccFsBits = u32();
        this.say(`MFCC fs bits: ${hex(u32())}`);
        break;
      case CHAR.silenceClass:
        this.meta.silenceClass = u32();
        break;
      case CHAR.unknownClass:
        this.meta.unknownClass = u32();
        break;
      case CHAR.inferenceMode:
        this.meta.inferenceMode = u32();
        break;
      case CHAR.fileTransfer:
        this.received.push(payload);
        this.receivedLen += payload.length;
        if (this.receivedLen >= this.announcedSize) this.finishTransfer();
        break;
      default:
        break;
    }
  }

  private readShape(payload: Buffer): number[] {
    const dims = [0, 0, 0];
    for (let i = 0; i * 4 < payload.length && i < 3; i++) {
      dims[i] = payload.readUInt32LE(i * 4);
    }
    return dims;
  }

  /** model_meta_t bytes from total_length through model_name: 124 bytes. */
  private packHeader(infoDataLen: number): Buffer {
    const header = Buffer.alloc(60 + 64);
    const fields = [
      this.meta.totalLength,
      ...this.meta.inputShape,
      ...this.meta.outputShape,
      this.meta.flashAddress,
      this.meta.isEdgeLearned,
      this.meta.numEdgeClasses,
      infoDataLen,
      this.meta.mfccFsBits,
      this.meta.silenceClass,
      this.meta.unknownClass,
      this.meta.inferenceMode,
    ];
    fields.forEach((v, i) => header.writeUInt32LE(v >>> 0, i * 4));
    header.write(this.meta.modelName.slice(0, 63), 60, 'utf8');
    return header;
  }

  private finishTransfer() {
    const payload = Buffer.concat(this.received);

    if (this.transferType === TRANSFER_TYPE_INFO) {
      this.infoBytes = payload;
      this.infoExpectedCrc = this.expectedCrc;
      const header = this.packHeader(payload.length);
      const m = this.meta;
      this.say(
        `model_meta_t: total_length=${m.totalLength} input=[${m.inputShape}] ` +
          `output=[${m.outputShape}] flash=${hex(m.flashAddress)} ` +
          `is_edge_learned=${m.isEdgeLearned} num_edge_classes=${hex(
            m.numEdgeClasses,
          )} info_data_len=${payload.length} mfcc_fs_bits=${hex(
            m.mfccFsBits,
          )} silence=${m.silenceClass} unknown=${m.unknownClass} ` +
          `inference_mode=${m.inferenceMode} model_name='${m.modelName}' ` +
          `(${header.length} header bytes)`,
      );
      const computed =
        (crc32IeeeUpdate(payload, crc32IeeeUpdate(header, 0xffffffff)) ^
          0xffffffff) >>>
        0;
      this.infoCrc = computed;
      this.say(`Computed model_info_hdr_crc32: ${hex(computed)}`);

      if (this.expectedCrc !== 0 && computed !== this.expectedCrc) {
        this.say(
          `INFO CRC FAIL: computed=${hex(computed)} expected=${hex(
            this.expectedCrc,
          )}`,
        );
        this.sendAck(ACK_CRC_FAIL);
        return;
      }
      this.say(`INFO CRC OK (${hex(computed)})`);
      this.sendAck(ACK_FLASH_WRITE_DONE);
      return;
    }

    const computed = (crc32IeeeUpdate(payload, 0xffffffff) ^ 0xffffffff) >>> 0;
    this.dataCrc = computed;
    if (this.expectedCrc !== 0 && computed !== this.expectedCrc) {
      this.say(
        `DATA CRC FAIL: computed=${hex(computed)} expected=${hex(
          this.expectedCrc,
        )}`,
      );
      this.sendAck(ACK_CRC_FAIL);
      return;
    }
    this.say(`DATA CRC OK (${hex(computed)})`);
    this.sendAck(ACK_FLASH_WRITE_DONE);
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

  return {
    State: { PoweredOn: 'PoweredOn' },
    BleManager: jest.fn().mockImplementation(() => ({
      connectToDevice: jest.fn(async () => device),
      onDeviceDisconnected: jest.fn(() => ({ remove: jest.fn() })),
      monitorCharacteristicForDevice: jest.fn(
        (
          _id: string,
          _svc: string,
          char: string,
          listener: (
            error: Error | null,
            characteristic: { value: string },
          ) => void,
        ) => {
          if (char.startsWith('f000aa02')) {
            mockBoard.onAck((code: number) =>
              listener(null, {
                value: Buffer.from([code]).toString('base64'),
              }),
            );
          }
          return { remove: jest.fn() };
        },
      ),
      writeCharacteristicWithResponseForDevice: jest.fn(
        async (_id: string, _svc: string, char: string, value: string) => {
          mockBoard.write(char, Buffer.from(value, 'base64'));
        },
      ),
      writeCharacteristicWithoutResponseForDevice: jest.fn(
        async (_id: string, _svc: string, char: string, value: string) => {
          mockBoard.write(char, Buffer.from(value, 'base64'));
        },
      ),
    })),
  };
});

// Keep the transfer's own debug logging out of the transcript.
(global as unknown as { __DEV__: boolean }).__DEV__ = false;

const BleService = require('../src/services/ble/bleManager').default;

const DEVICE_ID = 'AA:BB:CC:DD:EE:FF';
const MFCC_FS_BITS = 0x42f723ac; // IEEE-754 bits of 123.56967163085938

describe('board-side CRC helper', () => {
  it('reproduces a known CRC-32 vector', () => {
    // Guards the simulated board's own maths: crc32_ieee("123456789") is
    // 0xCBF43926, so a passing transfer cannot be an artefact of this helper.
    expect(crc32IeeeUpdate(Buffer.from('123456789'), 0)).toBe(0xcbf43926);
  });
});

describe('sendModelZip against a simulated board (kws_edge_learning)', () => {
  const progress: number[] = [];

  beforeAll(async () => {
    await BleService.connectDevice(DEVICE_ID);
    // Mirrors ModelUpdateModal: subscribe to ACKs, then start the transfer.
    BleService.subscribeToModelAck(DEVICE_ID, () => {});
    await BleService.sendModelZip(
      DEVICE_ID,
      '/tmp/kws_edge_learning.zip',
      (p: number) => progress.push(p),
    );
    if (FW_LOG) {
      console.log(
        `[APP] transfer completed, progress reported to UI: ${Math.round(
          progress[progress.length - 1],
        )}%`,
      );
    }
  }, 60000);

  it('is accepted by the board: INFO CRC matches the header it rebuilt', () => {
    expect(mockBoard.infoCrc).toBe(mockBoard.infoExpectedCrc);
    expect(mockBoard.infoCrc).toBe(0x970df4c7);
    expect(mockBoard.acks).not.toContain(ACK_CRC_FAIL);
  });

  it('lands the four new fields on the board, not firmware defaults', () => {
    expect(mockBoard.meta.mfccFsBits).toBe(MFCC_FS_BITS);
    expect(mockBoard.meta.silenceClass).toBe(10);
    expect(mockBoard.meta.unknownClass).toBe(11);
    expect(mockBoard.meta.inferenceMode).toBe(1); // info.yaml says async
  });

  it('sends the whole model: info bytes intact and DATA CRC accepted', () => {
    expect(mockBoard.infoBytes.equals(mockInfoBytes)).toBe(true);
    expect(mockBoard.meta.totalLength).toBe(58600);
    // The board CRCs what it received; matching the payload's own CRC means
    // every data chunk arrived intact.
    expect(mockBoard.dataCrc).toBe(
      (crc32IeeeUpdate(mockDataBytes, 0xffffffff) ^ 0xffffffff) >>> 0,
    );
    expect(progress[progress.length - 1]).toBe(100);
  });

  it('writes the new characteristics before streaming the info chunks', () => {
    const order = mockBoard.writeOrder;
    const firstChunk = order.indexOf(CHAR.fileTransfer);
    for (const uuid of [
      CHAR.mfccFs,
      CHAR.silenceClass,
      CHAR.unknownClass,
      CHAR.inferenceMode,
    ]) {
      const at = order.indexOf(uuid);
      expect(at).toBeGreaterThan(-1);
      expect(at).toBeLessThan(firstChunk);
    }
  });
});
