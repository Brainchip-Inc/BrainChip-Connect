/**
 * Drives `sendModelZip` against a simulated board that enforces the transfer
 * protocol the AkidaTag firmware implements.
 *
 * The board below is deliberately strict, because every rule it enforces is
 * one the app has to obey and cannot check for itself: a data write must carry
 * the exact offset the board expects next, must not cross a block boundary,
 * and must be paced by the block size the board announced rather than any
 * number the app brought with it. A transfer completing here is that whole
 * contract holding, which is what the old shape could not express: it
 * acknowledged nothing but a whole 102,236-byte window, so a desynchronised
 * transfer was only ever caught by the CRC at the very end, if at all.
 *
 * It also rebuilds `model_meta_t` from the characteristics it actually
 * received and recomputes `model_info_hdr_crc32` the way `file_transfer.c`
 * does, implemented here from the polynomial so the check is not circular.
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
  data: 'f000aa01-0451-4000-b000-000000000000',
  status: 'f000aa02-0451-4000-b000-000000000000',
  control: 'f000aa03-0451-4000-b000-000000000000',
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

const OPCODE_START = 0x01;
const OPCODE_ABORT = 0x02;

const TYPE_INFO = 0x00;
const TYPE_DATA = 0x01;

const RESULT_OK = 0x00;
const RESULT_DONE = 0x01;
const RESULT_ERR_OFFSET = 0x02;
const RESULT_ERR_INTEGRITY = 0x03;
const RESULT_ERR_STATE = 0x05;
const RESULT_ERR_PARAM = 0x06;
const RESULT_ABORTED = 0x07;
const RESULT_READY = 0x08;
const RESULT_ERR_PROGRAM = 0x09;

const MAX_MODEL_INFO_SIZE = 2300;

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

const wholeFileCrc = (bytes: Buffer): number =>
  (crc32IeeeUpdate(bytes, 0xffffffff) ^ 0xffffffff) >>> 0;

const hex = (v: number) =>
  `0x${(v >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;

/** How many blocks a file of this length takes, the last one usually short. */
const blocksIn = (length: number, blockSize: number) =>
  Math.ceil(length / blockSize);

/** How the board should treat a transfer it has taken in full. */
type BoardBehaviour = 'accept' | 'corrupt-the-data' | 'refuse-to-program';

/**
 * Stand-in for the board's file transfer service.
 *
 * It stores session metadata as it arrives, then runs a transfer the way the
 * firmware does: one block at a time, answering each with the byte offset it
 * expects next, and checking the whole file before it calls it stored.
 */
class SimulatedBoard {
  blockSize = 4096;
  behaviour: BoardBehaviour = 'accept';
  subscribed = false;

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
  armed = false;
  announcedLength = 0;
  position = 0;
  staged: Buffer[] = [];

  writeOrder: string[] = [];
  statuses: number[] = [];
  log: string[] = [];
  startedWithoutSubscription = false;
  infoCrc: number | null = null;
  infoExpectedCrc: number | null = null;
  dataCrc: number | null = null;
  infoBytes: Buffer = Buffer.alloc(0);
  dataBytes: Buffer = Buffer.alloc(0);

  private statusListener: ((frame: Buffer) => void) | null = null;

  reset() {
    this.armed = false;
    this.position = 0;
    this.staged = [];
    this.writeOrder = [];
    this.statuses = [];
    this.log = [];
    this.expectedCrc = 0;
    this.startedWithoutSubscription = false;
    this.infoCrc = null;
    this.infoExpectedCrc = null;
    this.dataCrc = null;
    this.infoBytes = Buffer.alloc(0);
    this.dataBytes = Buffer.alloc(0);
  }

  onStatus(listener: (frame: Buffer) => void) {
    this.subscribed = true;
    this.statusListener = listener;
  }

  private say(line: string) {
    this.log.push(line);
    if (FW_LOG) console.log(`[FW] ${line}`);
  }

  private notify(result: number) {
    this.statuses.push(result);

    const frame = Buffer.alloc(14);
    frame[0] = result;
    frame[1] = this.transferType;
    frame.writeUInt32LE(this.blockSize, 2);
    frame.writeUInt32LE(this.position, 6);
    frame.writeUInt32LE(this.announcedLength, 10);

    // Notifications arrive asynchronously, after the write completes.
    setTimeout(() => this.statusListener?.(frame), 0);
  }

  write(charUUID: string, payload: Buffer) {
    this.writeOrder.push(charUUID);
    const u32 = () => payload.readUInt32LE(0);

    switch (charUUID) {
      case CHAR.control:
        this.handleControl(payload);
        break;
      case CHAR.data:
        this.handleData(payload);
        break;
      case CHAR.fsName:
        this.meta.fsName = payload.toString('utf8');
        // Firmware: model_name = basename of the fs_name path.
        this.meta.modelName = this.meta.fsName.split('/').pop() ?? '';
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
      default:
        break;
    }
  }

  private handleControl(payload: Buffer) {
    if (payload[0] === OPCODE_ABORT) {
      this.armed = false;
      this.staged = [];
      this.position = 0;
      this.say('Transfer abandoned');
      this.notify(RESULT_ABORTED);
      return;
    }

    if (payload[0] !== OPCODE_START) {
      this.notify(RESULT_ERR_PARAM);
      return;
    }

    if (!this.subscribed) {
      this.startedWithoutSubscription = true;
    }

    this.transferType = payload[1];
    this.announcedLength = payload.readUInt32LE(2);
    this.position = 0;
    this.staged = [];

    if (this.announcedLength === 0) {
      this.armed = false;
      this.notify(RESULT_ERR_PARAM);
      return;
    }
    if (
      this.transferType === TYPE_INFO &&
      this.announcedLength > MAX_MODEL_INFO_SIZE
    ) {
      this.armed = false;
      this.notify(RESULT_ERR_PARAM);
      return;
    }
    if (this.transferType === TYPE_DATA && !this.meta.modelName) {
      this.armed = false;
      this.notify(RESULT_ERR_STATE);
      return;
    }

    this.armed = true;
    this.say(
      `START ${this.transferType === TYPE_INFO ? 'INFO' : 'DATA'} ` +
        `${this.announcedLength} bytes, blocks of ${this.blockSize}`,
    );
    this.notify(RESULT_OK);
  }

  private handleData(payload: Buffer) {
    if (!this.armed) {
      this.notify(RESULT_ERR_STATE);
      return;
    }
    if (payload.length < 5) {
      this.armed = false;
      this.notify(RESULT_ERR_PARAM);
      return;
    }

    const offset = payload.readUInt32LE(0);
    const bytes = payload.subarray(4);

    if (offset !== this.position) {
      this.armed = false;
      this.say(`Offset ${offset} arrived, ${this.position} expected`);
      this.notify(RESULT_ERR_OFFSET);
      return;
    }

    const roomInBlock = this.blockSize - (offset % this.blockSize);
    if (
      bytes.length > roomInBlock ||
      offset + bytes.length > this.announcedLength
    ) {
      this.armed = false;
      this.say(`Write of ${bytes.length} bytes at ${offset} crosses a block`);
      this.notify(RESULT_ERR_PARAM);
      return;
    }

    this.staged.push(Buffer.from(bytes));
    this.position += bytes.length;

    const blockComplete =
      this.position % this.blockSize === 0 ||
      this.position === this.announcedLength;
    if (!blockComplete) return;

    if (this.position === this.announcedLength) {
      this.finishTransfer();
      return;
    }

    this.say(`Block committed, ${this.position} bytes in flash`);
    this.notify(RESULT_OK);
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
    const received = Buffer.concat(this.staged);
    this.armed = false;

    if (this.transferType === TYPE_INFO) {
      this.infoBytes = received;
      this.infoExpectedCrc = this.expectedCrc;

      const header = this.packHeader(received.length);
      const computed =
        (crc32IeeeUpdate(received, crc32IeeeUpdate(header, 0xffffffff)) ^
          0xffffffff) >>>
        0;
      this.infoCrc = computed;
      this.say(`model_info_hdr_crc32 ${hex(computed)}`);

      if (computed !== this.expectedCrc) {
        this.notify(RESULT_ERR_INTEGRITY);
        return;
      }
      this.notify(RESULT_DONE);
      return;
    }

    this.dataBytes = received;
    const stored =
      this.behaviour === 'corrupt-the-data'
        ? Buffer.concat([
            Buffer.from([received[0] ^ 0xff]),
            received.subarray(1),
          ])
        : received;
    const computed = wholeFileCrc(stored);
    this.dataCrc = computed;

    if (computed !== this.expectedCrc) {
      this.say(
        `DATA CRC FAIL ${hex(computed)} against ${hex(this.expectedCrc)}`,
      );
      this.notify(RESULT_ERR_INTEGRITY);
      return;
    }

    this.say(`DATA CRC OK ${hex(computed)}, record stored`);
    this.notify(RESULT_DONE);

    // Programming the Akida chip is a separate step that takes its own time
    // and reports its own result.
    setTimeout(() => {
      this.notify(
        this.behaviour === 'refuse-to-program'
          ? RESULT_ERR_PROGRAM
          : RESULT_READY,
      );
    }, 5);
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
      requestMTUForDevice: jest.fn(async () => ({ mtu: 247 })),
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
            mockBoard.onStatus((frame: Buffer) =>
              listener(null, { value: frame.toString('base64') }),
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
const {
  ModelUpdateError,
} = require('../src/services/ble/modelTransferProtocol');

const DEVICE_ID = 'AA:BB:CC:DD:EE:FF';
const ZIP_PATH = '/tmp/kws_edge_learning.zip';
const MFCC_FS_BITS = 0x42f723ac; // IEEE-754 bits of 123.56967163085938

describe('board-side CRC helper', () => {
  it('reproduces a known CRC-32 vector', () => {
    // Guards the simulated board's own maths: crc32_ieee("123456789") is
    // 0xCBF43926, so a passing transfer cannot be an artefact of this helper.
    expect(crc32IeeeUpdate(Buffer.from('123456789'), 0)).toBe(0xcbf43926);
  });
});

describe('a model transfer the board accepts', () => {
  const progress: number[] = [];
  let outcome: string;

  beforeAll(async () => {
    mockBoard.reset();
    mockBoard.behaviour = 'accept';
    mockBoard.blockSize = 4096;

    await BleService.connectDevice(DEVICE_ID);
    outcome = await BleService.sendModelZip(DEVICE_ID, ZIP_PATH, {
      onProgress: (p: number) => progress.push(p),
    });
  }, 60000);

  it('is accepted by the board: the INFO CRC matches the header it rebuilt', () => {
    expect(mockBoard.infoCrc).toBe(mockBoard.infoExpectedCrc);
    expect(mockBoard.infoCrc).toBe(0x970df4c7);
  });

  it('lands the runtime fields on the board, not firmware defaults', () => {
    expect(mockBoard.meta.mfccFsBits).toBe(MFCC_FS_BITS);
    expect(mockBoard.meta.silenceClass).toBe(10);
    expect(mockBoard.meta.unknownClass).toBe(11);
    expect(mockBoard.meta.inferenceMode).toBe(1); // info.yaml says async
    expect(mockBoard.meta.totalLength).toBe(58600);
  });

  it('sends every byte of both files intact', () => {
    expect(mockBoard.infoBytes.equals(mockInfoBytes)).toBe(true);
    expect(mockBoard.dataBytes.equals(mockDataBytes)).toBe(true);
    expect(mockBoard.dataCrc).toBe(wholeFileCrc(mockDataBytes));
    expect(progress[progress.length - 1]).toBe(100);
  });

  it('never trips the board over an offset or a block boundary', () => {
    expect(mockBoard.statuses).not.toContain(RESULT_ERR_OFFSET);
    expect(mockBoard.statuses).not.toContain(RESULT_ERR_PARAM);
    expect(mockBoard.statuses).not.toContain(RESULT_ERR_STATE);
  });

  it('stops at every block, not at some size of its own', () => {
    const acknowledgements = mockBoard.statuses.filter(
      s => s === RESULT_OK || s === RESULT_DONE,
    );
    // One for each START, then one per block of each file.
    expect(acknowledgements).toHaveLength(
      1 + blocksIn(mockInfoBytes.length, 4096) + 1 + blocksIn(56936, 4096),
    );
  });

  it('subscribes to the board before asking it to begin', () => {
    expect(mockBoard.startedWithoutSubscription).toBe(false);
  });

  it('writes the metadata the CRC covers before the first START', () => {
    const order = mockBoard.writeOrder;
    const firstStart = order.indexOf(CHAR.control);

    for (const uuid of [
      CHAR.app,
      CHAR.fsName,
      CHAR.totalLength,
      CHAR.inputShape,
      CHAR.outputShape,
      CHAR.flashAddress,
      CHAR.isEdgeLearned,
      CHAR.numEdgeClasses,
      CHAR.mfccFs,
      CHAR.silenceClass,
      CHAR.unknownClass,
      CHAR.inferenceMode,
      CHAR.crc,
    ]) {
      const at = order.indexOf(uuid);
      expect(at).toBeGreaterThan(-1);
      expect(at).toBeLessThan(firstStart);
    }
  });

  it('never writes the characteristics the protocol removed', () => {
    expect(mockBoard.writeOrder).not.toContain(CHAR.fileSize);
    expect(mockBoard.writeOrder).not.toContain(CHAR.transferType);
  });

  it('reports the model as running only once the board says so', () => {
    expect(outcome).toBe('installed');
    expect(mockBoard.statuses[mockBoard.statuses.length - 1]).toBe(
      RESULT_READY,
    );
  });
});

describe('a board that asks for a different block size', () => {
  beforeAll(async () => {
    mockBoard.reset();
    mockBoard.behaviour = 'accept';
    // Nothing in the app may assume 4,096: the size is the board's to name,
    // and a mirrored constant is the mistake this protocol exists to stop.
    mockBoard.blockSize = 1024;

    await BleService.connectDevice(DEVICE_ID);
    await BleService.sendModelZip(DEVICE_ID, ZIP_PATH);
  }, 60000);

  it('paces itself by what the board asked for', () => {
    expect(mockBoard.dataBytes.equals(mockDataBytes)).toBe(true);
    expect(mockBoard.statuses).not.toContain(RESULT_ERR_PARAM);
    expect(mockBoard.statuses).not.toContain(RESULT_ERR_OFFSET);

    const acknowledgements = mockBoard.statuses.filter(
      s => s === RESULT_OK || s === RESULT_DONE,
    );
    expect(acknowledgements).toHaveLength(
      1 + blocksIn(mockInfoBytes.length, 1024) + 1 + blocksIn(56936, 1024),
    );
  });
});

describe('a model the board finds damaged', () => {
  let failure: unknown;

  beforeAll(async () => {
    mockBoard.reset();
    mockBoard.behaviour = 'corrupt-the-data';

    await BleService.connectDevice(DEVICE_ID);
    try {
      await BleService.sendModelZip(DEVICE_ID, ZIP_PATH);
    } catch (error: unknown) {
      failure = error;
    }
  }, 60000);

  it('fails rather than reporting an update that did not happen', () => {
    expect(failure).toBeInstanceOf(ModelUpdateError);
    expect((failure as Error).message).toContain('damaged');
  });

  it('says the board is left with no model to run', () => {
    expect((failure as { boardHasNoModel: boolean }).boardHasNoModel).toBe(
      true,
    );
  });
});

describe('a model the board stores but cannot start', () => {
  let outcome: string;

  beforeAll(async () => {
    mockBoard.reset();
    mockBoard.behaviour = 'refuse-to-program';

    await BleService.connectDevice(DEVICE_ID);
    outcome = await BleService.sendModelZip(DEVICE_ID, ZIP_PATH);
  }, 60000);

  it('is not reported as an update that worked', () => {
    expect(outcome).toBe('not-running');
    expect(mockBoard.statuses).toContain(RESULT_DONE);
    expect(mockBoard.statuses[mockBoard.statuses.length - 1]).toBe(
      RESULT_ERR_PROGRAM,
    );
  });
});

describe('an update the user stops', () => {
  let failure: unknown;

  beforeAll(async () => {
    mockBoard.reset();
    mockBoard.behaviour = 'accept';

    await BleService.connectDevice(DEVICE_ID);

    const transfer = BleService.sendModelZip(DEVICE_ID, ZIP_PATH, {
      onProgress: (percent: number) => {
        if (percent > 20) BleService.stopModelTransfer();
      },
    });

    try {
      await transfer;
    } catch (error: unknown) {
      failure = error;
    }
  }, 60000);

  it('stops partway and tells the board to let go of what it has', () => {
    expect(failure).toBeInstanceOf(ModelUpdateError);
    expect((failure as Error).message).toContain('stopped');
    expect(mockBoard.statuses).toContain(RESULT_ABORTED);
    expect(mockBoard.armed).toBe(false);
    expect(mockBoard.dataBytes).toHaveLength(0);
  });
});
