import { create } from 'zustand';
import { Subscription } from 'react-native-ble-plx';
import BleService from '../../services/ble/bleManager';
import { BleCommand } from '../../services/ble/bleCommands';
import { BleData } from '../../types/bleData';
import { BLEDevice } from './useBleStore';
import { useEventsStore } from './useEventStore';
import BleConnectionHelper from '../utils/BleConnectionHelper';
import { AppsList, WavePayload } from '../../services/ble/bleParser';
import { AppType } from './useLiveSensorStore';
import { BatteryState, getBatteryLabel } from '../../types/batteryStateEnum';
import {
  KWS_PARAMS,
  KwsConfig,
  KwsParamId,
  formatKwsValue,
  parseKwsValue,
} from '../../types/appConfig';

// Mic-stream buffer: rolling window of int16 PCM samples (envelope or decimation
// mode, interleaved as the firmware delivers them). 2048 samples ≈ 1.9 s of
// history at 16.67 fps × 64 samples/frame.
const MIC_BUFFER_SIZE = 2048;

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

type KwsAckResolver =
  | {
      kind: 'set';
      paramId: KwsParamId;
      resolve: (ok: boolean) => void;
      reject: (err: Error) => void;
    }
  | { kind: 'reset'; resolve: () => void; reject: (err: Error) => void };

type DeployAckResolver = {
  kind: 'start' | 'stop';
  resolve: () => void;
  reject: (err: Error) => void;
};

type CalibrationAckResolver = {
  resolve: (calibrated: boolean) => void;
  reject: (err: Error) => void;
};

// The firmware reports its serial as 16 lowercase hex characters. Anything
// else on that frame is a firmware the app does not understand, so it is
// dropped rather than shown.
const DEVICE_SERIAL_PATTERN = /^[0-9a-f]{16}$/;

interface BleCommandState {
  connectedDevice: BLEDevice | null;

  // Permanent hardware serial, from the last frame of the device-info burst.
  // Null until that burst arrives, which is a moment after connecting.
  deviceSerial: string | null;

  batteryLevel: string | null;
  batteryLoading: boolean;
  batteryError: string | null;
  batteryStateLabel: string | null;

  activeApp: string | null;
  latestDetection: string | undefined;
  confidence: number | undefined;
  receivedAt: Date | null;

  micWave: Int16Array;

  subscription: Subscription | null;

  appsList: AppsList[];

  // KWS runtime params (CMD_CONFIG / opcode 4).
  kwsConfig: KwsConfig; // live values from the device
  kwsConfigDraft: KwsConfig; // per-field edits staged in the UI
  kwsConfigPending: ReadonlySet<KwsParamId>; // ids with an in-flight SET
  kwsConfigError: Partial<Record<KwsParamId, string>>; // last ERR reason per id
  kwsConfigAckResolver: KwsAckResolver | null;

  // Inference pipeline state (DEPLOYSTART / DEPLOYSTOP).
  // Firmware auto-starts at boot, so we initialise true on connect.
  isInferenceRunning: boolean;
  deployAckResolver: DeployAckResolver | null;

  // 🔹 Session lifecycle
  startDeviceSession: (device: any) => Promise<void>;
  endDeviceSession: () => void;

  // 🔹 Internal
  startNotifications: (deviceId: string) => Promise<void>;
  stopNotifications: () => void;

  // 🔹 Commands
  requestBattery: () => Promise<void>;
  requestDeviceInfo: () => Promise<void>;
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

  // IMU (Fall Detection) calibration state.
  // calibrationRequired is updated by the firmware and shows whether
  // the device needs calibration. The other fields track the calibration
  // process and any error while calibration is running.
  calibrationRequired: boolean;
  calibrationInProgress: boolean;
  calibrationError: string | null;
  calibrationAckResolver: CalibrationAckResolver | null;
  requestCalibration: () => Promise<boolean>;
  setCalibrationError: (error: string) => void;

  // 🔹 KWS App Controls
  requestKwsConfig: () => Promise<void>;
  setKwsConfigDraft: (id: KwsParamId, value: number | undefined) => void;
  sendKwsConfigParam: (id: KwsParamId, value: number) => Promise<boolean>;
  applyKwsConfigDraft: () => Promise<{
    ok: KwsParamId[];
    failed: Array<{ id: KwsParamId; reason: string }>;
  }>;
  resetKwsConfig: () => Promise<void>;
}

export const useBleCommandStore = create<BleCommandState>((set, get) => ({
  connectedDevice: null,

  deviceSerial: null,

  batteryLevel: null,
  batteryLoading: false,
  batteryError: null,
  batteryStateLabel: null,

  activeApp: null,
  latestDetection: 'Waiting',
  confidence: 0,
  receivedAt: null,

  micWave: new Int16Array(),

  subscription: null,

  resetLoading: false,
  resetError: null,

  appsList: [],
  selectedAppId: null,

  calibrationRequired: false,
  calibrationInProgress: false,
  calibrationError: null,
  calibrationAckResolver: null,

  kwsConfig: {},
  kwsConfigDraft: {},
  kwsConfigPending: new Set<KwsParamId>(),
  kwsConfigError: {},
  kwsConfigAckResolver: null,

  isInferenceRunning: false,
  deployAckResolver: null,

  // ✅ DEVICE SESSION START
  startDeviceSession: async (device: BLEDevice) => {
    // Firmware auto-starts the audio pipeline at boot — default to running
    // until the user explicitly stops it. If they want a different state,
    // the dashboard's Start/Stop Inference control will drive it.
    set({ connectedDevice: device, isInferenceRunning: true });

    await get().startNotifications(device.id);

    // The serial is only available over the connection, so ask for it as soon
    // as there is one. Writes are serialised by the command queue, so this
    // does not race the battery request that follows.
    await get().requestDeviceInfo();

    // Automatically request battery on connect
    await get().requestBattery();
  },

  // ✅ DEVICE SESSION END
  endDeviceSession: () => {
    get().stopNotifications();

    set({
      connectedDevice: null,
      deviceSerial: null,
      batteryLevel: null,
      batteryLoading: false,
      batteryError: null,
      batteryStateLabel: null,
      activeApp: null,
      latestDetection: undefined,
      confidence: undefined,
      kwsConfig: {},
      kwsConfigDraft: {},
      kwsConfigPending: new Set<KwsParamId>(),
      kwsConfigError: {},
      kwsConfigAckResolver: null,
      isInferenceRunning: false,
      deployAckResolver: null,
      calibrationRequired: false,
      calibrationInProgress: false,
      calibrationError: null,
      calibrationAckResolver: null,
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
              const parsed = batteryState ? Number(batteryState) : NaN;
              const stateNum: BatteryState | null = Number.isNaN(parsed)
                ? null
                : (parsed as BatteryState);
              set({
                batteryLevel: batteryPercentage,
                batteryLoading: false,
                batteryError: null,
                batteryStateLabel: getBatteryLabel(stateNum),
              });
              break;

            case 'DEVICE_INFO': {
              // Last frame of the burst carries the permanent hardware serial.
              // A firmware that predates the change ends the burst one frame
              // early, so the field is absent there — leave the serial null
              // rather than show a blank row.
              const serial = String(data.data.serial ?? '')
                .trim()
                .toLowerCase();
              if (DEVICE_SERIAL_PATTERN.test(serial)) {
                set({ deviceSerial: serial });
              }
              break;
            }

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

            case 'DEPLOYSTART_ACK': {
              const resolver = get().deployAckResolver;
              if (resolver && resolver.kind === 'start') {
                resolver.resolve();
                if (get().deployAckResolver === resolver) {
                  set({ deployAckResolver: null });
                }
              }
              set({ isInferenceRunning: true });
              break;
            }

            case 'DEPLOYSTOP_ACK': {
              const resolver = get().deployAckResolver;
              if (resolver && resolver.kind === 'stop') {
                resolver.resolve();
                if (get().deployAckResolver === resolver) {
                  set({ deployAckResolver: null });
                }
              }
              set({ isInferenceRunning: false });
              break;
            }

            case 'STREAMSTART':
              // Firmware no longer sends RMS scalars here — mic samples now
              // arrive as binary WAVE frames. Keep the case inert so any
              // legacy-firmware echoes are ignored rather than mis-parsed.
              break;

            case 'WAVE': {
              const wave = data.data as WavePayload;
              const prev = get().micWave;
              const incoming = wave.samples;
              const total = prev.length + incoming.length;
              const startCopy =
                total > MIC_BUFFER_SIZE ? total - MIC_BUFFER_SIZE : 0;
              const kept = total - startCopy;
              const next = new Int16Array(kept);
              // Copy the tail of prev that fits, then all of incoming.
              const prevKeep = Math.max(0, prev.length - startCopy);
              if (prevKeep > 0) {
                next.set(prev.subarray(prev.length - prevKeep), 0);
              }
              next.set(incoming, prevKeep);
              set({ micWave: next });
              break;
            }

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
                keywords: [],
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

            case 'CONFIG_VALUE': {
              const meta = KWS_PARAMS.find(p => p.id === data.paramId);
              if (!meta) break;
              const parsed = parseKwsValue(meta, data.rawValue);
              if (parsed === null) break;
              const id = data.paramId as KwsParamId;
              set(state => ({
                kwsConfig: { ...state.kwsConfig, [id]: parsed },
                kwsConfigDraft: { ...state.kwsConfigDraft, [id]: undefined },
                kwsConfigError: { ...state.kwsConfigError, [id]: undefined },
              }));
              break;
            }

            case 'CONFIG_SET_ACK': {
              const id = data.paramId as KwsParamId;
              const resolver = get().kwsConfigAckResolver;
              if (
                resolver &&
                resolver.kind === 'set' &&
                resolver.paramId === id
              ) {
                resolver.resolve(data.ok);
                set({ kwsConfigAckResolver: null });
              }
              if (data.ok) {
                set(state => {
                  const next = { ...state.kwsConfig };
                  const draftVal = state.kwsConfigDraft[id];
                  if (draftVal !== undefined) next[id] = draftVal;
                  return {
                    kwsConfig: next,
                    kwsConfigDraft: {
                      ...state.kwsConfigDraft,
                      [id]: undefined,
                    },
                    kwsConfigError: {
                      ...state.kwsConfigError,
                      [id]: undefined,
                    },
                  };
                });
              } else {
                set(state => ({
                  kwsConfigError: {
                    ...state.kwsConfigError,
                    [id]: data.reason || 'ERR',
                  },
                }));
              }
              break;
            }

            case 'CONFIG_RESET_ACK': {
              const resolver = get().kwsConfigAckResolver;
              if (resolver && resolver.kind === 'reset') {
                resolver.resolve();
                set({ kwsConfigAckResolver: null });
              }
              // The 6-frame burst that follows will overwrite kwsConfig via
              // subsequent CONFIG_VALUE cases — nothing else to do here.
              break;
            }

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

                // Firmware APPS_INFO burst (4 frames, positional):
                //   0: modelName, 1: inputShape, 2: numClasses, 3: keywords (';' delimited)
                const keywords = (parsedInfoData[3] ?? '')
                  .split(';')
                  .map(k => k.trim())
                  .filter(Boolean);

                const appsInfoData: AppsList = {
                  ...existingApp,
                  modelName: parsedInfoData[0],
                  inputShape: parsedInfoData[1],
                  noOfClasses: parsedInfoData[2],
                  keywords,
                };

                set(state => {
                  const updatedAppsList = [...state.appsList];
                  updatedAppsList[existAppIndex] = appsInfoData;
                  return { appsList: updatedAppsList };
                });
              }

              break;

            case 'CALIBRATION_STATUS': {
              // Handle the calibration status received from the firmware.
              // calibrated:true means calibration is complete.
              // calibrated:false means the device still needs calibration.
              // Update the UI state and resolve any active calibration request.
              const resolver = get().calibrationAckResolver;
              if (resolver) {
                resolver.resolve(data.calibrated);
                if (get().calibrationAckResolver === resolver) {
                  set({ calibrationAckResolver: null });
                }
              }
              set(state => ({
                calibrationRequired: !data.calibrated,
                calibrationInProgress: false,
                  // Keep the existing error when calibration is still required.
                calibrationError: data.calibrated
                  ? null
                  : state.calibrationError,
              }));
              break;
            }

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
      } catch {
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
    } catch {
      set({
        batteryError: 'Battery request failed',
        batteryLoading: false,
        batteryStateLabel: null,
      });
    }
    await new Promise(r => setTimeout(r, 300));
    try {
      await BleService.sendCommand(deviceId, BleCommand.APPS);
    } catch {
      set({
        appsList: [],
      });
    }
  },

  // ✅ Request device info — the five-frame burst whose last frame carries the
  // permanent hardware serial. The reply lands in the DEVICE_INFO case above.
  requestDeviceInfo: async () => {
    const deviceId = get().connectedDevice?.id;
    if (!deviceId) return;

    try {
      await BleService.sendCommand(deviceId, BleCommand.DEVICE_INFO);
    } catch {
      // Nothing to show for a failed request: the Device ID row keeps its
      // pending state until a later request succeeds.
      if (__DEV__) console.warn('Device info request failed');
    }
  },

  // ✅ Deploy app — sends DEPLOY_START, waits for the ACK_DONE (8:170) before
  // updating local state so the UI only flips to "running" once the firmware
  // has actually started the pipeline.
  deployApp: async (appId: string) => {
    const deviceId = get().connectedDevice?.id;
    if (!deviceId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let thisResolver: DeployAckResolver | null = null;
    try {
      const ack = new Promise<void>((resolve, reject) => {
        thisResolver = { kind: 'start', resolve, reject };
        set({ deployAckResolver: thisResolver });
      });

      await BleService.sendCommand(
        deviceId,
        `${BleCommand.DEPLOYSTART}:${appId},1`,
      );

      const timeout = new Promise<void>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('DEPLOYSTART ACK timeout')),
          3000,
        );
      });

      await Promise.race([ack, timeout]);

      set({
        activeApp: appId,
        latestDetection: 'Waiting...',
        confidence: 0,
        receivedAt: null,
        isInferenceRunning: true,
      });
    } finally {
      if (timer) clearTimeout(timer);
      if (thisResolver && get().deployAckResolver === thisResolver) {
        set({ deployAckResolver: null });
      }
    }
  },

  // ✅ Stop app — sends DEPLOY_STOP, waits for the ACK_DONE (10:170).
  stopApp: async (appId: string) => {
    const deviceId = get().connectedDevice?.id;
    if (!deviceId) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let thisResolver: DeployAckResolver | null = null;
    try {
      const ack = new Promise<void>((resolve, reject) => {
        thisResolver = { kind: 'stop', resolve, reject };
        set({ deployAckResolver: thisResolver });
      });

      await BleService.sendCommand(
        deviceId,
        `${BleCommand.DEPLOYSTOP}:${appId},0`,
      );

      const timeout = new Promise<void>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('DEPLOYSTOP ACK timeout')),
          3000,
        );
      });

      await Promise.race([ack, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
      if (thisResolver && get().deployAckResolver === thisResolver) {
        set({ deployAckResolver: null });
      }
    }

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

    await BleService.sendCommand(
      deviceId,
      `${BleCommand.STREAMSTART}:${appId},1`,
    );

    set({
      micWave: new Int16Array(),
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
      micWave: new Int16Array(),
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
    } catch {
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

  // Start IMU calibration for Fall Detection.
  // Send the calibration command to the connected device and wait for
  // the firmware to return the calibration result. The calibration can
  // take around 25 seconds, so a longer timeout is used.
  requestCalibration: async () => {
    const deviceId = get().connectedDevice?.id;
    if (!deviceId) return false;

    set({ calibrationInProgress: true, calibrationError: null });

    let timer: ReturnType<typeof setTimeout> | null = null;
    let thisResolver: CalibrationAckResolver | null = null;
    try {
      const ack = new Promise<boolean>((resolve, reject) => {
        thisResolver = { resolve, reject };
        set({ calibrationAckResolver: thisResolver });
      });

      await BleService.sendCommand(deviceId, BleCommand.CALIBRATE);

      const timeout = new Promise<boolean>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('Calibration timed out')),
          35000,
        );
      });

      const calibrated = await Promise.race([ack, timeout]);
      if (!calibrated) {
        set({ calibrationError: 'Calibration failed. Please try again.' });
      }
      return calibrated;
    } catch (error) {
      if (__DEV__) console.error('Calibration failed:', error);
      set({ calibrationError: 'Calibration failed. Please try again.' });
      return false;
    } finally {
      if (timer) clearTimeout(timer);
      if (thisResolver && get().calibrationAckResolver === thisResolver) {
        set({ calibrationAckResolver: null });
      }
      set({ calibrationInProgress: false });
    }
  },
  setCalibrationError: error => set({ calibrationError: error || null }),

  // ── KWS App Controls (CMD_CONFIG / opcode 4) ───────────────────────────────
  requestKwsConfig: async () => {
    const deviceId = get().connectedDevice?.id;
    if (!deviceId) return;
    await BleService.sendCommand(deviceId, `${BleCommand.CONFIG}:GET`);
  },

  setKwsConfigDraft: (id, value) => {
    set(state => ({
      kwsConfigDraft: { ...state.kwsConfigDraft, [id]: value },
      kwsConfigError: { ...state.kwsConfigError, [id]: undefined },
    }));
  },

  sendKwsConfigParam: async (id, value) => {
    const deviceId = get().connectedDevice?.id;
    if (!deviceId) throw new Error('Device not connected');
    const meta = KWS_PARAMS.find(p => p.id === id);
    if (!meta) throw new Error(`Unknown KWS param id: ${id}`);

    set(state => {
      const pending = new Set(state.kwsConfigPending);
      pending.add(id);
      return {
        kwsConfigPending: pending,
        kwsConfigDraft: { ...state.kwsConfigDraft, [id]: value },
      };
    });

    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const ack = new Promise<boolean>((resolve, reject) => {
        set({
          kwsConfigAckResolver: { kind: 'set', paramId: id, resolve, reject },
        });
      });

      const wire = formatKwsValue(meta, value);
      await BleService.sendCommand(
        deviceId,
        `${BleCommand.CONFIG}:${id}:${wire}`,
      );

      const timeout = new Promise<boolean>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`CONFIG ACK timeout for ${meta.name}`)),
          2000,
        );
      });

      const ok = await Promise.race([ack, timeout]);
      return ok;
    } finally {
      if (timer) clearTimeout(timer);
      const resolver = get().kwsConfigAckResolver;
      if (resolver && resolver.kind === 'set' && resolver.paramId === id) {
        set({ kwsConfigAckResolver: null });
      }
      set(state => {
        const pending = new Set(state.kwsConfigPending);
        pending.delete(id);
        return { kwsConfigPending: pending };
      });
    }
  },

  applyKwsConfigDraft: async () => {
    const draft = get().kwsConfigDraft;
    const ok: KwsParamId[] = [];
    const failed: Array<{ id: KwsParamId; reason: string }> = [];

    for (const meta of KWS_PARAMS) {
      const value = draft[meta.id];
      if (value === undefined) continue;
      try {
        const success = await get().sendKwsConfigParam(meta.id, value);
        if (success) {
          ok.push(meta.id);
        } else {
          failed.push({
            id: meta.id,
            reason: get().kwsConfigError[meta.id] || 'ERR',
          });
        }
      } catch (err) {
        failed.push({
          id: meta.id,
          reason: err instanceof Error ? err.message : 'unknown',
        });
      }
    }

    return { ok, failed };
  },

  resetKwsConfig: async () => {
    const deviceId = get().connectedDevice?.id;
    if (!deviceId) throw new Error('Device not connected');

    let timer: ReturnType<typeof setTimeout> | null = null;
    try {
      const ack = new Promise<void>((resolve, reject) => {
        set({ kwsConfigAckResolver: { kind: 'reset', resolve, reject } });
      });
      await BleService.sendCommand(deviceId, `${BleCommand.CONFIG}:RESET`);
      const timeout = new Promise<void>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('CONFIG RESET ACK timeout')),
          2000,
        );
      });
      await Promise.race([ack, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
      const resolver = get().kwsConfigAckResolver;
      if (resolver && resolver.kind === 'reset') {
        set({ kwsConfigAckResolver: null });
      }
    }
  },
}));
