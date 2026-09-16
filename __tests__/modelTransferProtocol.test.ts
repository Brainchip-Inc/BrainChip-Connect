/**
 * Pins the byte layouts the AkidaTag firmware reads and writes.
 *
 * These are the shapes the two repositories agreed on, and the app has no way
 * of discovering a mistake in them at runtime: a status read one field out
 * still parses, and a data write missing its offset prefix is taken as bytes.
 * So the layouts are fixed here against the specification rather than against
 * the code that produces them.
 *
 * @format
 */

import {
  DATA_OFFSET_BYTES,
  STATUS_LENGTH,
  TransferResult,
  buildAbortFrame,
  buildDataFrame,
  buildStartFrame,
  describeTransferFailure,
  parseTransferStatus,
} from '../src/services/ble/modelTransferProtocol';

/** Build a status the way the firmware does: 14 little-endian bytes. */
const statusFrame = (
  result: number,
  transferType: number,
  blockSize: number,
  position: number,
  total: number,
): Buffer => {
  const frame = Buffer.alloc(STATUS_LENGTH);
  frame[0] = result;
  frame[1] = transferType;
  frame.writeUInt32LE(blockSize, 2);
  frame.writeUInt32LE(position, 6);
  frame.writeUInt32LE(total, 10);
  return frame;
};

describe('parseTransferStatus', () => {
  it('reads every field of a status the board sent', () => {
    const status = parseTransferStatus(
      statusFrame(TransferResult.Ok, 0x01, 4096, 8192, 102236),
    );

    expect(status).toEqual({
      result: TransferResult.Ok,
      transferType: 0x01,
      blockSize: 4096,
      position: 8192,
      total: 102236,
    });
  });

  it('reads a position past the sign bit as the count of bytes it is', () => {
    const status = parseTransferStatus(
      statusFrame(TransferResult.Ok, 0x01, 4096, 0x80000000, 0xffffffff),
    );

    expect(status?.position).toBe(2147483648);
    expect(status?.total).toBe(4294967295);
  });

  it('refuses anything that is not a status', () => {
    // The old protocol answered with a single byte, and a board still speaking
    // it must read as silence rather than as a transfer going well.
    expect(parseTransferStatus(Buffer.from([0xcc]))).toBeNull();
    expect(parseTransferStatus(Buffer.alloc(STATUS_LENGTH - 1))).toBeNull();
    expect(parseTransferStatus(Buffer.alloc(STATUS_LENGTH + 1))).toBeNull();
  });
});

describe('frames the app writes', () => {
  it('starts a transfer with its type and length', () => {
    expect([...buildStartFrame(0x01, 102236)]).toEqual([
      0x01, 0x01, 0x5c, 0x8f, 0x01, 0x00,
    ]);
  });

  it('abandons a transfer with one byte', () => {
    expect([...buildAbortFrame()]).toEqual([0x02]);
  });

  it('prefixes data with the absolute offset it belongs at', () => {
    const frame = buildDataFrame(0x0102, Buffer.from([0xaa, 0xbb]));

    expect(frame).toHaveLength(DATA_OFFSET_BYTES + 2);
    expect(frame.readUInt32LE(0)).toBe(0x0102);
    expect([...frame.subarray(DATA_OFFSET_BYTES)]).toEqual([0xaa, 0xbb]);
  });

  it('takes a payload that is a plain byte array, not only a Buffer', () => {
    // A slice of a Buffer is a bare Uint8Array under React Native's polyfill,
    // and that is what every chunk of a real transfer arrives here as. Node's
    // own Buffer hands back a Buffer, so nothing else in these tests would
    // notice this frame builder reaching for a method only Buffer has.
    const frame = buildDataFrame(4096, Uint8Array.from([0x01, 0x02, 0x03]));

    expect(frame.readUInt32LE(0)).toBe(4096);
    expect([...frame.subarray(DATA_OFFSET_BYTES)]).toEqual([1, 2, 3]);
  });
});

describe('describeTransferFailure', () => {
  it('gives each way a transfer can end its own statement', () => {
    const failures = [
      TransferResult.ErrOffset,
      TransferResult.ErrIntegrity,
      TransferResult.ErrFlash,
      TransferResult.ErrState,
      TransferResult.ErrParam,
      TransferResult.Aborted,
    ];
    const messages = failures.map(describeTransferFailure);

    expect(new Set(messages).size).toBe(failures.length);
  });

  it('names a code it does not know rather than inventing a cause', () => {
    expect(describeTransferFailure(0x5a)).toContain('0x5a');
  });
});
