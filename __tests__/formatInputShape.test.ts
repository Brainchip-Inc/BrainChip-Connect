/**
 * Checks that an input shape reads the same whatever spacing a board uses.
 *
 * @format
 */

import { formatInputShape } from '../src/app/utils/formatInputShape';

describe('formatInputShape', () => {
  it('drops the spaces a board puts around each x', () => {
    expect(formatInputShape('49 x 10 x 1')).toBe('49x10x1');
  });

  it('leaves a shape reported without spaces unchanged', () => {
    expect(formatInputShape('49x10x1')).toBe('49x10x1');
    expect(formatInputShape('96x96x3')).toBe('96x96x3');
  });

  it('leaves the placeholder for a shape not yet reported unchanged', () => {
    expect(formatInputShape('-')).toBe('-');
  });
});
