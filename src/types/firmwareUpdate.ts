/**
 * What a firmware update turned out to be, decided by asking the board which
 * firmware it is running once it has restarted.
 *
 * A wrongly signed image is refused by the bootloader on the next boot, long
 * after the transfer itself has succeeded, so nothing during the transfer can
 * report it. `rejected` is that case, and it is the only thing the board makes
 * knowable: it never says why it refused an image. `not-restarted` is the
 * board never having rebooted to look at the image at all, which the still
 * present image itself proves, since a refused one is erased.
 */
export type FirmwareUpdateOutcome =
  | { status: 'installed'; version: string }
  | { status: 'rejected'; runningVersion: string | null }
  | { status: 'not-restarted'; runningVersion: string | null }
  | { status: 'unconfirmed'; reason: UnconfirmedReason };

/**
 * Why an update could not be confirmed, which decides what the app can honestly
 * tell the user about it.
 *
 * Each is a different fact about the board. `unidentifiable` is the board never
 * having reported the serial that tells one AkidaTag from another, so it cannot
 * be recognised after the reboot and is never asked. `unreachable` is the board
 * never coming back within reach, so nothing is known about it past the moment
 * the firmware was sent. `unanswered` is the board coming back and not saying
 * which image it is running.
 */
export type UnconfirmedReason = 'unidentifiable' | 'unreachable' | 'unanswered';

/** Step of an update the board owns, which the app can only wait through. */
export type FirmwareUpdatePhase = 'restarting' | 'checking';

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

/** How far an update in flight has got, for the screen to describe. */
export type FirmwareUpdateStage =
  | { kind: 'idle' }
  | { kind: 'sending'; percent: number }
  | { kind: 'restarting' }
  | { kind: 'checking' };

/**
 * How an update ended, which is every way it can stop.
 *
 * The three failing endings are deliberately distinct: `rejected` is the board
 * refusing to run firmware it accepted the transfer of, `failed` is the
 * transfer itself going wrong before the board ever restarted, and
 * `unconfirmed` is the app being unable to find out either way.
 */
export type FirmwareUpdateEnding =
  | FirmwareUpdateOutcome
  | { status: 'failed'; detail: string };
