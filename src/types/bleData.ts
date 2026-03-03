import { DeviceInfo } from '../services/ble/bleParser';

export interface BleData {
  type:
    | 'BATTERY'
    | 'DEVICE_INFO'
    | 'OTHER'
    | 'DEPLOYSTART'
    | 'STREAMSTART'
    | 'DEPLOYSTOP'
    | 'STREAMSTOP';
  data: number | string | DeviceInfo | Object | number[]; // depending on what your data contains
}
