/**
 * Pins where the app remembers which signing key each board accepts.
 *
 * The board never reports the key its bootloader trusts, so the app infers it
 * from the last firmware that actually installed and warns when a new file
 * carries a different one. The record is keyed by the permanent hardware
 * serial, not the Bluetooth address, because the address changes when the
 * board restarts and two boards would otherwise share one record.
 *
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getTrustedKeyHash,
  rememberTrustedKeyHash,
} from '../src/services/firmware/trustedKeyStorage';

const SERIAL = '0011223344556677';
const OTHER_SERIAL = '8899aabbccddeeff';
const KEY_HASH = 'a91c'.repeat(16);

describe('trusted signing key persistence', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('knows nothing about a board it has never updated', async () => {
    await expect(getTrustedKeyHash(SERIAL)).resolves.toBeNull();
  });

  it('remembers the key a board accepted across a relaunch', async () => {
    await rememberTrustedKeyHash(SERIAL, KEY_HASH);

    await expect(getTrustedKeyHash(SERIAL)).resolves.toBe(KEY_HASH);
  });

  it('keeps one record per board', async () => {
    await rememberTrustedKeyHash(SERIAL, KEY_HASH);

    await expect(getTrustedKeyHash(OTHER_SERIAL)).resolves.toBeNull();
  });

  it('writes under a key namespaced by serial', async () => {
    await rememberTrustedKeyHash(SERIAL, KEY_HASH);

    await expect(AsyncStorage.getAllKeys()).resolves.toEqual([
      `@brainchip_connect_trusted_key_${SERIAL}`,
    ]);
  });
});
