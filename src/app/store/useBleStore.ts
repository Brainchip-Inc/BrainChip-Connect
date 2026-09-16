import { Base64, UUID } from 'react-native-ble-plx';
import { create } from 'zustand';

export interface BLEDevice {
  id: string;
  name: string | null;
  rssi: number | null;
  deviceInfo: Base64 | null;
  serviceUUIDs: UUID[] | null;
}

interface DeviceInfo {
  deviceType: string;
  firmwareVersion: string;
  bleVersion: string;
}

interface BleState {
  // Bluetooth adapter state
  isBluetoothEnabled: boolean;
  setBluetoothEnabled: (enabled: boolean) => void;

  // Scanning
  isScanning: boolean;
  setScanning: (scanning: boolean) => void;
  discoveredDevices: BLEDevice[];
  addDiscoveredDevice: (device: BLEDevice) => void;
  clearDiscoveredDevices: () => void;

  // Connection
  connectedDevice: BLEDevice | null;
  connectionState:
    | 'idle'
    | 'connecting'
    | 'connected'
    | 'disconnected'
    | 'error';
  setConnectedDevice: (device: BLEDevice | null) => void;
  setConnectionState: (state: BleState['connectionState']) => void;

  // Permissions
  permissions: {
    bluetooth: boolean;
    location: boolean;
    notifications: boolean;
  };
  setPermissions: (permissions: Partial<BleState['permissions']>) => void;

  // User acceptance
  privacyAccepted: boolean;
  termsAccepted: boolean;
  setPrivacyAccepted: (accepted: boolean) => void;
  setTermsAccepted: (accepted: boolean) => void;

  //deviceInfo
  parsedDeviceInfo: DeviceInfo;
  setParsedDeviceInfo: (deviceInfo: DeviceInfo) => void;
}

export const useBleStore = create<BleState>(set => ({
  // Bluetooth adapter state
  isBluetoothEnabled: false,
  setBluetoothEnabled: enabled => set({ isBluetoothEnabled: enabled }),

  // Scanning
  isScanning: false,
  setScanning: scanning => set({ isScanning: scanning }),
  discoveredDevices: [],
  addDiscoveredDevice: device =>
    set(state => {
      if (state.discoveredDevices.find(d => d.id === device.id)) {
        return state;
      }
      return { discoveredDevices: [...state.discoveredDevices, device] };
    }),
  clearDiscoveredDevices: () => set({ discoveredDevices: [] }),

  // Connection
  connectedDevice: null,
  connectionState: 'idle',
  setConnectedDevice: device => set({ connectedDevice: device }),
  setConnectionState: connectionState => set({ connectionState }),

  // Permissions
  permissions: {
    bluetooth: false,
    location: false,
    notifications: false,
  },
  setPermissions: permissions =>
    set(state => ({
      permissions: { ...state.permissions, ...permissions },
    })),

  // User acceptance
  privacyAccepted: false,
  termsAccepted: false,
  setPrivacyAccepted: accepted => set({ privacyAccepted: accepted }),
  setTermsAccepted: accepted => set({ termsAccepted: accepted }),

  parsedDeviceInfo: {
    deviceType: 'Unknown',
    firmwareVersion: 'Unknown',
    bleVersion: 'Unknown',
  },
  setParsedDeviceInfo: deviceInfo => set({ parsedDeviceInfo: deviceInfo }),
}));

/**
 * What a sentence calls a device the app has no name for.
 *
 * It is a plain noun rather than a placeholder so that the sentences built
 * around it still read as English: "Your device is still running the model it
 * had" is true of any board, where an empty gap or a model name the user does
 * not own is not.
 */
export const UNNAMED_DEVICE = 'device';

/**
 * Name a device the way it names itself over the air.
 *
 * The app serves more than one board, so no screen may call the connected one
 * by a fixed model name: the only name that is right for the board in the
 * user's hand is the one that board advertises.
 *
 * @param device - The device record, or null when the app holds none.
 * @returns The device's own name, or a plain noun when it has not given one.
 */
export const nameForDevice = (device: BLEDevice | null): string =>
  device?.name?.trim() || UNNAMED_DEVICE;
