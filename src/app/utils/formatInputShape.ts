/**
 * Write a model's input shape the same way whichever board reported it.
 *
 * Boards disagree on spacing, one sending `49x10x1` and another
 * `49 x 10 x 1`, so the spaces are dropped.
 *
 * @param shape - The input shape as the board reported it.
 * @returns The shape with no whitespace, such as `49x10x1`.
 */
export const formatInputShape = (shape: string): string =>
  shape.replace(/\s+/g, '');
