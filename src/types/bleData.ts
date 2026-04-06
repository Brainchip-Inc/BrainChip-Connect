import { DeviceInfo } from '../services/ble/bleParser';

export interface BleData {
  type:
    | 'BATTERY'
    | 'DEVICE_INFO'
    | 'OTHER'
    | 'DEPLOYSTART'
    | 'STREAMSTART'
    | 'DEPLOYSTOP'
    | 'STREAMSTOP'
    | 'APPS'
    | 'APPS_INFO';
  data: number | string | DeviceInfo | Object | number[]; // depending on what your data contains
}
