/**
 * What a firmware update turned out to be, decided by asking the board which
 * firmware it is running once it has restarted.
 *
 * A wrongly signed image is refused by the bootloader on the next boot, long
 * after the transfer itself has succeeded, so nothing during the transfer can
 * report it. `rejected` is that case, and it is the only thing the board makes
 * knowable: it never says why it refused an image.
 */
export type FirmwareUpdateOutcome =
  | { status: 'installed'; version: string }
  | { status: 'rejected'; runningVersion: string | null }
  | { status: 'unconfirmed'; reason: UnconfirmedReason };

/**
 * Why an update could not be confirmed, which decides what the app can honestly
 * tell the user about it.
 *
 * `unidentifiable` is the board never having reported the serial that tells one
 * AkidaTag from another, so it cannot be recognised after the reboot and is
 * never asked. `unanswered` is the board having been asked and not answered,
 * whether it never came back within reach or would not report its image.
 */
export type UnconfirmedReason = 'unidentifiable' | 'unanswered';

/**
 * How far a transfer got before it failed, which decides what the app can
 * honestly say was left on the board.
 *
 * `sending` is the image never having reached the board in full, so nothing on
 * it changed. `installing` is the board having stored the whole image and then
 * not installing it, which leaves that image in its spare slot.
 */
export type FirmwareTransferStep = 'sending' | 'installing';

/** Stage of an update in flight, for the screen to describe to the user. */
export type FirmwareUpdatePhase =
  | 'sending'
  | 'installing'
  | 'restarting'
  | 'checking';

/** Firmware the user picked, with what its header says about it. */
export interface SelectedFirmware {
  name: string;
  path: string;
  sizeBytes: number;
  version: string;
  keyHash: string | null;
}

/** A picked file signed with a different key than this board last accepted. */
export interface SigningKeyWarning {
  fileKeyHash: string;
  boardKeyHash: string;
}

/**
 * Where an update has got to, and how it ended.
 *
 * The three failing endings are deliberately distinct: `rejected` is the board
 * refusing to run firmware it accepted the transfer of, `failed` is the
 * transfer itself going wrong, and `unconfirmed` is the app being unable to
 * find out either way.
 */
export type FirmwareUpdateStage =
  | { kind: 'idle' }
  | { kind: 'sending'; percent: number }
  | { kind: 'restarting' }
  | { kind: 'checking' }
  | { kind: 'installed'; version: string }
  | { kind: 'rejected'; runningVersion: string | null }
  | { kind: 'unconfirmed'; reason: UnconfirmedReason }
  | { kind: 'failed'; failedWhile: FirmwareTransferStep; detail: string };

/** The stages an update finishes in, as opposed to passes through. */
export type FirmwareUpdateEnding = Extract<
  FirmwareUpdateStage,
  { kind: 'installed' | 'rejected' | 'unconfirmed' | 'failed' }
>;
