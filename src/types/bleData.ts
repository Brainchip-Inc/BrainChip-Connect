import { ParsedResponse } from '../services/ble/bleParser';

// BleData is the discriminated union of everything parseBleMessage /
// parseBinaryFrame can emit. The BLE notification callback narrows on
// `data.type` to pick the right branch.
export type BleData = ParsedResponse;
