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
import { FirmwareUpdateEnding } from '../src/types/firmwareUpdate';

const ENDINGS: FirmwareUpdateEnding[] = [
  { status: 'installed', version: '1.2.0' },
  { status: 'rejected', runningVersion: '1.1.1' },
  { status: 'unconfirmed', reason: 'unidentifiable' },
  { status: 'unconfirmed', reason: 'unreachable' },
  { status: 'unconfirmed', reason: 'unanswered' },
  { status: 'failed', detail: 'Upload error at offset 0' },
];

describe('describeUpdateEnding', () => {
  it('gives every ending its own statement', () => {
    const messages = ENDINGS.map(ending => describeUpdateEnding(ending).message);

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
        'firmware you sent and restarted on its previous version. Nothing on ' +
        'the board was changed.',
    );
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
      detail: 'Upload error at offset 50000',
    });

    expect(failed.message).toContain('still running its previous firmware');
    expect(failed.message).not.toMatch(/nothing on (it|the board)/);
    expect(failed.message).toContain('Upload error at offset 50000');
  });

  it('does not say a board it never reached restarted or was asked anything', () => {
    const unreachable = describeUpdateEnding({
      status: 'unconfirmed',
      reason: 'unreachable',
    });

    expect(unreachable.message).toContain('could not reach your AkidaTag');
    expect(unreachable.message).not.toContain('restarted');
    expect(unreachable.message).not.toContain('did not answer');
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
