/**
 * The wire contract for sending a model to an AkidaTag board over BLE.
 *
 * The board is authoritative for this format; it is specified in
 * `docs/ble-model-transfer.md` in the AkidaTag firmware repository, and both
 * sides are built from that page. The shape is the one the app's own firmware
 * path already uses: send in pieces, each carrying its absolute offset, and be
 * told after every block what the board has committed.
 *
 * One constant is deliberately absent from this file. The size of a block
 * arrives in every status notification and is never written down here, because
 * the protocol this replaces mirrored a buffer size in two repositories where
 * it could silently disagree.
 */

/** Opcodes for the control characteristic. */
export const CONTROL_START = 0x01;
export const CONTROL_ABORT = 0x02;

/** Which half of a session a message refers to. */
export const TRANSFER_TYPE_INFO = 0x00;
export const TRANSFER_TYPE_DATA = 0x01;

/** Bytes of absolute offset that prefix every data write. */
export const DATA_OFFSET_BYTES = 4;

/** Length of a status notification, which is always this. */
export const STATUS_LENGTH = 14;

/** What a status notification says happened. */
export enum TransferResult {
  /** START accepted, or a block is committed and verified. */
  Ok = 0x00,
  /** The whole file arrived, passed its integrity check, and is stored. */
  Done = 0x01,
  /** A write arrived at an offset the board was not expecting. */
  ErrOffset = 0x02,
  /** The whole-file check failed: a CRC mismatch, or a bad readback. */
  ErrIntegrity = 0x03,
  /** A sector erase, a page program, or a block readback failed. */
  ErrFlash = 0x04,
  /** A message arrived that makes no sense at this point in a session. */
  ErrState = 0x05,
  /** START was rejected, or a data write was malformed. */
  ErrParam = 0x06,
  /** The board discarded the transfer, on request or of its own accord. */
  Aborted = 0x07,
  /** The stored model is programmed into the Akida chip and inferred. */
  Ready = 0x08,
  /** The model is stored and verified, but this board cannot run it. */
  ErrProgram = 0x09,
}

/**
 * How long the board has to answer at each of the points the app waits.
 *
 * Each is the recommendation from the specification, which sizes them by what
 * the board is actually doing: validating parameters, erasing and programming
 * one sector, re-reading a whole file, or programming the Akida chip.
 */
export const START_STATUS_TIMEOUT_MS = 2000;
export const BLOCK_STATUS_TIMEOUT_MS = 5000;
export const LAST_BLOCK_STATUS_TIMEOUT_MS = 30000;
export const INSTALL_STATUS_TIMEOUT_MS = 60000;

/** One status notification, as the board sends it. */
export interface TransferStatus {
  result: TransferResult;
  /** The half of the session this refers to, INFO or DATA. */
  transferType: number;
  /** Bytes the board takes at a time, which the app must pace itself by. */
  blockSize: number;
  /** The byte offset the board expects in the next data write. */
  position: number;
  /** The total length the transfer in progress was started with. */
  total: number;
}

/**
 * Read a status notification.
 *
 * @param frame - Raw notification bytes.
 * @returns The status, or null if the board sent something that is not one.
 */
export const parseTransferStatus = (frame: Buffer): TransferStatus | null => {
  if (frame.length !== STATUS_LENGTH) {
    return null;
  }

  return {
    result: frame[0],
    transferType: frame[1],
    blockSize: frame.readUInt32LE(2),
    position: frame.readUInt32LE(6),
    total: frame.readUInt32LE(10),
  };
};

/**
 * Build the control frame that begins a transfer.
 *
 * @param transferType - TRANSFER_TYPE_INFO or TRANSFER_TYPE_DATA.
 * @param totalLength - Bytes this transfer will carry.
 */
export const buildStartFrame = (
  transferType: number,
  totalLength: number,
): Buffer => {
  const frame = Buffer.alloc(6);
  frame[0] = CONTROL_START;
  frame[1] = transferType;
  frame.writeUInt32LE(totalLength >>> 0, 2);
  return frame;
};

/** Build the control frame that abandons the transfer in progress. */
export const buildAbortFrame = (): Buffer => Buffer.from([CONTROL_ABORT]);

/**
 * Build one data write: the absolute offset of the payload, then the payload.
 *
 * The payload is taken as a plain byte array rather than a Buffer because a
 * slice of one is not always a Buffer: React Native's polyfill returns a bare
 * Uint8Array from `subarray`, which has none of Buffer's own methods.
 *
 * @param offset - Where these bytes belong in the file.
 * @param payload - The bytes themselves.
 */
export const buildDataFrame = (offset: number, payload: Uint8Array): Buffer => {
  const frame = Buffer.alloc(DATA_OFFSET_BYTES + payload.length);
  frame.writeUInt32LE(offset >>> 0, 0);
  frame.set(payload, DATA_OFFSET_BYTES);
  return frame;
};

/**
 * Plain wording for a result code that ended a transfer.
 *
 * @param result - The code the board reported.
 * @returns A sentence about what the board did, never a code on its own.
 */
export const describeTransferFailure = (result: number): string => {
  switch (result) {
    case TransferResult.ErrOffset:
      return 'The app and the board lost track of each other partway through the transfer.';
    case TransferResult.ErrIntegrity:
      return 'The board checked the model it received and found it damaged, so it kept none of it.';
    case TransferResult.ErrFlash:
      return 'The board could not write the model to its storage.';
    case TransferResult.ErrState:
      return 'The board was not expecting that step of the transfer.';
    case TransferResult.ErrParam:
      return 'The board refused this model: it is not one this board can take.';
    case TransferResult.Aborted:
      return 'The board abandoned the transfer.';
    default:
      return `The board reported something the app does not understand (0x${result
        .toString(16)
        .padStart(2, '0')}).`;
  }
};

/** What to tell the user when the board stops answering altogether. */
export const BOARD_WENT_QUIET =
  'The board stopped answering partway through the transfer.';

/**
 * A model update failure carrying wording the app wrote itself.
 *
 * Most of what can go wrong surfaces as a `BleError` from the Bluetooth stack,
 * whose message is native text worth having in a log and worth nothing to the
 * person holding the board, so the screen shows a failure's own message only
 * when it came from here.
 */
export class ModelUpdateError extends Error {
  /**
   * Whether the board is left with no model at all until a transfer completes.
   *
   * It is true from the moment the board is asked to begin the data half,
   * because the record naming the stored model is deleted then and the flash
   * it described is overwritten a sector at a time. A model being replaced in
   * place cannot also be kept, so this is the fact the user needs most: their
   * board is not merely un-updated, it has nothing to run.
   */
  readonly boardHasNoModel: boolean;

  constructor(message: string, boardHasNoModel: boolean) {
    super(message);
    this.boardHasNoModel = boardHasNoModel;
  }
}
