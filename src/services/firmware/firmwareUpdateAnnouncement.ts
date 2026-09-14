import {
  FirmwareUpdateEnding,
  UnconfirmedReason,
} from '../../types/firmwareUpdate';

/** The alert that tells the user how a firmware update ended. */
export interface UpdateAnnouncement {
  title: string;
  message: string;
}

/**
 * Say why an update could not be confirmed, in terms of what the app got as
 * far as doing.
 *
 * A board that never came back is not described as having restarted or as
 * having been asked anything: the app lost it after the firmware was sent and
 * knows nothing past that point.
 *
 * @param reason - Where the confirmation stopped.
 * @returns The sentence explaining that ending.
 */
const describeMissedConfirmation = (reason: UnconfirmedReason): string => {
  if (reason === 'unidentifiable') {
    return (
      'The firmware was sent and your AkidaTag restarted, but it never ' +
      'reported the serial number that tells one AkidaTag from another. The ' +
      'app could not be sure it was asking the same board, so it did not ask.'
    );
  }

  if (reason === 'unreachable') {
    return (
      'The firmware was sent, but the app could not reach your AkidaTag ' +
      'again afterwards, so there is no telling what the board did with it.'
    );
  }

  return (
    'The firmware was sent and your AkidaTag restarted, but it did not ' +
    'answer when the app asked which firmware it is now running.'
  );
};

/**
 * Put into words what the board did with the firmware, saying only what the
 * app can prove.
 *
 * A refusal is stated without a cause: the board never reports why it turned
 * an image down, and from the phone a wrong signing key and a corrupt image
 * are the same event, so naming either would be a guess. Each ending gets its
 * own statement rather than a phrasing vague enough to cover several, because
 * "the board refused it", "it never got there" and "it is running now" leave
 * the user with different things to do.
 *
 * @param ending - How the update turned out.
 * @returns Title and message to announce, wherever the user happens to be.
 */
export const describeUpdateEnding = (
  ending: FirmwareUpdateEnding,
): UpdateAnnouncement => {
  if (ending.status === 'installed') {
    return {
      title: 'Update installed',
      message:
        `Your AkidaTag is now running firmware ${ending.version}. ` +
        'Confirmed with the board after it restarted.',
    };
  }

  if (ending.status === 'rejected') {
    const running = ending.runningVersion
      ? `firmware ${ending.runningVersion}`
      : 'its previous firmware';

    return {
      title: 'Update did not install',
      message:
        `Your AkidaTag is still running ${running}. It did not accept the ` +
        'firmware you sent and restarted on its previous version. Nothing on ' +
        'the board was changed.',
    };
  }

  if (ending.status === 'not-restarted') {
    const running = ending.runningVersion
      ? `firmware ${ending.runningVersion}`
      : 'the firmware it was running before';

    return {
      title: 'Your AkidaTag did not restart',
      message:
        `The firmware was sent, but the board did not restart, so it is ` +
        `still running ${running}. The firmware you sent is waiting on it ` +
        'and may install the next time the board is powered off and on.',
    };
  }

  if (ending.status === 'failed') {
    return {
      title: 'Update failed',
      message:
        'The firmware update did not complete. Your AkidaTag is still ' +
        `running its previous firmware.\n\nDetails: ${ending.detail}`,
    };
  }

  return {
    title: 'Could not confirm the update',
    message:
      `${describeMissedConfirmation(ending.reason)}\n\nSelect your AkidaTag ` +
      'in the device list to see the firmware version it is running now.',
  };
};
