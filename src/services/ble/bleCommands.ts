// bleCommands.ts

export enum BleCommand {
  BATTERY, // 0
  DEVICE_INFO, // 1
  APPS, // 2
  NOTIFY, // 3
  CONFIG, // 4
  APPS_INFO, // 5
  UNINSTALL, // 6
  RESET, // 7
  DEPLOYSTART, // 8
  STREAMSTART, //9
  DEPLOYSTOP, // 10
  STREAMSTOP, //11
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
};
