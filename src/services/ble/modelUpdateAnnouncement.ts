import { UpdateAnnouncement } from '../firmware/firmwareUpdateAnnouncement';
import { ModelUpdateEnding } from '../../types/modelUpdate';

/**
 * Put into words what the board did with the model, saying only what the board
 * reported.
 *
 * The board reports twice, and the app must not collapse the two into one. A
 * model that arrived and was stored has not been installed: programming the
 * Akida chip with it and proving it infers comes afterwards and can fail on
 * its own. So `not-running` is stated as what it is, a model delivered and
 * verified that this board will not start, rather than as either a success or
 * a transfer that went wrong.
 *
 * @param ending - How the update turned out.
 * @returns Title, message and mark for the update modal to show.
 */
export const describeModelUpdateEnding = (
  ending: ModelUpdateEnding,
): UpdateAnnouncement => {
  if (ending.status === 'failed') {
    const whereItLeftTheBoard = ending.boardHasNoModel
      ? 'Your AkidaTag has no model to run until one is sent to it in full, ' +
        'because the model it had was being replaced where it stood.'
      : 'Your AkidaTag is still running the model it had.';

    return {
      title: 'Model update failed',
      message: ending.detail
        ? `${ending.detail}\n\n${whereItLeftTheBoard}`
        : `The model update did not complete. ${whereItLeftTheBoard}`,
      mark: 'failure',
    };
  }

  if (ending.status === 'installed') {
    return {
      title: 'Model installed',
      message:
        'Your AkidaTag has the new model and is running it. The board ' +
        'confirmed it loaded and ran a test inference.',
      mark: 'success',
    };
  }

  return {
    title: 'Model delivered, but not running',
    message:
      'The whole model reached your AkidaTag and the board checked and ' +
      'stored it, but it could not start it. Restarting the board makes it ' +
      'try the same model again. If that does not work, this model is not ' +
      'one this board can run and a different one is the way forward.',
    mark: null,
  };
};
