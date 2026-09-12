import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Prefix for the per-board record of which signing key that board accepts.
 *
 * The board never reports the key its bootloader trusts, so the app infers it:
 * whichever key signed the last firmware that actually installed is a key the
 * board accepts. The record is keyed by the permanent hardware serial rather
 * than the Bluetooth address, which rotates.
 */
export const TRUSTED_KEY_PREFIX = '@brainchip_connect_trusted_key_';

/**
 * Read the signing key fingerprint a board last accepted firmware from.
 *
 * @param deviceSerial - Permanent hardware serial from the device-info burst.
 * @returns The fingerprint, or null when this board has never had a firmware
 *   update installed through the app.
 */
export const getTrustedKeyHash = async (
  deviceSerial: string,
): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(TRUSTED_KEY_PREFIX + deviceSerial);
  } catch {
    return null;
  }
};

/**
 * Record that a board accepted firmware signed with this key.
 *
 * Failures are swallowed: this runs after an update has already succeeded, and
 * losing the record only costs the next pre-flight warning.
 *
 * @param deviceSerial - Permanent hardware serial from the device-info burst.
 * @param keyHash - Fingerprint of the key that signed the installed firmware.
 */
export const rememberTrustedKeyHash = async (
  deviceSerial: string,
  keyHash: string,
): Promise<void> => {
  try {
    await AsyncStorage.setItem(TRUSTED_KEY_PREFIX + deviceSerial, keyHash);
  } catch {}
};
