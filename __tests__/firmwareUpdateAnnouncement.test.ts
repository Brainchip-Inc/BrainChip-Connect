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

import { describeUpdateEnding } from '../src/services/firmware/firmwareUpdateAnnouncement';
import {
  FirmwareUpdateEnding,
  UnconfirmedReason,
} from '../src/types/firmwareUpdate';

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
    const messages = ENDINGS.map(
      ending => describeUpdateEnding(ending).message,
    );

    expect(new Set(messages).size).toBe(ENDINGS.length);
  });

  it('never names a signing key, which the board never reports', () => {
    ENDINGS.forEach(ending => {
      const { title, message } = describeUpdateEnding(ending);

      expect(`${title} ${message}`.toLowerCase()).not.toContain('key');
    });
  });

  it('reports a refusal as a refusal, naming the firmware still running', () => {
    const { title, message } = describeUpdateEnding({
      status: 'rejected',
      runningVersion: '1.1.1',
    });

    expect(title).toBe('Update did not install');
    expect(message).toBe(
      'Your AkidaTag is still running firmware 1.1.1. It did not accept the ' +
        'firmware you sent and restarted on its previous version.',
    );
  });

  it('never claims nothing on the board was changed', () => {
    // A refused image is written to the spare slot before the board ever
    // looks at it, and on the board this bug was found on it stays there.
    ENDINGS.forEach(ending => {
      expect(describeUpdateEnding(ending).message).not.toMatch(
        /nothing on (it|the board)/i,
      );
    });
  });

  it('does not invent a version the board never reported', () => {
    const { message } = describeUpdateEnding({
      status: 'rejected',
      runningVersion: null,
    });

    expect(message).toContain('still running its previous firmware');
    expect(message).not.toMatch(/null|undefined/);
  });

  it('claims nothing was left on the board only where the board erased it', () => {
    // A transfer can fail with half the image already written to the spare
    // slot, so the only ending that can promise an untouched board is the one
    // where the bootloader itself threw the image away.
    const failed = describeUpdateEnding({
      status: 'failed',
      detail: 'The board stopped accepting the firmware partway through.',
    });

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
    const { message } = describeUpdateEnding({ status: 'failed' });

    expect(message).toContain('still running its previous firmware');
    expect(message).not.toContain('Details');
    expect(message).not.toMatch(/undefined/);
  });

  it('does not call a board that never restarted a refusal', () => {
    // The image is still on the board and will install on the next power
    // cycle, so the refusal wording would be wrong twice and would leave the
    // user surprised when the firmware turns up anyway.
    const { title, message } = describeUpdateEnding({
      status: 'not-restarted',
      runningVersion: '1.1.1',
    });

    expect(title).not.toContain('did not install');
    expect(message).toContain('did not restart');
    expect(message).toContain('still running firmware 1.1.1');
    expect(message).toContain('powered off and on');
    expect(message).not.toContain('did not accept');
    expect(message).not.toContain('Nothing on the board was changed');
  });

  it('does not say it could not reach a board it did reach', () => {
    const found = describeUpdateEnding({
      status: 'unconfirmed',
      reason: 'unrecognised',
    });

    expect(found.message).toContain('did find an AkidaTag');
    expect(found.message).not.toContain('could not reach');
    expect(found.message).not.toMatch(/fail/i);
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
      const { message } = describeUpdateEnding({
        status: 'unconfirmed',
        reason,
      });

      expect(message).toContain('The firmware was sent');
      expect(message).not.toMatch(/restart/i);
    });
  });

  it('says a success is a success only for a confirmed install', () => {
    const installed = describeUpdateEnding({
      status: 'installed',
      version: '1.2.0',
    });

    expect(installed.title).toBe('Update installed');
    expect(installed.message).toContain('now running firmware 1.2.0');

    ENDINGS.filter(ending => ending.status !== 'installed').forEach(ending => {
      expect(describeUpdateEnding(ending).message).not.toContain(
        'now running firmware',
      );
    });
  });
});
