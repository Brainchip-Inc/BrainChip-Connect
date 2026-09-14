import { Buffer } from 'buffer';

/** Magic that opens MCUboot's `struct image_header`. */
const IMAGE_MAGIC = 0x96f3b83d;

/** Magic that opens the unprotected TLV area behind the image. */
const TLV_INFO_MAGIC = 0x6907;

const HEADER_SIZE = 32;
const TLV_INFO_SIZE = 4;
const TLV_ENTRY_SIZE = 4;

/** SHA-256 of the public key whose private half signed the image. */
const TLV_TYPE_KEYHASH = 0x01;

import { FirmwareUpdateError } from './firmwareUpdateError';

const NOT_FIRMWARE = 'This file is not AkidaTag firmware.';
const TRUNCATED = 'This firmware file is incomplete.';

export interface McubootImage {
  /** Image version as `major.minor.revision`. */
  version: string;
  /** Lowercase hex fingerprint of the signing key, null when unsigned. */
  keyHash: string | null;
}

/**
 * Collect every entry in MCUboot's unprotected TLV area.
 *
 * @param image - Whole firmware image.
 * @param start - Offset of the TLV info header, past the image itself and any
 *   protected TLVs.
 * @returns Each TLV value by type, keeping the first of a repeated type.
 * @throws If the area is absent, so the caller can report a truncated file.
 */
const readTlvArea = (image: Buffer, start: number): Map<number, Buffer> => {
  if (
    start + TLV_INFO_SIZE > image.length ||
    image.readUInt16LE(start) !== TLV_INFO_MAGIC
  ) {
    throw new FirmwareUpdateError(TRUNCATED);
  }

  const end = Math.min(start + image.readUInt16LE(start + 2), image.length);
  const values = new Map<number, Buffer>();

  let offset = start + TLV_INFO_SIZE;
  while (offset + TLV_ENTRY_SIZE <= end) {
    const type = image.readUInt16LE(offset);
    const valueStart = offset + TLV_ENTRY_SIZE;
    const valueEnd = valueStart + image.readUInt16LE(offset + 2);

    if (valueEnd > end) {
      break;
    }
    if (!values.has(type)) {
      values.set(type, image.subarray(valueStart, valueEnd));
    }
    offset = valueEnd;
  }

  return values;
};

/**
 * Read the version and signing key fingerprint out of a signed MCUboot
 * firmware image.
 *
 * MCUboot lays an image out as a 32-byte little-endian header, the image, an
 * optional protected TLV area, and the unprotected TLV area that carries the
 * key fingerprint. Reading it here lets the app say what it is about to send,
 * and warn when a board is unlikely to accept it, without touching the board.
 *
 * @param image - The whole `.bin`, not a slice of it.
 * @returns The image version and the fingerprint of the key that signed it.
 * @throws If the buffer is not an MCUboot image or its trailer is truncated.
 *   The messages are written to be shown to the user.
 */
export const parseMcubootImage = (image: Buffer): McubootImage => {
  if (image.length < HEADER_SIZE || image.readUInt32LE(0) !== IMAGE_MAGIC) {
    throw new FirmwareUpdateError(NOT_FIRMWARE);
  }

  const headerSize = image.readUInt16LE(8);
  const protectedTlvSize = image.readUInt16LE(10);
  const imageSize = image.readUInt32LE(12);
  const version = `${image.readUInt8(20)}.${image.readUInt8(
    21,
  )}.${image.readUInt16LE(22)}`;

  const tlvs = readTlvArea(image, headerSize + imageSize + protectedTlvSize);
  const keyHash = tlvs.get(TLV_TYPE_KEYHASH);

  return {
    version,
    keyHash: keyHash ? keyHash.toString('hex') : null,
  };
};

/**
 * Shorten a key fingerprint to something a person can compare at a glance.
 *
 * @param keyHash - Full lowercase hex fingerprint.
 * @returns Its first and last four characters, joined by an ellipsis.
 */
export const formatKeyFingerprint = (keyHash: string): string =>
  `${keyHash.slice(0, 4)}…${keyHash.slice(-4)}`;
