import { DeviceInfo } from '../services/ble/bleParser';

export interface BleData {
  type: 'BATTERY' | 'DEVICE_INFO' | 'OTHER';
  data: number | string | DeviceInfo; // depending on what your data contains
}
