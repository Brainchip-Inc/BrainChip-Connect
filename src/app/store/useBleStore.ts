import { create } from 'zustand';
import { Device } from 'react-native-ble-plx';

export interface BLEDevice {
  id: string;
  name: string | null;
  rssi: number | null;
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
  connectionState: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
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
}

export const useBleStore = create<BleState>((set) => ({
  // Bluetooth adapter state
  isBluetoothEnabled: false,
  setBluetoothEnabled: (enabled) => set({ isBluetoothEnabled: enabled }),

  // Scanning
  isScanning: false,
  setScanning: (scanning) => set({ isScanning: scanning }),
  discoveredDevices: [],
  addDiscoveredDevice: (device) =>
    set((state) => {
      if (state.discoveredDevices.find((d) => d.id === device.id)) {
        return state;
      }
      return { discoveredDevices: [...state.discoveredDevices, device] };
    }),
  clearDiscoveredDevices: () => set({ discoveredDevices: [] }),

  // Connection
  connectedDevice: null,
  connectionState: 'idle',
  setConnectedDevice: (device) => set({ connectedDevice: device }),
  setConnectionState: (connectionState) => set({ connectionState }),

  // Permissions
  permissions: {
    bluetooth: false,
    location: false,
    notifications: false,
  },
  setPermissions: (permissions) =>
    set((state) => ({
      permissions: { ...state.permissions, ...permissions },
    })),

  // User acceptance
  privacyAccepted: false,
  termsAccepted: false,
  setPrivacyAccepted: (accepted) => set({ privacyAccepted: accepted }),
  setTermsAccepted: (accepted) => set({ termsAccepted: accepted }),
}));
