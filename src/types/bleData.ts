import { DeviceInfo } from '../services/ble/bleParser';

export interface BleData {
  type: 'BATTERY' | 'DEVICE_INFO' | 'OTHER' | 'DEPLOY' | 'STREAM';
  data: number | string | DeviceInfo | Object | number[]; // depending on what your data contains
}
