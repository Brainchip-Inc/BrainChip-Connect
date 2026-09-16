/**
 * Pins device discovery to what a board actually broadcasts.
 *
 * A board advertises no service UUID at all, so the AKD1500 accelerator id in
 * its manufacturer data is the only thing left to match on. Get this wrong in
 * either direction and the app is useless: too strict and it finds no devices,
 * too loose and the customer's board is listed among their headphones.
 *
 * The matcher keys on the accelerator, not on a board. Every board the app
 * serves carries an AKD1500, so an AkidaTag and a BrainBoard1500 are admitted
 * by the same bytes and are told apart afterwards by their names.
 *
 * @format
 */

import { Buffer } from 'buffer';
import {
  advertisesAkidaAccelerator,
  AKD1500_ACCELERATOR_ID,
} from '../src/services/ble/akidaAcceleratorAdvertisement';

const toBase64 = (ascii: string) =>
  Buffer.from(ascii, 'latin1').toString('base64');

// Exactly what `adv_manufacturer_data[]` puts on the air: 2 bytes BLE protocol
// version, 3 bytes firmware version, 7 bytes accelerator id, and no company
// identifier in front of them.
const AKIDA_ADVERTISEMENT = toBase64('53000AKD1500');

describe('advertisesAkidaAccelerator', () => {
  it('matches the firmware advertisement byte for byte', () => {
    expect(advertisesAkidaAccelerator(AKIDA_ADVERTISEMENT)).toBe(true);
  });

  it('matches whatever firmware version the board reports', () => {
    expect(advertisesAkidaAccelerator(toBase64('53241AKD1500'))).toBe(true);
    expect(advertisesAkidaAccelerator(toBase64('50999AKD1500'))).toBe(true);
  });

  it('still matches if the platform strips a two-byte company identifier', () => {
    // A platform that treats the leading "53" as the company id hands over the
    // remaining ten bytes, which shifts the accelerator id from offset 5 to 3.
    expect(advertisesAkidaAccelerator(toBase64('000AKD1500'))).toBe(true);
  });

  it('still matches if the platform prepends a company identifier', () => {
    expect(
      advertisesAkidaAccelerator(toBase64('\x59\x00' + '53000AKD1500')),
    ).toBe(true);
  });

  it('rejects another vendor advertising binary manufacturer data', () => {
    const headphones = Buffer.from([
      0x4c, 0x00, 0x07, 0x19, 0x01, 0x20, 0x2b, 0x60, 0x8f,
    ]).toString('base64');

    expect(advertisesAkidaAccelerator(headphones)).toBe(false);
  });

  it('rejects a device advertising no manufacturer data', () => {
    expect(advertisesAkidaAccelerator(null)).toBe(false);
    expect(advertisesAkidaAccelerator(undefined)).toBe(false);
    expect(advertisesAkidaAccelerator('')).toBe(false);
  });

  it('rejects a near miss on the accelerator id', () => {
    expect(advertisesAkidaAccelerator(toBase64('53000AKD1000'))).toBe(false);
    expect(advertisesAkidaAccelerator(toBase64('53000akd1500'))).toBe(false);
    expect(advertisesAkidaAccelerator(toBase64('53000AKD150'))).toBe(false);
  });

  it('does not let a high byte collapse into part of the accelerator id', () => {
    // Decoded as UTF-8 an invalid byte becomes U+FFFD and could merge two
    // fragments into a false match; latin1 keeps one byte to one character.
    const split = Buffer.concat([
      Buffer.from('53000AKD', 'latin1'),
      Buffer.from([0xff]),
      Buffer.from('1500', 'latin1'),
    ]).toString('base64');

    expect(advertisesAkidaAccelerator(split)).toBe(false);
  });

  it('exports the accelerator id the firmware comment documents', () => {
    expect(AKD1500_ACCELERATOR_ID).toBe('AKD1500');
  });

  it('admits every board the app serves, on the same bytes', () => {
    // The rename must not have narrowed the filter to one board. Both boards
    // carry the accelerator and broadcast it the same way, differing only in
    // the firmware version ahead of it and in the name they advertise, which
    // this matcher never sees.
    const akidaTag = toBase64('53241AKD1500');
    const brainBoard1500 = toBase64('53100AKD1500');

    expect(advertisesAkidaAccelerator(akidaTag)).toBe(true);
    expect(advertisesAkidaAccelerator(brainBoard1500)).toBe(true);
  });
});
