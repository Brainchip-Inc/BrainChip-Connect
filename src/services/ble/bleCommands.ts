// bleCommands.ts

/**
 * BLE command opcodes.
 *
 * These are the wire protocol in both directions: commands go out as the bare
 * number (`${BleCommand.APPS_INFO}:${appId}` interpolates the value), and
 * incoming notifications are matched on the numeric prefix of each frame. The
 * authoritative list is `command_type_t` in the spark firmware repo at
 * `source/include/ble_services/ble_initialization.h`; a value that drifts from
 * it silently invokes the wrong firmware handler rather than failing.
 *
 * Values are therefore assigned explicitly. With implicit numbering, inserting
 * a command renumbers every one after it, which is exactly how CURRENTSTART and
 * CURRENTSTOP came to sit at 12 and 13: they were written before the firmware
 * took 12 for the waveform stream. `__tests__/bleCommandOpcodes.test.ts` pins
 * the values against the firmware list.
 */
export enum BleCommand {
  BATTERY = 0,
  DEVICE_INFO = 1,
  APPS = 2,
  NOTIFY = 3,
  CONFIG = 4,
  APPS_INFO = 5,
  UNINSTALL = 6,
  RESET = 7,
  DEPLOYSTART = 8,
  STREAMSTART = 9,
  DEPLOYSTOP = 10,
  STREAMSTOP = 11,
  // Binary mic-waveform frames (firmware CMD_STREAM_WAVE). The app never sends
  // this one, but it holds the slot so the two below keep the firmware's
  // numbering; bleParser matches it when routing 0x42 frames.
  STREAMWAVE = 12,
  CURRENTSTART = 13,
  CURRENTSTOP = 14,
}

export const BleCommandMap: Record<BleCommand, string> = {
  [BleCommand.BATTERY]: 'CMD%BATLVL',
  [BleCommand.DEVICE_INFO]: 'CMD%DEVINFO',
  [BleCommand.APPS]: 'CMD%APPS',
  [BleCommand.NOTIFY]: 'CMD%NOTIFY',
  [BleCommand.CONFIG]: 'CMD%CONFIG',
  [BleCommand.APPS_INFO]: 'CMD%APPSINFO',
  [BleCommand.UNINSTALL]: 'CMD%UNINSTALL',
  [BleCommand.RESET]: 'CMD%RESET',
  [BleCommand.DEPLOYSTART]: 'CMD%DEPLOYSTART',
  [BleCommand.STREAMSTART]: 'CMD%STREAMSTART',
  [BleCommand.DEPLOYSTOP]: 'CMD%DEPLOYSTOP',
  [BleCommand.STREAMSTOP]: 'CMD%STREAMSTOP',
  [BleCommand.STREAMWAVE]: 'CMD%STREAMWAVE',
  [BleCommand.CURRENTSTART]: 'CMD%CURRENTSTART',
  [BleCommand.CURRENTSTOP]: 'CMD%CURRENTSTOP',
};
