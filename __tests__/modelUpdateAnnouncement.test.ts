/**
 * Pins the statements the app makes about how a model update ended.
 *
 * The board reports twice, and the whole reason it does is that the app used
 * to announce the first report as success. A model that arrived safely is not
 * a model that runs, and a board part way through having its model replaced
 * has nothing to run at all. Both are things the user has to be told, so both
 * are checked here rather than left to whatever wording a screen happens to
 * carry.
 *
 * @format
 */

import { describeModelUpdateEnding } from '../src/services/ble/modelUpdateAnnouncement';
import { ModelUpdateEnding } from '../src/types/modelUpdate';

/** The board these cases are held against, which is not the only one sold. */
const BOARD = 'BrainBoard1500';

/**
 * Word an ending for a board with a name, which is every ending a user sees.
 *
 * @param ending - How the update turned out.
 * @returns What the card would show.
 */
const announce = (ending: ModelUpdateEnding) =>
  describeModelUpdateEnding(ending, BOARD);

const ENDINGS: ModelUpdateEnding[] = [
  { status: 'installed' },
  { status: 'not-running' },
  {
    status: 'failed',
    detail: 'The board could not write the model to its storage.',
    boardHasNoModel: true,
  },
  {
    status: 'failed',
    detail: 'The board refused this model.',
    boardHasNoModel: false,
  },
  { status: 'failed', boardHasNoModel: false },
];

describe('describeModelUpdateEnding', () => {
  it('gives every ending its own statement', () => {
    const messages = ENDINGS.map(ending => announce(ending).message);

    expect(new Set(messages).size).toBe(ENDINGS.length);
  });

  it('claims success only for a model the board said it is running', () => {
    const installed = announce({ status: 'installed' });

    expect(installed.mark).toBe('success');
    expect(installed.message).toContain('running it');

    ENDINGS.filter(ending => ending.status !== 'installed').forEach(ending => {
      expect(announce(ending).mark).not.toBe('success');
    });
  });

  it('reports a stored model that will not start as neither of the two', () => {
    const { title, message, mark } = announce({
      status: 'not-running',
    });

    // It is not a failed transfer: every byte arrived and was verified. It is
    // not a success either, so it carries no mark at all.
    expect(mark).toBeNull();
    expect(title).toBe('Model delivered, but not running');
    expect(message).toContain('Restarting the board');
  });

  it('says when the board is left with nothing to run', () => {
    const stranded = announce({
      status: 'failed',
      detail: 'The board could not write the model to its storage.',
      boardHasNoModel: true,
    });
    const untouched = announce({
      status: 'failed',
      detail: 'The board refused this model.',
      boardHasNoModel: false,
    });

    expect(stranded.message).toContain('no model to run');
    expect(untouched.message).toContain('still running the model it had');
  });

  it('carries the reason the board gave, when it gave one', () => {
    const { message } = announce({
      status: 'failed',
      detail: 'The board could not write the model to its storage.',
      boardHasNoModel: true,
    });

    expect(message).toContain('could not write the model to its storage');
  });
});
