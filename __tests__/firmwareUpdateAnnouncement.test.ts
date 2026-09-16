/**
 * Pins the statements the app makes about how a firmware update ended.
 *
 * This is the whole point of the change: a refused update used to be announced
 * as "Firmware updated successfully". Every ending now has to say what
 * actually happened to that board, so the endings are driven through
 * `describeUpdateEnding` and checked against what each one can prove.
 *
 * @format
 */

import {
  describeUpdateEnding,
  UpdateAnnouncement,
} from '../src/services/firmware/firmwareUpdateAnnouncement';
import {
  FirmwareUpdateEnding,
  UnconfirmedReason,
} from '../src/types/firmwareUpdate';

/** The board these cases are held against, which is not the only one sold. */
const BOARD = 'BrainBoard1500';

/**
 * Word an ending for a board with a name, which is every ending a user sees.
 *
 * @param ending - How the update turned out.
 * @param stillConnected - Whether the app was still holding the board.
 * @returns What the modal would show.
 */
const announce = (
  ending: FirmwareUpdateEnding,
  stillConnected: boolean,
): UpdateAnnouncement => describeUpdateEnding(ending, stillConnected, BOARD);

const ENDINGS: FirmwareUpdateEnding[] = [
  { status: 'installed', version: '1.2.0' },
  { status: 'rejected', runningVersion: '1.1.1' },
  { status: 'not-restarted', runningVersion: '1.1.1' },
  { status: 'unconfirmed', reason: 'unidentifiable' },
  { status: 'unconfirmed', reason: 'unreachable' },
  { status: 'unconfirmed', reason: 'unrecognised' },
  { status: 'unconfirmed', reason: 'unanswered' },
  {
    status: 'failed',
    detail: 'The board stopped accepting the firmware partway through.',
  },
  { status: 'failed' },
];

describe('describeUpdateEnding', () => {
  it('gives every ending its own statement', () => {
    const messages = ENDINGS.map(ending => announce(ending, false).message);

    expect(new Set(messages).size).toBe(ENDINGS.length);
  });

  it('never names a signing key, which the board never reports', () => {
    ENDINGS.forEach(ending => {
      const { title, message } = announce(ending, false);

      expect(`${title} ${message}`.toLowerCase()).not.toContain('key');
    });
  });

  it('reports a refusal as a refusal, naming the firmware still running', () => {
    const { title, message } = announce(
      {
        status: 'rejected',
        runningVersion: '1.1.1',
      },
      false,
    );

    expect(title).toBe('Update did not install');
    expect(message).toBe(
      `Your ${BOARD} is still running firmware 1.1.1. It did not accept the ` +
        'firmware you sent and restarted on its previous version.',
    );
  });

  it('never claims nothing on the board was changed', () => {
    // A refused image is written to the spare slot before the board ever
    // looks at it, and on the board this bug was found on it stays there.
    ENDINGS.forEach(ending => {
      expect(announce(ending, false).message).not.toMatch(
        /nothing on (it|the board)/i,
      );
    });
  });

  it('does not invent a version the board never reported', () => {
    const { message } = announce(
      {
        status: 'rejected',
        runningVersion: null,
      },
      false,
    );

    expect(message).toContain('still running its previous firmware');
    expect(message).not.toMatch(/null|undefined/);
  });

  it('claims nothing was left on the board only where the board erased it', () => {
    // A transfer can fail with half the image already written to the spare
    // slot, so the only ending that can promise an untouched board is the one
    // where the bootloader itself threw the image away.
    const failed = announce(
      {
        status: 'failed',
        detail: 'The board stopped accepting the firmware partway through.',
      },
      false,
    );

    expect(failed.message).toContain('still running its previous firmware');
    expect(failed.message).not.toMatch(/nothing on (it|the board)/);
    expect(failed.message).toContain(
      'The board stopped accepting the firmware partway through.',
    );
  });

  it('offers no details when the app has none of its own to give', () => {
    // What the Bluetooth stack says about a dropped link is native text with
    // a MAC address in it, so a failure the app did not word itself arrives
    // here carrying nothing, and the card must not advertise an empty detail.
    const { message } = announce({ status: 'failed' }, false);

    expect(message).toContain('still running its previous firmware');
    expect(message).not.toContain('Details');
    expect(message).not.toMatch(/undefined/);
  });

  it('does not call a board that never restarted a refusal', () => {
    // The image is still on the board and will install on the next power
    // cycle, so the refusal wording would be wrong twice and would leave the
    // user surprised when the firmware turns up anyway.
    const { title, message } = announce(
      {
        status: 'not-restarted',
        runningVersion: '1.1.1',
      },
      false,
    );

    expect(title).not.toContain('did not install');
    expect(message).toContain('did not restart');
    expect(message).toContain('still running firmware 1.1.1');
    expect(message).toContain('powered off and on');
    expect(message).not.toContain('did not accept');
    expect(message).not.toContain('Nothing on the board was changed');
  });

  it('does not say it could not reach a board it did reach', () => {
    const found = announce(
      {
        status: 'unconfirmed',
        reason: 'unrecognised',
      },
      false,
    );

    expect(found.message).toContain('did find a board');
    expect(found.message).not.toContain('could not reach');
    expect(found.message).not.toMatch(/fail/i);
  });

  it('tells the user to let go of the board only when there is one to let go of', () => {
    // Every reason reaches both states: the board can drop the link between
    // being recognised and being asked, and one that was never rebooted is
    // still there to be found again. So the instruction turns on what the
    // radio said, and saying it the other way round would have the app
    // describe its own connection wrongly.
    const reasons: UnconfirmedReason[] = [
      'unidentifiable',
      'unreachable',
      'unrecognised',
      'unanswered',
    ];

    reasons.forEach(reason => {
      const ending = { status: 'unconfirmed', reason } as const;

      const stillHolding = announce(ending, true);
      expect(stillHolding.message).toContain('still connected to the board');
      expect(stillHolding.message).toContain('Disconnect');

      const letGo = announce(ending, false);
      expect(letGo.message).toContain(
        `Select your ${BOARD} in the device list`,
      );
      expect(letGo.message).not.toContain('Disconnect');
    });
  });

  it('never claims a restart it did not watch happen', () => {
    // None of these endings involves the app seeing the board come back on a
    // new image, so none of them may say it restarted. Only the unreachable
    // wording used to get this right.
    const reasons: UnconfirmedReason[] = [
      'unidentifiable',
      'unreachable',
      'unrecognised',
      'unanswered',
    ];

    reasons.forEach(reason => {
      const { message } = announce({ status: 'unconfirmed', reason }, false);

      expect(message).toContain('The firmware was sent');
      expect(message).not.toMatch(/restart/i);
    });
  });

  it('marks the two endings the board settles, and only those', () => {
    // A tick or a cross is as strong a claim as the wording, so the endings
    // the app could not decide get neither rather than the nearest one.
    expect(
      announce({ status: 'installed', version: '1.2.0' }, false).mark,
    ).toBe('success');
    expect(
      announce({ status: 'rejected', runningVersion: '1.1.1' }, false).mark,
    ).toBe('failure');
    expect(announce({ status: 'failed' }, false).mark).toBe('failure');

    const undecided: FirmwareUpdateEnding[] = [
      { status: 'not-restarted', runningVersion: '1.1.1' },
      { status: 'unconfirmed', reason: 'unidentifiable' },
      { status: 'unconfirmed', reason: 'unreachable' },
      { status: 'unconfirmed', reason: 'unrecognised' },
      { status: 'unconfirmed', reason: 'unanswered' },
    ];

    undecided.forEach(ending => {
      expect(announce(ending, false).mark).toBeNull();
    });
  });

  it('never marks an ending green unless the board confirmed the install', () => {
    ENDINGS.filter(ending => ending.status !== 'installed').forEach(ending => {
      expect(announce(ending, false).mark).not.toBe('success');
    });
  });

  it('says a success is a success only for a confirmed install', () => {
    const installed = announce(
      {
        status: 'installed',
        version: '1.2.0',
      },
      false,
    );

    expect(installed.title).toBe('Update installed');
    expect(installed.message).toContain('now running firmware 1.2.0');

    ENDINGS.filter(ending => ending.status !== 'installed').forEach(ending => {
      expect(announce(ending, false).message).not.toContain(
        'now running firmware',
      );
    });
  });
});
