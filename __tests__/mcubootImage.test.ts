/**
 * Pins the reader for MCUboot's image header and TLV trailer.
 *
 * The app reads a firmware file before it sends it, so it can name the version
 * and warn when the signing key is not the one the board last accepted. That
 * only works while this layout matches what imgtool writes: a 32-byte
 * little-endian header, the image, an optional protected TLV area, then the
 * unprotected TLV area that carries the key fingerprint.
 *
 * @format
 */

import { Buffer } from 'buffer';
import { parseMcubootImage } from '../src/services/firmware/mcubootImage';

const IMAGE_MAGIC = 0x96f3b83d;
const TLV_INFO_MAGIC_PROTECTED = 0x6908;
const TLV_INFO_MAGIC = 0x6907;
const TLV_TYPE_KEYHASH = 0x01;
const TLV_TYPE_SHA256 = 0x10;

const KEY_HASH = Buffer.from('a91c'.repeat(16), 'hex');
const IMAGE_HASH = Buffer.from('3f2a'.repeat(16), 'hex');

/** One TLV entry: little-endian type, length, then the value. */
const tlv = (type: number, value: Buffer): Buffer => {
  const entry = Buffer.alloc(4 + value.length);
  entry.writeUInt16LE(type, 0);
  entry.writeUInt16LE(value.length, 2);
  value.copy(entry, 4);
  return entry;
};

/** A TLV area: its info header, then the entries it declares. */
const tlvArea = (magic: number, entries: Buffer[]): Buffer => {
  const body = Buffer.concat(entries);
  const info = Buffer.alloc(4);
  info.writeUInt16LE(magic, 0);
  info.writeUInt16LE(4 + body.length, 2);
  return Buffer.concat([info, body]);
};

/**
 * Assemble a firmware image the way imgtool lays one out.
 *
 * @param options.signed - Whether to include the signing key fingerprint.
 * @param options.protectedTlvs - Whether to place a protected TLV area between
 *   the image and the unprotected one, which shifts where the reader has to
 *   start looking.
 */
const buildImage = ({
  signed = true,
  protectedTlvs = false,
}: { signed?: boolean; protectedTlvs?: boolean } = {}): Buffer => {
  const body = Buffer.alloc(64, 0xa5);
  const protectedArea = protectedTlvs
    ? tlvArea(TLV_INFO_MAGIC_PROTECTED, [tlv(0x40, Buffer.alloc(8, 0x11))])
    : Buffer.alloc(0);

  const entries = [tlv(TLV_TYPE_SHA256, IMAGE_HASH)];
  if (signed) {
    entries.push(tlv(TLV_TYPE_KEYHASH, KEY_HASH));
  }

  const header = Buffer.alloc(32);
  header.writeUInt32LE(IMAGE_MAGIC, 0);
  header.writeUInt16LE(32, 8);
  header.writeUInt16LE(protectedArea.length, 10);
  header.writeUInt32LE(body.length, 12);
  header.writeUInt8(1, 20);
  header.writeUInt8(2, 21);
  header.writeUInt16LE(3, 22);
  header.writeUInt32LE(0, 24);

  return Buffer.concat([
    header,
    body,
    protectedArea,
    tlvArea(TLV_INFO_MAGIC, entries),
  ]);
};

describe('parseMcubootImage', () => {
  it('reads the version and the signing key fingerprint', () => {
    expect(parseMcubootImage(buildImage())).toEqual({
      version: '1.2.3',
      keyHash: KEY_HASH.toString('hex'),
    });
  });

  it('reads the fingerprint as hex where subarray returns a plain view', () => {
    // On Hermes, subarray hands back a Uint8Array rather than a Buffer, and
    // its toString ignores the encoding: the fingerprint came out as a list
    // of decimal bytes and never matched the key recorded for a board, so
    // every file looked wrongly signed.
    const image = buildImage();
    const hermesLike = new Proxy(image, {
      get: (target, property) => {
        if (property === 'subarray') {
          return (start: number, end: number) =>
            new Uint8Array(
              target.buffer,
              target.byteOffset + start,
              end - start,
            );
        }
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

    expect(parseMcubootImage(hermesLike).keyHash).toBe(
      KEY_HASH.toString('hex'),
    );
  });

  it('finds the trailer past a protected TLV area', () => {
    expect(parseMcubootImage(buildImage({ protectedTlvs: true }))).toEqual({
      version: '1.2.3',
      keyHash: KEY_HASH.toString('hex'),
    });
  });

  it('reports no key for an unsigned image rather than failing', () => {
    expect(parseMcubootImage(buildImage({ signed: false })).keyHash).toBeNull();
  });

  it('refuses a file that is not an MCUboot image', () => {
    expect(() => parseMcubootImage(Buffer.alloc(512, 0x00))).toThrow(
      'This file is not AkidaTag firmware.',
    );
  });

  it('refuses an image whose trailer was cut off', () => {
    const truncated = buildImage().subarray(0, 96 + 2);
    expect(() => parseMcubootImage(truncated)).toThrow(
      'This firmware file is incomplete.',
    );
  });
});
