/**
 * Pins that a preview frame becomes a PNG a decoder will accept.
 *
 * The app cannot draw raw pixels, so every frame goes through this encoder on
 * its way to the screen, and an encoder that gets one CRC or one deflate
 * header wrong shows nothing at all with no error. Node's own zlib is the
 * independent check on the compressed half.
 *
 * @format
 */

import { Buffer } from 'buffer';
import CRC32 from 'crc-32';
import { inflateSync } from 'zlib';
import {
  encodeGrayscalePng,
  grayscalePngDataUri,
} from '../src/services/image/grayscalePng';

/** The chunks of a PNG, by type, with their CRCs already checked. */
const chunksByType = (png: Uint8Array): Record<string, Buffer> => {
  const file = Buffer.from(png);
  const chunks: Record<string, Buffer> = {};
  let cursor = 8;
  while (cursor < file.length) {
    const length = file.readUInt32BE(cursor);
    const type = file.toString('latin1', cursor + 4, cursor + 8);
    const data = file.subarray(cursor + 8, cursor + 8 + length);
    const crc = file.readInt32BE(cursor + 8 + length);

    expect(crc).toBe(CRC32.buf(file.subarray(cursor + 4, cursor + 8 + length)));
    chunks[type] = data;
    cursor += 12 + length;
  }
  expect(cursor).toBe(file.length);
  return chunks;
};

describe('encoding grayscale pixels as a PNG', () => {
  const pixels = Uint8Array.from([0, 64, 128, 255, 10, 20]);
  const png = encodeGrayscalePng(pixels, 3, 2);

  it('opens with the PNG signature', () => {
    expect(Buffer.from(png.subarray(0, 8)).toString('hex')).toBe(
      '89504e470d0a1a0a',
    );
  });

  it('describes an 8-bit grayscale image of the right size', () => {
    const { IHDR } = chunksByType(png);

    expect(IHDR.readUInt32BE(0)).toBe(3);
    expect(IHDR.readUInt32BE(4)).toBe(2);
    expect([...IHDR.subarray(8)]).toEqual([8, 0, 0, 0, 0]);
  });

  it('carries the pixels as unfiltered scanlines a zlib decoder recovers', () => {
    const { IDAT } = chunksByType(png);

    expect([...inflateSync(IDAT)]).toEqual([0, 0, 64, 128, 0, 255, 10, 20]);
  });

  it('ends with an empty IEND chunk', () => {
    const chunks = chunksByType(png);

    expect(Object.keys(chunks)).toEqual(['IHDR', 'IDAT', 'IEND']);
    expect(chunks.IEND).toHaveLength(0);
  });

  it('handles a preview-sized frame, whose scanlines exceed nothing', () => {
    const frame = Uint8Array.from(
      { length: 96 * 96 },
      (_, index) => index % 256,
    );
    const { IDAT } = chunksByType(encodeGrayscalePng(frame, 96, 96));
    const lines = inflateSync(IDAT);

    expect(lines).toHaveLength(96 * 97);
    for (let row = 0; row < 96; row++) {
      expect(lines[row * 97]).toBe(0);
      expect([...lines.subarray(row * 97 + 1, (row + 1) * 97)]).toEqual([
        ...frame.subarray(row * 96, (row + 1) * 96),
      ]);
    }
  });

  it('splits data past one stored block into more of them', () => {
    // A stored deflate block holds at most 65,535 bytes, so an image larger
    // than that has to be carried in several. No preview is that large, but
    // the encoder must not quietly produce a stream a decoder rejects.
    const tall = new Uint8Array(255 * 255).fill(90);
    const { IDAT } = chunksByType(encodeGrayscalePng(tall, 255, 255));

    expect(inflateSync(IDAT)).toHaveLength(255 * 256);
  });

  it('refuses pixels that do not match the geometry', () => {
    expect(() => encodeGrayscalePng(pixels, 2, 2)).toThrow(
      'Expected 4 pixels for 2x2, got 6',
    );
  });

  it('wraps the file in a data URI the Image component takes', () => {
    const uri = grayscalePngDataUri(pixels, 3, 2);

    expect(uri.startsWith('data:image/png;base64,')).toBe(true);
    expect(
      Buffer.from(uri.slice('data:image/png;base64,'.length), 'base64'),
    ).toEqual(Buffer.from(png));
  });
});
