import { create } from 'zustand';
import { Subscription } from 'react-native-ble-plx';
import BleService from '../../services/ble/bleManager';
import { BleCommand } from '../../services/ble/bleCommands';
import { BleData } from '../../types/bleData';
import { BLEDevice } from './useBleStore';
import { useEventsStore } from './useEventStore';
import BleConnectionHelper from '../utils/BleConnectionHelper';
import { AppsList } from '../../services/ble/bleParser';
import { AppType } from './useLiveSensorStore';
import { BatteryState, getBatteryLabel } from '../../types/batteryStateEnum';

let streamBuffer: number[] = [];
let lastFlush = 0;
const FLUSH_INTERVAL = 100; // 100ms = 10fps

const appTypeMapping: Record<string, AppType> = {
  keyword: 'keyword',
  anomaly: 'anomaly',
  imu: 'imu',
  vision: 'vision',
};

export const formatFromKB = (value: string): string => {
  const kb = parseInt(value);
  if (!kb || isNaN(kb)) return '0 KB';

  if (kb < 1024) {
    return `${kb} KB`;
  }

  const mb = kb / 1024;
  if (mb < 1024) {
    return `${mb.toFixed(2)} MB`;
  }

  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
};

interface BleCommandState {
  connectedDevice: BLEDevice | null;

  batteryLevel: string | null;
  batteryLoading: boolean;
  batteryError: string | null;
  batteryStateLabel: string | null;

  activeApp: string | null;
  latestDetection: string | undefined;
  confidence: number | undefined;
  receivedAt: Date | null;

  micWave: number[];

  subscription: Subscription | null;

  appsList: AppsList[];

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
  // Device Reset
  requestDeviceReset: () => Promise<boolean>;
  resetLoading: boolean;
  resetError: string | null;
  setResetLoading: (enabled: boolean) => void;
  setResetError: (error: string) => void;

  // 🔹 Streaming
  startStreaming: (appId: string) => Promise<void>;
  stopStreaming: (appId: string) => Promise<void>;

  // 🔹 App Info
  requestAppInfo: (appId: string) => Promise<void>;
  selectedAppId: string | null;
}

export const useBleCommandStore = create<BleCommandState>((set, get) => ({
  connectedDevice: null,

  batteryLevel: null,
  batteryLoading: false,
  batteryError: null,
  batteryStateLabel: null,

  activeApp: null,
  latestDetection: 'Waiting',
  confidence: 0,
  receivedAt: null,

  micWave: [],

  subscription: null,

  resetLoading: false,
  resetError: null,

  appsList: [],
  selectedAppId: null,

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
      batteryStateLabel: null,
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
              const rcvdBatData = String(data.data);
              const [batteryPercentage, batteryState] = rcvdBatData.split(',');
              const stateNum = (Number(batteryState) as BatteryState) || null;
              set({
                batteryLevel: batteryPercentage,
                batteryLoading: false,
                batteryError: null,
                batteryStateLabel: getBatteryLabel(stateNum),
              });
              break;

            case 'DEPLOYSTART':
              const detectionData = String(data.data).split(',');
              const detection = detectionData[0];
              const conf = detectionData[1]
                ? Number(detectionData[1])
                : Number((Math.random() * 100).toFixed(2));

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
              if (__DEV__) console.log('stop ack', data.data);
              break;
            case 'STREAMSTOP':
              if (__DEV__) console.log('stop ack', data.data);
              break;
            case 'APPS':
              if (__DEV__) console.log('apps', data.data);
              const rcvdData = String(data.data);
              const parsedData = rcvdData.split(',');

              const appKeyword = parsedData[0].split(' ')[0].toLowerCase();

              const appType = appTypeMapping[appKeyword] || 'keyword';

              const sizeInKB = formatFromKB(parsedData[2]);

              const appsData: AppsList = {
                id: appType,
                name: parsedData[0],
                description: parsedData[1],
                size: sizeInKB,
                processor: '-',
                modelName: '-',
                modelVersion: '-',
                modelSize: '-',
                inputShape: '-',
                noOfClasses: '-',
                nodes: '-',
                powerConsumption: '-',
              };

              // Check if the app with the same id or name already exists in the appsList
              const existingAppIndex = get().appsList.findIndex(
                app => app.id === appsData.id || app.name === appsData.name,
              );

              if (existingAppIndex !== -1) {
                // If the app exists, check if any other key has changed
                const existingApp = get().appsList[existingAppIndex];

                // Compare properties and update if changed
                const isChanged = Object.keys(appsData).some(
                  key =>
                    existingApp[key as keyof AppsList] !==
                    appsData[key as keyof AppsList],
                );

                if (isChanged) {
                  // Update the app at the same index
                  set(state => {
                    const updatedAppsList = [...state.appsList];
                    updatedAppsList[existingAppIndex] = appsData;
                    return { appsList: updatedAppsList };
                  });
                }
              } else {
                // If the app doesn't exist, add it to the list
                set(state => ({
                  appsList: [...state.appsList, appsData],
                }));
              }

              (async () => {
                try {
                  await get().requestAppInfo(appType);
                } catch (e) {
                  if (__DEV__) console.warn('requestAppInfo failed', e);
                }
              })();

              break;

            case 'APPS_INFO':
              if (__DEV__) console.log('APPS_INFO', data.data);
              const rcvdInfoData = String(data.data);
              const parsedInfoData = rcvdInfoData.split(',');

              const existAppIndex = get().appsList.findIndex(
                app => app.id === get().selectedAppId,
              );

              if (existAppIndex !== -1) {
                // If the app exists, check if any other key has changed
                const existingApp = get().appsList[existAppIndex];

                const appsInfoData: AppsList = {
                  ...existingApp,
                  processor: parsedInfoData[0],
                  modelName: parsedInfoData[1],
                  modelVersion: parsedInfoData[2],
                  modelSize: parsedInfoData[3],
                  inputShape: parsedInfoData[4],
                  noOfClasses: parsedInfoData[5],
                  nodes: parsedInfoData[6],
                  powerConsumption: (
                    parseInt(parsedInfoData[7], 10) || 0
                  ).toFixed(2),
                };

                set(state => {
                  const updatedAppsList = [...state.appsList];
                  updatedAppsList[existAppIndex] = appsInfoData;
                  return { appsList: updatedAppsList };
                });
              }

              break;

            default:
              break;
          }
        },
      );

      set({ subscription: sub });
    } catch (error) {
      if (__DEV__) console.error('Subscription error:', error);
    }
  },

  // ✅ Stop subscription
  stopNotifications: () => {
    const sub = get().subscription;

    if (sub) {
      try {
        sub.remove();
      } catch (e) {
        if (__DEV__) console.warn('Subscription already removed');
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
        batteryStateLabel: null,
      });
    }
    await new Promise(r => setTimeout(r, 300));
    try {
      await BleService.sendCommand(deviceId, BleCommand.APPS);
    } catch (error) {
      set({
        appsList: [],
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
  requestDeviceReset: async () => {
    const deviceId = get().connectedDevice?.id;
    if (!deviceId) {
      return false;
    }

    set({ resetLoading: true, resetError: null });

    try {
      await BleService.sendCommand(deviceId, BleCommand.RESET);
      set({ resetLoading: false, resetError: null });
      BleConnectionHelper.setExpectedReboot(true);
      return true;
    } catch (error) {
      set({
        resetError: 'Device reset request failed',
        resetLoading: false,
      });
      return false;
    }
  },
  setResetLoading: loading => set({ resetLoading: loading }),
  setResetError: error => set({ resetError: error }),

  requestAppInfo: async (appId: string) => {
    const deviceId = get().connectedDevice?.id;
    if (!deviceId) return;

    await BleService.sendCommand(deviceId, `${BleCommand.APPS_INFO}:${appId}`);

    set({
      selectedAppId: appId,
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
