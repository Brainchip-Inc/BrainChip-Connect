/**
 * Pins device discovery to what an AkidaTag board actually broadcasts.
 *
 * The board advertises no service UUID at all, so the chip ID in its
 * manufacturer data is the only thing left to match on. Get this wrong in
 * either direction and the app is useless: too strict and it finds no devices,
 * too loose and the customer's tag is listed among their headphones.
 *
 * @format
 */

import { Buffer } from 'buffer';
import {
  AKD1500_CHIP_ID,
  isAkidaTagManufacturerData,
} from '../src/services/ble/akidaTagAdvertisement';

const toBase64 = (ascii: string) =>
  Buffer.from(ascii, 'latin1').toString('base64');

// Exactly what `adv_manufacturer_data[]` puts on the air: 2 bytes BLE protocol
// version, 3 bytes firmware version, 7 bytes chip ID, and no company
// identifier in front of them.
const AKIDA_TAG_ADVERTISEMENT = toBase64('53000AKD1500');

describe('isAkidaTagManufacturerData', () => {
  it('matches the firmware advertisement byte for byte', () => {
    expect(isAkidaTagManufacturerData(AKIDA_TAG_ADVERTISEMENT)).toBe(true);
  });

  it('matches whatever firmware version the board reports', () => {
    expect(isAkidaTagManufacturerData(toBase64('53241AKD1500'))).toBe(true);
    expect(isAkidaTagManufacturerData(toBase64('50999AKD1500'))).toBe(true);
  });

  it('still matches if the platform strips a two-byte company identifier', () => {
    // A platform that treats the leading "53" as the company id hands over the
    // remaining ten bytes, which shifts the chip ID from offset 5 to offset 3.
    expect(isAkidaTagManufacturerData(toBase64('000AKD1500'))).toBe(true);
  });

  it('still matches if the platform prepends a company identifier', () => {
    expect(
      isAkidaTagManufacturerData(toBase64('\x59\x00' + '53000AKD1500')),
    ).toBe(true);
  });

  it('rejects another vendor advertising binary manufacturer data', () => {
    const headphones = Buffer.from([
      0x4c, 0x00, 0x07, 0x19, 0x01, 0x20, 0x2b, 0x60, 0x8f,
    ]).toString('base64');

    expect(isAkidaTagManufacturerData(headphones)).toBe(false);
  });

  it('rejects a device advertising no manufacturer data', () => {
    expect(isAkidaTagManufacturerData(null)).toBe(false);
    expect(isAkidaTagManufacturerData(undefined)).toBe(false);
    expect(isAkidaTagManufacturerData('')).toBe(false);
  });

  it('rejects a near miss on the chip ID', () => {
    expect(isAkidaTagManufacturerData(toBase64('53000AKD1000'))).toBe(false);
    expect(isAkidaTagManufacturerData(toBase64('53000akd1500'))).toBe(false);
    expect(isAkidaTagManufacturerData(toBase64('53000AKD150'))).toBe(false);
  });

  it('does not let a high byte collapse into part of the chip ID', () => {
    // Decoded as UTF-8 an invalid byte becomes U+FFFD and could merge two
    // fragments into a false match; latin1 keeps one byte to one character.
    const split = Buffer.concat([
      Buffer.from('53000AKD', 'latin1'),
      Buffer.from([0xff]),
      Buffer.from('1500', 'latin1'),
    ]).toString('base64');

    expect(isAkidaTagManufacturerData(split)).toBe(false);
  });

  it('exports the chip ID the firmware comment documents', () => {
    expect(AKD1500_CHIP_ID).toBe('AKD1500');
  });
});
