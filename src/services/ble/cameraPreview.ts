/**
 * The camera preview frame, as the BrainBoard1500 Nicla Vision firmware sends
 * it on the notify characteristic it shares with the microphone waveform.
 *
 * The layout is specified in `examples/bb15_nicla_vision_connect/README.md`
 * in the `brainboard1500_arduino_library` repository, under "The camera
 * preview frame". Every chunk repeats the image geometry, so a reader keeps
 * no state beyond the one image it is putting together.
 */

/** First byte of every binary frame, shared with the waveform. */
export const BINARY_FRAME_MAGIC = 0x42;

/** Second byte of a preview chunk, which tells it apart from the waveform. */
export const PREVIEW_COMMAND = 0x0d;

/** Bytes before the pixels in every chunk. */
export const PREVIEW_HEADER_BYTES = 10;

/** The one pixel format the firmware sends: one byte of luminance per pixel. */
export const PREVIEW_FORMAT_GRAYSCALE = 0;

/** One notification's worth of a preview image. */
export interface PreviewChunk {
  /** Which image the pixels belong to; it changes once per image. */
  sequence: number;
  /** Where the pixels sit within the image, in bytes from its first pixel. */
  offset: number;
  width: number;
  height: number;
  /** Grayscale pixels, row-major, top row first. */
  pixels: Uint8Array;
}

/** A whole preview image, once every chunk of it has arrived. */
export interface PreviewImage {
  sequence: number;
  width: number;
  height: number;
  /** `width * height` grayscale pixels, row-major, top row first. */
  pixels: Uint8Array;
}

/**
 * Read a little-endian unsigned 16-bit value.
 *
 * Written out rather than read through a Buffer method because a slice of a
 * Buffer is a bare Uint8Array on React Native.
 *
 * @param bytes - The frame being read.
 * @param at - Offset of the low byte.
 */
const readUint16LE = (bytes: Uint8Array, at: number): number =>
  bytes[at] | (bytes[at + 1] << 8);

/**
 * Read one preview chunk off the wire.
 *
 * @param frame - The whole notification, magic byte first.
 * @returns The chunk, or null when the frame is not a well-formed preview
 *   chunk: wrong magic or command, a pixel format this app cannot draw, or
 *   pixels that would fall outside the image the header describes.
 */
export const parsePreviewChunk = (frame: Uint8Array): PreviewChunk | null => {
  if (frame.length < PREVIEW_HEADER_BYTES) {
    return null;
  }
  if (frame[0] !== BINARY_FRAME_MAGIC || frame[1] !== PREVIEW_COMMAND) {
    return null;
  }
  if (frame[8] !== PREVIEW_FORMAT_GRAYSCALE) {
    return null;
  }

  const width = frame[6];
  const height = frame[7];
  const offset = readUint16LE(frame, 4);
  // Copied out so the chunk is a plain Uint8Array whatever the notification
  // arrived as, and outlives the buffer it was read from.
  const pixels = new Uint8Array(frame.subarray(PREVIEW_HEADER_BYTES));
  if (width === 0 || height === 0 || offset + pixels.length > width * height) {
    return null;
  }

  return {
    sequence: readUint16LE(frame, 2),
    offset,
    width,
    height,
    pixels,
  };
};

/** The image being put together, and which of its bytes have arrived. */
interface ImageInProgress {
  image: PreviewImage;
  covered: Uint8Array;
  coveredBytes: number;
}

/**
 * Put preview chunks back together into images.
 *
 * The board always sends its newest frame and never queues, and chunks are
 * dropped in flight on purpose so that feeding the preview never stalls the
 * detector. So an image that is still incomplete when a chunk of the next one
 * arrives is thrown away rather than held: showing it later would mean
 * showing something older than what the board has since sent.
 */
export class PreviewAssembler {
  private inProgress: ImageInProgress | null = null;

  /**
   * Take in one chunk.
   *
   * @param chunk - The chunk, as `parsePreviewChunk` read it.
   * @returns The finished image when this chunk completed one, else null.
   */
  accept(chunk: PreviewChunk): PreviewImage | null {
    if (!this.belongsToImageInProgress(chunk)) {
      this.inProgress = this.startImage(chunk);
    }
    const current = this.inProgress as ImageInProgress;

    current.image.pixels.set(chunk.pixels, chunk.offset);
    for (let index = 0; index < chunk.pixels.length; index++) {
      const at = chunk.offset + index;
      if (current.covered[at] === 0) {
        current.covered[at] = 1;
        current.coveredBytes++;
      }
    }

    if (current.coveredBytes < current.image.pixels.length) {
      return null;
    }
    this.inProgress = null;
    return current.image;
  }

  /** Forget any half-built image, for when streaming starts or stops. */
  reset(): void {
    this.inProgress = null;
  }

  /**
   * Say whether a chunk continues the image being built.
   *
   * @param chunk - The chunk that just arrived.
   */
  private belongsToImageInProgress(chunk: PreviewChunk): boolean {
    const current = this.inProgress?.image;
    return (
      current !== undefined &&
      current.sequence === chunk.sequence &&
      current.width === chunk.width &&
      current.height === chunk.height
    );
  }

  /**
   * Begin an empty image of the geometry a chunk names.
   *
   * @param chunk - The first chunk seen of the new image.
   */
  private startImage(chunk: PreviewChunk): ImageInProgress {
    const size = chunk.width * chunk.height;
    return {
      image: {
        sequence: chunk.sequence,
        width: chunk.width,
        height: chunk.height,
        pixels: new Uint8Array(size),
      },
      covered: new Uint8Array(size),
      coveredBytes: 0,
    };
  }
}
