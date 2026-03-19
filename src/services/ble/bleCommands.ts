// bleCommands.ts

export enum BleCommand {
  BATTERY, // 0
  DEVICE_INFO, // 1
  APPS, // 2
  NOTIFY, // 3
  CONFIG, // 4
  FWOTA, // 5
  MOTA, // 6
  UNINSTALL, // 7
  RESET, // 8
  DEPLOY, // 9
}

export const BleCommandMap: Record<BleCommand, string> = {
  [BleCommand.BATTERY]: 'CMD%BATLVL',
  [BleCommand.DEVICE_INFO]: 'CMD%DEVINFO',
  [BleCommand.APPS]: 'CMD%APPS',
  [BleCommand.NOTIFY]: 'CMD%NOTIFY',
  [BleCommand.CONFIG]: 'CMD%CONFIG',
  [BleCommand.FWOTA]: 'CMD%FWOTA',
  [BleCommand.MOTA]: 'CMD%MOTA',
  [BleCommand.UNINSTALL]: 'CMD%UNINSTALL',
  [BleCommand.RESET]: 'CMD%RESET',
  [BleCommand.DEPLOY]: 'CMD%DEPLOY',
};
