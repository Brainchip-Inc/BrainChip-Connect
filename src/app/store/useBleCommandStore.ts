import { create } from 'zustand';
import { Subscription } from 'react-native-ble-plx';
import BleService from '../../services/ble/bleManager';
import { BleCommand } from '../../services/ble/bleCommands';
import { BleData } from '../../types/bleData';
import { BLEDevice } from './useBleStore';
import { useEventsStore } from './useEventStore';

let streamBuffer: number[] = [];
let lastFlush = 0;
const FLUSH_INTERVAL = 100; // 100ms = 10fps

interface BleCommandState {
  connectedDevice: BLEDevice | null;

  batteryLevel: string | null;
  batteryLoading: boolean;
  batteryError: string | null;

  activeApp: string | null;
  latestDetection: string | undefined;
  confidence: number | undefined;
  receivedAt: Date | null;

  micWave: number[];

  subscription: Subscription | null;

  // 🔹 Session lifecycle
  startDeviceSession: (device: any) => Promise<void>;
  endDeviceSession: () => void;

  // 🔹 Internal
  startNotifications: (deviceId: string) => Promise<void>;
  stopNotifications: () => void;

  // 🔹 Commands
  requestBattery: () => Promise<void>;
  deployApp: (appId: string) => Promise<void>;
  stopApp: (appId: string) => Promise<void>;

  // 🔹 Streaming
  startStreaming: (appId: string) => Promise<void>;
  stopStreaming: (appId: string) => Promise<void>;
}

export const useBleCommandStore = create<BleCommandState>((set, get) => ({
  connectedDevice: null,

  batteryLevel: null,
  batteryLoading: false,
  batteryError: null,

  activeApp: null,
  latestDetection: 'Waiting',
  confidence: 0,
  receivedAt: null,

  micWave: [],

  subscription: null,

  // ✅ DEVICE SESSION START
  startDeviceSession: async (device: BLEDevice) => {
    set({ connectedDevice: device });

    await get().startNotifications(device.id);

    // Automatically request battery on connect
    await get().requestBattery();
  },

  // ✅ DEVICE SESSION END
  endDeviceSession: () => {
    get().stopNotifications();

    set({
      connectedDevice: null,
      batteryLevel: null,
      batteryLoading: false,
      batteryError: null,
      activeApp: null,
      latestDetection: undefined,
      confidence: undefined,
    });
  },

  // ✅ Start subscription once
  startNotifications: async (deviceId: string) => {
    if (get().subscription) return;

    try {
      const sub = await BleService.subscribeToNotifications(
        deviceId,
        (data: BleData) => {
          if (!data) return;
          const device = get().connectedDevice;
          if (!device) return;

          switch (data.type) {
            case 'BATTERY':
              set({
                batteryLevel: String(data.data),
                batteryLoading: false,
                batteryError: null,
              });
              break;

            case 'DEPLOYSTART':
              const detection = String(data.data);
              const conf = Number((Math.random() * 100).toFixed(2));

              set({
                latestDetection: detection,
                confidence: conf,
                receivedAt: new Date(),
              });

              useEventsStore.getState().addEvent({
                appId: get().activeApp ?? 'unknown',
                title: detection,
                timestamp: Date.now(),
                confidence: conf,
                status: conf < 80 ? 'warn' : 'ok',
              });
              break;

            case 'STREAMSTART':
              // Step 3: Convert the raw audio string to a single RMS value
              const rmsValue = Number(data.data);

              // Step 4: Update the micWave state with the RMS value (Store it as an array of RMS values)
              streamBuffer.push(rmsValue);

              const now = Date.now();

              if (now - lastFlush > FLUSH_INTERVAL) {
                lastFlush = now;

                const valuesToAdd = [...streamBuffer];
                streamBuffer = [];

                set(prevState => ({
                  micWave: [...prevState.micWave, ...valuesToAdd].slice(-30),
                }));
              }
              break;

            case 'DEPLOYSTOP':
              console.log('stop ack', data.data);
              break;
            case 'STREAMSTOP':
              console.log('stop ack', data.data);
              break;

            default:
              break;
          }
        },
      );

      set({ subscription: sub });
    } catch (error) {
      console.error('Subscription error:', error);
    }
  },

  // ✅ Stop subscription
  stopNotifications: () => {
    const sub = get().subscription;

    if (sub) {
      try {
        sub.remove();
      } catch (e) {
        console.log('Subscription already removed');
      }
    }
    set({ subscription: null });
  },

  // ✅ Request battery
  requestBattery: async () => {
    const deviceId = get().connectedDevice?.id;
    if (!deviceId) return;

    set({ batteryLoading: true });

    try {
      await BleService.sendCommand(deviceId, BleCommand.BATTERY);
    } catch (error) {
      set({
        batteryError: 'Battery request failed',
        batteryLoading: false,
      });
    }
  },

  // ✅ Deploy app
  deployApp: async (appId: string) => {
    const deviceId = get().connectedDevice?.id;
    if (!deviceId) return;

    await BleService.sendCommand(
      deviceId,
      `${BleCommand.DEPLOYSTART}:${appId},1`,
    );

    set({
      activeApp: appId,
      latestDetection: 'Waiting...',
      confidence: 0,
      receivedAt: null,
    });
  },

  // ✅ Stop app
  stopApp: async (appId: string) => {
    const deviceId = get().connectedDevice?.id;
    if (!deviceId) return;

    await BleService.sendCommand(
      deviceId,
      `${BleCommand.DEPLOYSTOP}:${appId},0`,
    );

    set({
      activeApp: null,
      latestDetection: undefined,
      confidence: undefined,
      receivedAt: null,
    });
  },

  // ✅ Start Streaming
  startStreaming: async (appId: string) => {
    const deviceId = get().connectedDevice?.id;
    if (!deviceId) return;

    streamBuffer = [];
    lastFlush = 0;

    await BleService.sendCommand(
      deviceId,
      `${BleCommand.STREAMSTART}:${appId},1`,
    );

    set({
      micWave: [],
    });
  },

  // ✅ Stop streaming
  stopStreaming: async (appId: string) => {
    const deviceId = get().connectedDevice?.id;
    if (!deviceId) return;

    await BleService.sendCommand(
      deviceId,
      `${BleCommand.STREAMSTOP}:${appId},0`,
    );

    set({
      micWave: [],
    });
  },
}));

/**
 * Converts the received ASCII string into an array of numbers to represent microphone waveform data.
 * @param asciiData The ASCII data received as a string.
 * @returns Array of numbers to be used for graphing or other purposes.
 */

// Function to convert the raw audio string data into an RMS value
const convertStringToRms = (rawDataString: string): number => {
  // Step 1: Convert the string to an array of numbers (e.g., ASCII values)
  const rawDataArray = Array.from(rawDataString).map(char =>
    char.charCodeAt(0),
  );

  // Step 2: Calculate RMS for the entire dataset
  const rms = Math.sqrt(
    rawDataArray.reduce((acc, value) => acc + value ** 2, 0) /
      rawDataArray.length,
  );

  // Step 3: Normalize the RMS value (optional)
  // Normalize to a range of 0-100 (or 0-255 depending on your data)
  const normalizedRms = Math.min(Math.max((rms / 255) * 100, 0), 100);

  return normalizedRms;
};
