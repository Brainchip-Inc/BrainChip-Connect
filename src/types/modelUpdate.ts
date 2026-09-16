/**
 * What a model update turned out to be, once the board has said so.
 *
 * The board reports twice, and the two are not the same thing. First the file
 * has arrived, passed its integrity check and been stored. Then, seconds
 * later, the model has been programmed into the Akida chip and has run a test
 * inference. Only the second is the update having succeeded, so `not-running`
 * is a model that is safely on the board and that the board cannot run. The
 * protocol offers no way to ask it to try again: restarting the board retries
 * the same installation from the same stored record, and sending a different
 * model is the other thing that can help.
 */
export type ModelUpdateOutcome = 'installed' | 'not-running';

/**
 * How an update ended, which is every way it can stop once it has begun.
 *
 * `failed` is the transfer itself going wrong, before the board ever had a
 * whole model to install, and it carries whether that leaves the board with
 * nothing to run.
 */
export type ModelUpdateEnding =
  | { status: ModelUpdateOutcome }
  | { status: 'failed'; detail?: string; boardHasNoModel: boolean };

/**
 * Where an update has got to, from the moment the user starts it until they
 * close the result.
 *
 * `sending` and `installing` are deliberately separate. The transfer reaching
 * its last byte is the board having the model, not the board running it, and
 * the two take different lengths of time.
 */
export type ModelUpdateStage =
  | { kind: 'idle' }
  | { kind: 'sending'; percent: number }
  | { kind: 'installing' }
  | { kind: 'done'; ending: ModelUpdateEnding };

/** Model package the user picked, with what the file itself says about it. */
export interface SelectedModel {
  name: string;
  path: string;
  sizeBytes: number;
}
