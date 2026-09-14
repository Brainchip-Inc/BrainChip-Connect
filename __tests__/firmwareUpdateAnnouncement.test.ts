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
  { status: 'unconfirmed', reason: 'unanswered' },
  { status: 'failed', failedWhile: 'sending', detail: 'Upload error' },
  { status: 'failed', failedWhile: 'installing', detail: 'error 3' },
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

  it('claims nothing was changed only when the image never reached the board', () => {
    const neverArrived = describeUpdateEnding({
      status: 'failed',
      failedWhile: 'sending',
      detail: 'Upload error at offset 0',
    });
    const arrivedButUninstalled = describeUpdateEnding({
      status: 'failed',
      failedWhile: 'installing',
      detail: 'The board would not install the firmware, error 3.',
    });

    expect(neverArrived.message).toContain('nothing on it was changed');
    expect(arrivedButUninstalled.message).not.toContain('nothing on it');
    expect(arrivedButUninstalled.message).toContain(
      'took the whole firmware file',
    );
    expect(arrivedButUninstalled.message).toContain(
      'The board would not install the firmware, error 3.',
    );
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
