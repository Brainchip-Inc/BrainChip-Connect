/**
 * Turn grayscale pixels into a PNG the `Image` component can show.
 *
 * React Native has no way to draw raw pixels, so a preview frame becomes an
 * image file in memory. PNG is used because both platforms decode it, and the
 * pixel data is stored rather than compressed: a preview frame is a few
 * kilobytes, and encoding has to stay far cheaper than the detection results
 * it must never hold up.
 */

import { Buffer } from 'buffer';
import CRC32 from 'crc-32';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const BIT_DEPTH_EIGHT = 8;
const COLOR_TYPE_GRAYSCALE = 0;
const FILTER_NONE = 0;

/** A deflate stored block can carry at most this many bytes. */
const MAX_STORED_BLOCK_BYTES = 65535;

/** Zlib header for deflate with no preset dictionary. */
const ZLIB_HEADER = [0x78, 0x01];

/** Largest prime below 2^16, which Adler-32 works modulo. */
const ADLER_MODULO = 65521;

/**
 * Write a big-endian unsigned 32-bit value.
 *
 * @param into - The buffer written to.
 * @param at - Offset of the most significant byte.
 * @param value - The value, taken modulo 2^32.
 */
const writeUint32BE = (into: Uint8Array, at: number, value: number): void => {
  into[at] = (value >>> 24) & 0xff;
  into[at + 1] = (value >>> 16) & 0xff;
  into[at + 2] = (value >>> 8) & 0xff;
  into[at + 3] = value & 0xff;
};

/**
 * Adler-32 checksum, which closes a zlib stream.
 *
 * @param bytes - The uncompressed data the stream carries.
 */
const adler32 = (bytes: Uint8Array): number => {
  let low = 1;
  let high = 0;
  for (let index = 0; index < bytes.length; index++) {
    low = (low + bytes[index]) % ADLER_MODULO;
    high = (high + low) % ADLER_MODULO;
  }
  return ((high << 16) | low) >>> 0;
};

/**
 * Wrap bytes in a zlib stream that stores them without compressing.
 *
 * @param raw - The bytes to carry.
 */
const zlibStored = (raw: Uint8Array): Uint8Array => {
  const blockCount = Math.max(
    1,
    Math.ceil(raw.length / MAX_STORED_BLOCK_BYTES),
  );
  const stream = new Uint8Array(
    ZLIB_HEADER.length + raw.length + blockCount * 5 + 4,
  );
  stream.set(ZLIB_HEADER, 0);

  let cursor = ZLIB_HEADER.length;
  for (let block = 0; block < blockCount; block++) {
    const start = block * MAX_STORED_BLOCK_BYTES;
    const length = Math.min(MAX_STORED_BLOCK_BYTES, raw.length - start);
    const isLast = block === blockCount - 1;

    stream[cursor++] = isLast ? 1 : 0;
    stream[cursor++] = length & 0xff;
    stream[cursor++] = (length >>> 8) & 0xff;
    stream[cursor++] = ~length & 0xff;
    stream[cursor++] = (~length >>> 8) & 0xff;
    stream.set(raw.subarray(start, start + length), cursor);
    cursor += length;
  }

  writeUint32BE(stream, cursor, adler32(raw));
  return stream;
};

/**
 * Build one PNG chunk: length, type, data and the CRC over type and data.
 *
 * @param type - Four ASCII characters naming the chunk.
 * @param data - The chunk's payload.
 */
const pngChunk = (type: string, data: Uint8Array): Uint8Array => {
  const chunk = new Uint8Array(12 + data.length);
  writeUint32BE(chunk, 0, data.length);
  for (let index = 0; index < 4; index++) {
    chunk[4 + index] = type.charCodeAt(index);
  }
  chunk.set(data, 8);
  writeUint32BE(
    chunk,
    8 + data.length,
    CRC32.buf(chunk.subarray(4, 8 + data.length)) >>> 0,
  );
  return chunk;
};

/**
 * Lay the pixels out as PNG scanlines, each led by a filter byte.
 *
 * @param pixels - Grayscale pixels, row-major, top row first.
 * @param width - Pixels per row.
 * @param height - Number of rows.
 */
const scanlines = (
  pixels: Uint8Array,
  width: number,
  height: number,
): Uint8Array => {
  const lines = new Uint8Array(height * (width + 1));
  for (let row = 0; row < height; row++) {
    lines[row * (width + 1)] = FILTER_NONE;
    lines.set(
      pixels.subarray(row * width, (row + 1) * width),
      row * (width + 1) + 1,
    );
  }
  return lines;
};

/**
 * Join byte arrays into one.
 *
 * @param parts - The arrays, in order.
 */
const concatBytes = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const joined = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    joined.set(part, cursor);
    cursor += part.length;
  }
  return joined;
};

/**
 * Encode grayscale pixels as a PNG file.
 *
 * @param pixels - `width * height` grayscale pixels, row-major, top row first.
 * @param width - Pixels per row.
 * @param height - Number of rows.
 * @returns The bytes of a PNG file.
 * @throws If the pixel count does not match the geometry.
 */
export const encodeGrayscalePng = (
  pixels: Uint8Array,
  width: number,
  height: number,
): Uint8Array => {
  if (pixels.length !== width * height) {
    throw new Error(
      `Expected ${width * height} pixels for ${width}x${height}, got ${
        pixels.length
      }`,
    );
  }

  const header = new Uint8Array(13);
  writeUint32BE(header, 0, width);
  writeUint32BE(header, 4, height);
  header[8] = BIT_DEPTH_EIGHT;
  header[9] = COLOR_TYPE_GRAYSCALE;

  return concatBytes([
    new Uint8Array(PNG_SIGNATURE),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlibStored(scanlines(pixels, width, height))),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
};

/**
 * Encode grayscale pixels as a PNG the `Image` component can be pointed at.
 *
 * @param pixels - `width * height` grayscale pixels, row-major, top row first.
 * @param width - Pixels per row.
 * @param height - Number of rows.
 * @returns A `data:` URI holding the PNG.
 */
export const grayscalePngDataUri = (
  pixels: Uint8Array,
  width: number,
  height: number,
): string =>
  `data:image/png;base64,${Buffer.from(
    encodeGrayscalePng(pixels, width, height),
  ).toString('base64')}`;
