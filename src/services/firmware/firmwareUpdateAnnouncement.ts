import { FirmwareUpdateEnding } from '../../types/firmwareUpdate';

/** The alert that tells the user how a firmware update ended. */
export interface UpdateAnnouncement {
  title: string;
  message: string;
}

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

  if (ending.status === 'failed') {
    const wentWrong =
      ending.failedWhile === 'sending'
        ? 'The firmware could not be sent to your AkidaTag. The board is ' +
          'still running its previous firmware and nothing on it was changed.'
        : 'Your AkidaTag took the whole firmware file but did not install ' +
          'it. The board is still running its previous firmware.';

    return {
      title: 'Update failed',
      message: `${wentWrong}\n\nDetails: ${ending.detail}`,
    };
  }

  const couldNotAsk =
    ending.reason === 'unidentifiable'
      ? 'The firmware was sent and your AkidaTag restarted, but it never ' +
        'reported the serial number that tells one AkidaTag from another. ' +
        'The app could not be sure it was asking the same board, so it did ' +
        'not ask.'
      : 'The firmware was sent and your AkidaTag restarted, but it did not ' +
        'answer when the app asked which firmware it is now running.';

  return {
    title: 'Could not confirm the update',
    message:
      `${couldNotAsk}\n\nSelect your AkidaTag in the device list to see the ` +
      'firmware version it is running now.',
  };
};
