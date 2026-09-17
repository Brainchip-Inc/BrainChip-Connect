/**
 * Pins the camera preview chunk to the layout the BrainBoard1500 Nicla Vision
 * firmware sends, and the way whole images are put back together from it.
 *
 * The layout is the table under "The camera preview frame" in the example's
 * README in the brainboard1500_arduino_library repository, and `sendPreview`
 * in its `ble_protocol.cpp` is the sender these frames are modelled on. The
 * two halves have to meet on the wire, so the bytes are written out here by
 * offset rather than built with the parser's own helpers.
 *
 * @format
 */

import { Buffer } from 'buffer';
import { parseBinaryFrame } from '../src/services/ble/bleParser';
import {
  parsePreviewChunk,
  PREVIEW_HEADER_BYTES,
  PreviewAssembler,
  PreviewChunk,
} from '../src/services/ble/cameraPreview';

/** Pixels per chunk the firmware sends: a 239-byte notification less header. */
const FIRMWARE_CHUNK_PIXELS = 229;

/**
 * One preview chunk exactly as the firmware lays it out.
 *
 * @param sequence - Image number.
 * @param offset - Byte offset of these pixels within the image.
 * @param width - Image width.
 * @param height - Image height.
 * @param pixels - The pixels this chunk carries.
 * @param format - Pixel format byte, grayscale unless a case says otherwise.
 */
const chunkFrame = (
  sequence: number,
  offset: number,
  width: number,
  height: number,
  pixels: ArrayLike<number>,
  format = 0,
): Buffer => {
  const frame = Buffer.alloc(PREVIEW_HEADER_BYTES + pixels.length);
  frame[0] = 0x42;
  frame[1] = 0x0d;
  frame.writeUInt16LE(sequence, 2);
  frame.writeUInt16LE(offset, 4);
  frame[6] = width;
  frame[7] = height;
  frame[8] = format;
  frame[9] = 0;
  frame.set(pixels, PREVIEW_HEADER_BYTES);
  return frame;
};

/**
 * Split one image into chunks the way `sendPreview` does.
 *
 * @param sequence - Image number.
 * @param width - Image width.
 * @param height - Image height.
 * @param pixels - The whole image.
 */
const chunksOf = (
  sequence: number,
  width: number,
  height: number,
  pixels: Uint8Array,
): PreviewChunk[] => {
  const chunks: PreviewChunk[] = [];
  for (
    let offset = 0;
    offset < pixels.length;
    offset += FIRMWARE_CHUNK_PIXELS
  ) {
    const frame = chunkFrame(
      sequence,
      offset,
      width,
      height,
      pixels.subarray(offset, offset + FIRMWARE_CHUNK_PIXELS),
    );
    chunks.push(parsePreviewChunk(frame) as PreviewChunk);
  }
  return chunks;
};

/** A test image whose pixels say where they are, so a misplaced one shows. */
const gradient = (width: number, height: number): Uint8Array =>
  Uint8Array.from({ length: width * height }, (_, index) => index % 251);

describe('reading a preview chunk off the wire', () => {
  it('reads every header field from the offset the firmware writes it at', () => {
    const frame = chunkFrame(0x1234, 0x0abc, 96, 96, [7, 8, 9]);

    expect(parsePreviewChunk(frame)).toEqual({
      sequence: 0x1234,
      offset: 0x0abc,
      width: 96,
      height: 96,
      pixels: Uint8Array.from([7, 8, 9]),
    });
  });

  it('takes a full firmware chunk, whose pixels fill the notification', () => {
    const pixels = gradient(96, 96).subarray(0, FIRMWARE_CHUNK_PIXELS);
    const frame = chunkFrame(1, 0, 96, 96, pixels);

    expect(frame.length).toBe(239);
    expect(parsePreviewChunk(frame)?.pixels).toEqual(Uint8Array.from(pixels));
  });

  it('refuses a frame that is not a preview chunk', () => {
    const preview = chunkFrame(1, 0, 4, 4, [1, 2, 3, 4]);

    const wrongMagic = Buffer.from(preview);
    wrongMagic[0] = 0x41;
    const waveform = Buffer.from(preview);
    waveform[1] = 0x0c;

    expect(parsePreviewChunk(wrongMagic)).toBeNull();
    expect(parsePreviewChunk(waveform)).toBeNull();
    expect(parsePreviewChunk(preview.subarray(0, 9))).toBeNull();
  });

  it('refuses a pixel format it cannot draw', () => {
    expect(
      parsePreviewChunk(chunkFrame(1, 0, 4, 4, [1, 2, 3, 4], 1)),
    ).toBeNull();
  });

  it('refuses pixels that would land outside the image', () => {
    expect(parsePreviewChunk(chunkFrame(1, 14, 4, 4, [1, 2, 3]))).toBeNull();
    expect(parsePreviewChunk(chunkFrame(1, 0, 0, 4, []))).toBeNull();
  });

  it('is what the binary frame router hands on, beside the waveform', () => {
    const preview = chunkFrame(3, 0, 2, 2, [10, 20, 30, 40]);
    const waveform = Buffer.alloc(6 + 64 * 2);
    waveform[0] = 0x42;
    waveform[1] = 0x0c;
    waveform.writeUInt16LE(64, 4);

    expect(parseBinaryFrame(preview)).toEqual({
      type: 'PREVIEW_CHUNK',
      data: {
        sequence: 3,
        offset: 0,
        width: 2,
        height: 2,
        pixels: Uint8Array.from([10, 20, 30, 40]),
      },
    });
    expect(parseBinaryFrame(waveform)?.type).toBe('WAVE');
  });
});

describe('putting an image back together', () => {
  it('finishes a 96 by 96 image on its last chunk and not before', () => {
    const pixels = gradient(96, 96);
    const chunks = chunksOf(7, 96, 96, pixels);
    const assembler = new PreviewAssembler();

    expect(chunks).toHaveLength(41);
    chunks.slice(0, -1).forEach(chunk => {
      expect(assembler.accept(chunk)).toBeNull();
    });

    const image = assembler.accept(chunks[chunks.length - 1]);
    expect(image).not.toBeNull();
    expect(image?.sequence).toBe(7);
    expect(image?.width).toBe(96);
    expect(image?.height).toBe(96);
    expect(Buffer.from(image?.pixels ?? [])).toEqual(Buffer.from(pixels));
  });

  it('places chunks by their own offset whatever order they arrive in', () => {
    const pixels = gradient(96, 96);
    const chunks = chunksOf(1, 96, 96, pixels).reverse();
    const assembler = new PreviewAssembler();

    const results = chunks.map(chunk => assembler.accept(chunk));

    expect(results.slice(0, -1).every(result => result === null)).toBe(true);
    expect(Buffer.from(results[results.length - 1]?.pixels ?? [])).toEqual(
      Buffer.from(pixels),
    );
  });

  it('drops an image that the next one overtakes before it is whole', () => {
    // The board sends its newest frame and never queues, so a chunk that went
    // missing in flight means the rest of that image is never coming. Holding
    // the partial image would mean showing something older than the board
    // has since sent.
    const first = chunksOf(1, 96, 96, gradient(96, 96));
    const second = gradient(96, 96).map(value => 255 - value);
    const assembler = new PreviewAssembler();

    first.slice(1).forEach(chunk => {
      expect(assembler.accept(chunk)).toBeNull();
    });

    const results = chunksOf(2, 96, 96, second).map(chunk =>
      assembler.accept(chunk),
    );
    const image = results[results.length - 1];

    expect(results.slice(0, -1).every(result => result === null)).toBe(true);
    expect(image?.sequence).toBe(2);
    expect(Buffer.from(image?.pixels ?? [])).toEqual(Buffer.from(second));

    // The first image's missing chunk turning up late starts a new image
    // rather than reviving the dropped one.
    expect(assembler.accept(first[0])).toBeNull();
  });

  it('does not count the same chunk twice towards a whole image', () => {
    const chunks = chunksOf(1, 4, 4, gradient(4, 4));
    const assembler = new PreviewAssembler();
    const [only] = chunks;
    const half: PreviewChunk = { ...only, pixels: only.pixels.subarray(0, 8) };

    expect(assembler.accept(half)).toBeNull();
    expect(assembler.accept(half)).toBeNull();
    expect(assembler.accept(only)).not.toBeNull();
  });

  it('takes a change of geometry as a new image', () => {
    const assembler = new PreviewAssembler();
    const [small] = chunksOf(1, 2, 2, gradient(2, 2));
    const [large] = chunksOf(1, 3, 3, gradient(3, 3));

    expect(
      assembler.accept({ ...small, pixels: small.pixels.subarray(0, 2) }),
    ).toBeNull();
    expect(assembler.accept(large)?.width).toBe(3);
  });

  it('forgets a half-built image when reset', () => {
    const assembler = new PreviewAssembler();
    const [only] = chunksOf(1, 4, 4, gradient(4, 4));

    expect(
      assembler.accept({ ...only, pixels: only.pixels.subarray(0, 8) }),
    ).toBeNull();
    assembler.reset();
    expect(
      assembler.accept({
        ...only,
        offset: 8,
        pixels: only.pixels.subarray(8, 16),
      }),
    ).toBeNull();
  });
});
