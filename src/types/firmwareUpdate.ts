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
  | { status: 'unconfirmed' };

/** Stage of an update in flight, for the screen to describe to the user. */
export type FirmwareUpdatePhase = 'sending' | 'restarting' | 'checking';
