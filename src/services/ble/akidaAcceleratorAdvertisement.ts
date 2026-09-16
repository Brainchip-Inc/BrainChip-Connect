// akidaAcceleratorAdvertisement.ts

import { Buffer } from 'buffer';
import { Base64 } from 'react-native-ble-plx';

/**
 * ASCII part number of the Akida AI accelerator, which the firmware puts at
 * the tail of its manufacturer data. It is the only field in the
 * advertisement that identifies the hardware, so it is what discovery matches
 * on. It names the accelerator, not the board: every board the app serves
 * carries an AKD1500, so it cannot tell an AkidaTag from a BrainBoard1500.
 */
export const AKD1500_ACCELERATOR_ID = 'AKD1500';

/**
 * Decide whether an advertising device carries an Akida AI accelerator, from
 * its manufacturer-specific data.
 *
 * This is what discovery filters on, and it is deliberately as wide as the
 * product line: it admits every board built around an AKD1500 and nothing
 * else. Which of those boards is being held is read from the device name
 * afterwards, never from here.
 *
 * The board advertises no service UUID: the 128-bit value it used to put in
 * its scan response was really the permanent factory serial, and broadcasting
 * a value that never changes defeats the rotating private address. The scan
 * response is gone, so the manufacturer data is the only handle discovery has
 * left.
 *
 * The firmware writes 12 ASCII bytes (see `adv_manufacturer_data[]` in
 * `source/core/interface/ble_services/ble_initialization.c` of the AkidaTag
 * firmware repo):
 *
 *   bytes 0-1   BLE protocol version, e.g. "53" for BLE 5.3
 *   bytes 2-4   firmware version,     e.g. "241" for v2.4.1
 *   bytes 5-11  accelerator id,       "AKD1500"
 *
 * Note there is no two-byte company identifier in front of that, even though
 * manufacturer-specific data conventionally starts with one; a strict reader
 * would take the ASCII "53" of the protocol version as company 0x3335.
 * react-native-ble-plx hands the whole AD element payload through untouched on
 * both platforms (Android: `AdvertisementData.parseManufacturerData` copies
 * all `adLength` bytes; iOS: CoreBluetooth's manufacturer-data key is the
 * whole value), so what arrives here is exactly those 12 bytes. Platforms that
 * strip a company identifier would shift everything by two, so the accelerator
 * id is searched for anywhere in the payload rather than read at a fixed
 * offset.
 *
 * @param manufacturerData Base64 manufacturer data as `Device.manufacturerData`
 *                         reports it, or null when the device advertises none.
 */
export const advertisesAkidaAccelerator = (
  manufacturerData: Base64 | null | undefined,
): boolean => {
  if (!manufacturerData) {
    return false;
  }

  // latin1 keeps one byte to one character, so a non-ASCII byte in some other
  // vendor's payload can never collapse into part of the accelerator id.
  const payload = Buffer.from(manufacturerData, 'base64').toString('latin1');

  return payload.includes(AKD1500_ACCELERATOR_ID);
};
