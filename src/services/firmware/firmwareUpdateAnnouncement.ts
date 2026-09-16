import {
  FirmwareUpdateEnding,
  UnconfirmedReason,
} from '../../types/firmwareUpdate';

/**
 * Mark shown above an ending, or null when the app cannot tell how it went.
 *
 * Only the two endings the board settles get one. An update that was never
 * confirmed, or whose image is still waiting on a board that did not restart,
 * has not failed, and marking it failed would state something the app has no
 * way of knowing.
 */
export type UpdateMark = 'success' | 'failure' | null;

/** What the update modal says once the board's answer is in. */
export interface UpdateAnnouncement {
  title: string;
  message: string;
  mark: UpdateMark;
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
 * @param deviceName - What the board calls itself.
 * @returns The sentence explaining that ending.
 */
const describeMissedConfirmation = (
  reason: UnconfirmedReason,
  deviceName: string,
): string => {
  if (reason === 'unidentifiable') {
    return (
      `The firmware was sent, but this ${deviceName} never reported the ` +
      'serial number that tells one board from another. The app could not ' +
      'be sure which board it would be talking to afterwards, so it did ' +
      'not ask.'
    );
  }

  if (reason === 'unreachable') {
    return (
      `The firmware was sent, but the app could not reach your ${deviceName} ` +
      'again afterwards, so there is no telling what the board did with it.'
    );
  }

  if (reason === 'unrecognised') {
    return (
      'The firmware was sent, and the app did find a board afterwards, but ' +
      'it would not report the serial number that proves it is the same ' +
      `board, so there is no telling what your ${deviceName} did with the ` +
      'firmware.'
    );
  }

  return (
    `The firmware was sent and the app reached your ${deviceName} again ` +
    'afterwards, but the board would not say which firmware it is running.'
  );
};

/**
 * Say what to do about an update that could not be confirmed.
 *
 * Which board the app is left holding does not follow from why it gave up
 * looking: every reason can end either way, so this turns on what the radio
 * said when the update ended rather than on the reason. A board still held has
 * to be let go before it can be picked again, and that is a step the
 * instruction has to name rather than skip past.
 *
 * @param stillConnected - Whether the app was still holding the board when the
 *   update ended.
 * @param deviceName - What the board calls itself.
 * @returns The sentence telling the user where to look next.
 */
const whereToLookNext = (
  stillConnected: boolean,
  deviceName: string,
): string => {
  if (stillConnected) {
    return (
      'The app is still connected to the board. Disconnect from it and pick ' +
      'it again in the device list to see the firmware version it is running.'
    );
  }

  return (
    `Select your ${deviceName} in the device list to see the firmware ` +
    'version it is running now.'
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
 * @param stillConnected - Whether the app was still holding the board when the
 *   update ended, asked of the radio rather than inferred from the ending.
 * @param deviceName - What the board calls itself, since the app serves more
 *   than one kind and the user owns only theirs.
 * @returns Title, message and mark for the update modal to show.
 */
export const describeUpdateEnding = (
  ending: FirmwareUpdateEnding,
  stillConnected: boolean,
  deviceName: string,
): UpdateAnnouncement => {
  if (ending.status === 'installed') {
    return {
      title: 'Update installed',
      message:
        `Your ${deviceName} is now running firmware ${ending.version}. ` +
        'Confirmed with the board after it restarted.',
      mark: 'success',
    };
  }

  if (ending.status === 'rejected') {
    const running = ending.runningVersion
      ? `firmware ${ending.runningVersion}`
      : 'its previous firmware';

    return {
      title: 'Update did not install',
      message:
        `Your ${deviceName} is still running ${running}. It did not accept ` +
        'the firmware you sent and restarted on its previous version.',
      mark: 'failure',
    };
  }

  if (ending.status === 'not-restarted') {
    const running = ending.runningVersion
      ? `firmware ${ending.runningVersion}`
      : 'the firmware it was running before';

    return {
      title: `Your ${deviceName} did not restart`,
      message:
        `The firmware was sent, but the board did not restart, so it is ` +
        `still running ${running}. The firmware you sent is waiting on it ` +
        'and may install the next time the board is powered off and on.',
      mark: null,
    };
  }

  if (ending.status === 'failed') {
    const whatHappened =
      `The firmware update did not complete. Your ${deviceName} is still ` +
      'running its previous firmware.';

    return {
      title: 'Update failed',
      message: ending.detail
        ? `${whatHappened}\n\nDetails: ${ending.detail}`
        : whatHappened,
      mark: 'failure',
    };
  }

  return {
    title: 'Could not confirm the update',
    message:
      `${describeMissedConfirmation(ending.reason, deviceName)}\n\n` +
      whereToLookNext(stillConnected, deviceName),
    mark: null,
  };
};
