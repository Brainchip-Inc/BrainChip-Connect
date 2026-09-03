// akidaTagAdvertisement.ts

import { Buffer } from 'buffer';
import { Base64 } from 'react-native-ble-plx';

/**
 * ASCII chip ID the AkidaTag firmware puts at the tail of its manufacturer
 * data. It is the only field in the advertisement that identifies the
 * hardware, so it is what discovery matches on.
 */
export const AKD1500_CHIP_ID = 'AKD1500';

/**
 * Decide whether an advertising device is an AkidaTag board from its
 * manufacturer-specific data.
 *
 * The board no longer advertises any service UUID: the 128-bit value it used
 * to put in its scan response was really the permanent factory serial, and
 * broadcasting a value that never changes defeats the rotating private
 * address. The scan response is gone, so the manufacturer data is the only
 * handle discovery has left.
 *
 * The firmware writes 12 ASCII bytes (see `adv_manufacturer_data[]` in
 * `source/core/interface/ble_services/ble_initialization.c` of the AkidaTag
 * firmware repo):
 *
 *   bytes 0-1   BLE protocol version, e.g. "53" for BLE 5.3
 *   bytes 2-4   firmware version,     e.g. "241" for v2.4.1
 *   bytes 5-11  chip ID,              "AKD1500"
 *
 * Note there is no two-byte company identifier in front of that, even though
 * manufacturer-specific data conventionally starts with one; a strict reader
 * would take the ASCII "53" of the protocol version as company 0x3335.
 * react-native-ble-plx hands the whole AD element payload through untouched on
 * both platforms (Android: `AdvertisementData.parseManufacturerData` copies
 * all `adLength` bytes; iOS: CoreBluetooth's manufacturer-data key is the
 * whole value), so what arrives here is exactly those 12 bytes. Platforms that
 * strip a company identifier would shift everything by two, so the chip ID is
 * searched for anywhere in the payload rather than read at a fixed offset.
 *
 * @param manufacturerData Base64 manufacturer data as `Device.manufacturerData`
 *                         reports it, or null when the device advertises none.
 */
export const isAkidaTagManufacturerData = (
  manufacturerData: Base64 | null | undefined,
): boolean => {
  if (!manufacturerData) {
    return false;
  }

  // latin1 keeps one byte to one character, so a non-ASCII byte in some other
  // vendor's payload can never collapse into part of the chip ID.
  const payload = Buffer.from(manufacturerData, 'base64').toString('latin1');

  return payload.includes(AKD1500_CHIP_ID);
};
