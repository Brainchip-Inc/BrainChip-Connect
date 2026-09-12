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

/** Stage of an update in flight, for the screen to describe to the user. */
export type FirmwareUpdatePhase = 'sending' | 'restarting' | 'checking';
