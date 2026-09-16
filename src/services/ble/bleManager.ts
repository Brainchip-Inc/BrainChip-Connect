import { decode, Encoder } from 'cbor-x';
import CRC32 from 'crc-32';
import yaml from 'js-yaml';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';
import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';
import { nameForDevice, useBleStore } from '../../app/store/useBleStore';
import BleConnectionHelper from '../../app/utils/BleConnectionHelper';
import { BleData } from '../../types/bleData';
import {
  FirmwareUpdateOutcome,
  FirmwareUpdatePhase,
} from '../../types/firmwareUpdate';
import { ModelUpdateOutcome } from '../../types/modelUpdate';
import { McubootImage, parseMcubootImage } from '../firmware/mcubootImage';
import { isAkidaTagManufacturerData } from './akidaTagAdvertisement';
import { BleCommand } from './bleCommands';
import { parseBinaryFrame, parseBleMessage } from './bleParser';
import { FirmwareUpdateError } from '../firmware/firmwareUpdateError';
import { buildCommand } from './buildCommand';
import {
  BLOCK_STATUS_TIMEOUT_MS,
  BOARD_WENT_QUIET,
  DATA_OFFSET_BYTES,
  INSTALL_STATUS_TIMEOUT_MS,
  LAST_BLOCK_STATUS_TIMEOUT_MS,
  ModelUpdateError,
  START_STATUS_TIMEOUT_MS,
  TRANSFER_TYPE_DATA,
  TRANSFER_TYPE_INFO,
  TransferResult,
  TransferStatus,
  buildAbortFrame,
  buildDataFrame,
  buildStartFrame,
  describeTransferFailure,
  parseTransferStatus,
} from './modelTransferProtocol';

const DEFAULT_SCAN_TIMEOUT_MS = 15000;

/** Grace period before the app starts looking for a board it just restarted. */
const REBOOT_SETTLE_MS = 4000;

/**
 * How long to keep looking for a restarted board. Installing an image means
 * copying it out of external SPI flash, so a board can be away for minutes.
 */
const REBOOT_RECONNECT_TIMEOUT_MS = 150000;

/** Length of one scan while waiting for a restarted board to advertise. */
const REBOOT_SCAN_WINDOW_MS = 6000;

/**
 * How long one attempt at reconnecting to a restarted board may hang. iOS
 * never gives up on a connect request of its own accord, and the address the
 * board had before the reboot is usually stale on Android, so an attempt that
 * is going nowhere has to be abandoned for the next scan to happen at all.
 */
const REBOOT_CONNECT_TIMEOUT_MS = 10000;

/** How long to wait for a board to answer with its hardware serial. */
const SERIAL_READ_TIMEOUT_MS = 6000;

/**
 * Grace period between subscribing to the board's transfer status and asking
 * it to begin. Subscribing returns before the descriptor write it triggers has
 * reached the board, and the board refuses a transfer it cannot report on.
 */
const STATUS_SUBSCRIBE_SETTLE_MS = 200;

/**
 * A model package read off the phone, in the terms the board is told it in.
 *
 * `infoCrc` covers the header the board will assemble from every other field
 * here as well as `infoBytes`, so the two travel together or neither means
 * anything; `dataCrc` covers `dataBytes` alone.
 */
interface ModelPackage {
  /** LittleFS path, whose last segment names the model on the board. */
  fsName: string;
  infoBytes: Buffer;
  dataBytes: Buffer;
  /** Info and data bytes together, which is what the stored header records. */
  totalLength: number;
  inputShape: number[];
  outputShape: number[];
  flashAddress: number;
  isEdgeLearned: boolean;
  /** Neurons per class in the upper 16 bits, class count in the lower 16. */
  packedClasses: number;
  /** MFCC normalisation scalar, as the bits of the float. */
  mfccFsBits: number;
  silenceClass: number;
  unknownClass: number;
  /** 0 for a synchronous model, 1 for an asynchronous one. */
  inferenceMode: number;
  infoCrc: number;
  dataCrc: number;
}

class BleService {
  private bleManager: BleManager;
  private stateSubscription: Subscription | null = null;
  private disconnectSubscription: Subscription | null = null;

  /* -------------------------------------------------------------------------- */
  /*                              BLE UUID CONFIG                               */
  /* -------------------------------------------------------------------------- */

  /**
   * Primary BLE Service UUID (BrainChip device UUIDs)
   * This service acts as the communication channel between
   * the mobile app and the embedded device.
   */
  private serviceUUID: string = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';

  /**
   * RX Characteristic UUID (Write)
   * Phone App ➜ Device
   *
   * Used to send commands/data FROM the mobile app TO the device.
   */
  private rxUUID: string = '6e400002-b5a3-f393-e0a9-e50e24dcca9e';

  /**
   * TX Characteristic UUID (Notify)
   * Device ➜ Phone App
   *
   * Used to receive notifications/data FROM the device TO the app.
   */
  private txUUID: string = '6e400003-b5a3-f393-e0a9-e50e24dcca9e';

  private readonly CHUNK_SIZE = 247;
  private negotiatedMTU = 23;
  private monitorSubscriptions: Subscription[] = [];

  // Command queue to serialize BLE write operations
  private commandQueue: Array<() => Promise<void>> = [];
  private isProcessingQueue = false;

  // OTA lock to prevent concurrent firmware + model updates
  private otaInProgress: 'firmware' | 'model' | null = null;

  constructor() {
    this.bleManager = new BleManager();
  }

  /**
   * Check if Bluetooth is currently powered on.
   */
  isBluetoothEnabled = async (): Promise<boolean> => {
    try {
      const state = await this.bleManager.state();
      return state === State.PoweredOn;
    } catch {
      return false;
    }
  };

  /**
   * Subscribe to Bluetooth adapter state changes (powered on/off, unauthorized, etc.)
   * Returns an unsubscribe function.
   */
  onBluetoothStateChange = (callback: (state: State) => void): (() => void) => {
    this.stateSubscription = this.bleManager.onStateChange(newState => {
      callback(newState);
    }, true);

    return () => {
      this.stateSubscription?.remove();
      this.stateSubscription = null;
    };
  };

  /**
   * Check current permission state without prompting the user.
   */
  checkAllPermissions = async (): Promise<{
    bluetooth: boolean;
    location: boolean;
    notifications: boolean;
  }> => {
    if (Platform.OS === 'android') {
      try {
        const androidVersion = Platform.Version;

        const bluetoothGranted =
          androidVersion >= 31
            ? (await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
              )) &&
              (await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
              ))
            : true;

        const locationGranted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        );

        const notificationsGranted =
          androidVersion >= 33
            ? await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
              )
            : true;

        return {
          bluetooth: bluetoothGranted,
          location: locationGranted,
          notifications: notificationsGranted,
        };
      } catch {
        return {
          bluetooth: false,
          location: false,
          notifications: false,
        };
      }
    }

    // For iOS, permissions are handled through Info.plist.
    return {
      bluetooth: true,
      location: true,
      notifications: true,
    };
  };

  /**
   * Request all required permissions (Bluetooth, Location, Notifications).
   */
  requestAllPermissions = async (): Promise<{
    bluetooth: boolean;
    location: boolean;
    notifications: boolean;
  }> => {
    if (Platform.OS === 'android') {
      try {
        const androidVersion = Platform.Version;

        let bluetoothGranted = false;
        let locationGranted = false;
        let notificationsGranted = false;

        // Request Bluetooth permissions (Android 12+ / API 31+)
        if (androidVersion >= 31) {
          const bluetoothScanPermission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            {
              title: 'Bluetooth Scan Permission',
              message:
                'This app needs permission to scan for Bluetooth devices.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            },
          );

          const bluetoothConnectPermission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            {
              title: 'Bluetooth Connect Permission',
              message:
                'This app needs permission to connect to Bluetooth devices.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            },
          );

          bluetoothGranted =
            bluetoothScanPermission === PermissionsAndroid.RESULTS.GRANTED &&
            bluetoothConnectPermission === PermissionsAndroid.RESULTS.GRANTED;
        } else {
          bluetoothGranted = true;
        }

        // Location permission is required for BLE scanning on all Android versions
        const locationPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message:
              'This app needs location permission to scan for Bluetooth devices.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        locationGranted =
          locationPermission === PermissionsAndroid.RESULTS.GRANTED;

        // Notification permission (Android 13+ / API 33+)
        if (androidVersion >= 33) {
          const notificationPermission = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
            {
              title: 'Notification Permission',
              message:
                'This app needs permission to send you notifications about device status.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            },
          );
          notificationsGranted =
            notificationPermission === PermissionsAndroid.RESULTS.GRANTED;
        } else {
          notificationsGranted = true;
        }

        return {
          bluetooth: bluetoothGranted,
          location: locationGranted,
          notifications: notificationsGranted,
        };
      } catch {
        return {
          bluetooth: false,
          location: false,
          notifications: false,
        };
      }
    }

    // For iOS, permissions are handled through Info.plist
    return {
      bluetooth: true,
      location: true,
      notifications: true,
    };
  };

  /**
   * Scan for BLE devices with an automatic timeout.
   * The callback fires for each device found.
   * Returns a cleanup function to stop the scan early.
   */
  scanDevices = (
    onDeviceFound: (device: Device) => void,
    serviceUUIDs: string[] | null = null,
    timeoutMs: number = DEFAULT_SCAN_TIMEOUT_MS,
  ): (() => void) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    this.bleManager.startDeviceScan(
      serviceUUIDs,
      { allowDuplicates: false },
      (error, device) => {
        if (error) {
          this.stopScan();
          return;
        }

        // Skip processing if the device is null or invalid
        if (!device || !device.id) {
          return;
        }

        // Only surface AkidaTag boards. A board advertises no service UUID at
        // all, so it is identified by the chip ID in its manufacturer data;
        // the name is still required because the list has nothing to show
        // without one, and it is deliberately not matched on because the DK
        // advertises a different name from the tag.
        if (
          !device.name ||
          !isAkidaTagManufacturerData(device.manufacturerData)
        ) {
          return;
        }

        onDeviceFound(device);
      },
    );

    // Auto-stop after timeout
    timeoutId = setTimeout(() => {
      this.stopScan();
    }, timeoutMs);

    // Return cleanup function
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      this.stopScan();
    };
  };

  /**
   * Stop the current device scan.
   */
  stopScan = () => {
    this.bleManager.stopDeviceScan();
  };

  /**
   * Connect to a BLE device and discover its services/characteristics.
   *
   * @param deviceId - Device to connect to.
   * @param timeoutMs - How long to let the request hang, or undefined to wait
   *   as long as the platform will, which on iOS is forever.
   */
  connectDevice = async (
    deviceId: string,
    timeoutMs?: number,
  ): Promise<Device> => {
    try {
      const device = await this.bleManager.connectToDevice(
        deviceId,
        timeoutMs === undefined ? undefined : { timeout: timeoutMs },
      );
      const updatedDevice = await device.requestMTU(this.CHUNK_SIZE);

      this.negotiatedMTU = updatedDevice.mtu ?? 23;
      await device.discoverAllServicesAndCharacteristics();

      BleConnectionHelper.setConnectedDevice(deviceId);

      this.listenForDisconnection(deviceId, () => {
        BleConnectionHelper.handleDisconnect(deviceId);
      });

      return device;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to connect to device: ${message}`);
    }
  };

  /**
   * Disconnect from a BLE device.
   */
  disconnectDevice = async (deviceId: string) => {
    try {
      this.cleanupMonitors();
      BleConnectionHelper.markManualDisconnect();
      await this.bleManager.cancelDeviceConnection(deviceId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to disconnect from device: ${message}`);
    }
  };

  /**
   * Check if a specific device is currently connected.
   */
  isDeviceConnected = async (deviceId: string): Promise<boolean> => {
    try {
      return await this.bleManager.isDeviceConnected(deviceId);
    } catch {
      return false;
    }
  };

  /**
   * Get a list of currently connected devices (filtered by service UUIDs if provided).
   */
  getConnectedDevices = async (
    serviceUUIDs: string[] = [],
  ): Promise<Device[]> => {
    try {
      return await this.bleManager.connectedDevices(serviceUUIDs);
    } catch {
      return [];
    }
  };

  /**
   * Read data from a BLE characteristic.
   * Requires setUUIDs() to be called first.
   */
  getDeviceData = async (deviceId: string): Promise<unknown> => {
    if (!this.serviceUUID || !this.txUUID || !this.rxUUID) {
      throw new Error(
        'Service/Characteristic UUIDs not configured. Call setUUIDs() first.',
      );
    }

    try {
      const devices = await this.bleManager.devices([deviceId]);
      const device = devices[0];

      if (!device) {
        throw new Error('Device not found');
      }

      await device.discoverAllServicesAndCharacteristics();

      const characteristic = await device.readCharacteristicForService(
        this.serviceUUID,
        this.txUUID,
      );

      if (!characteristic?.value) {
        throw new Error('No data received from device');
      }

      const decoded = Buffer.from(characteristic.value, 'base64').toString(
        'utf-8',
      );

      try {
        return JSON.parse(decoded);
      } catch {
        return { raw: decoded };
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to read device data';
      throw new Error(message);
    }
  };

  /**
   * Listen for device disconnection.
   *
   */
  listenForDisconnection = (deviceId: string, onDisconnected: () => void) => {
    // Reconnecting installs a fresh listener, so drop the previous one or a
    // later disconnect fires the handler once per connection ever made.
    this.stopDisconnectListener();

    this.disconnectSubscription = this.bleManager.onDeviceDisconnected(
      deviceId,
      (_error, _device) => {
        // console.log('[BLE] Device disconnected');

        this.cleanupMonitors();

        BleConnectionHelper.setDisconnecthandled(true);

        onDisconnected();
      },
    );

    return this.disconnectSubscription;
  };

  stopDisconnectListener = () => {
    try {
      this.disconnectSubscription?.remove();
    } catch (e) {
      if (__DEV__) console.warn('Failed to remove disconnect listener:', e);
    }

    this.disconnectSubscription = null;
  };

  /**
   * Discover all services and characteristics on a connected device.
   * Useful when UUIDs are not known ahead of time.
   */
  discoverServicesAndCharacteristics = async (deviceId: string) => {
    const devices = await this.bleManager.devices([deviceId]);
    const connectedDevice = devices[0];

    if (!connectedDevice) {
      throw new Error('Device not found');
    }

    await connectedDevice.discoverAllServicesAndCharacteristics();
    const services = await connectedDevice.services();

    const result: {
      serviceUUID: string;
      characteristics: {
        uuid: string;
        isReadable: boolean;
        isWritable: boolean;
        isNotifiable: boolean;
      }[];
    }[] = [];

    for (const service of services) {
      const characteristics = await service.characteristics();
      result.push({
        serviceUUID: service.uuid,
        characteristics: characteristics.map(c => ({
          uuid: c.uuid,
          isReadable: c.isReadable,
          isWritable: c.isWritableWithResponse || c.isWritableWithoutResponse,
          isNotifiable: c.isNotifiable,
        })),
      });
    }

    return result;
  };

  // Sending command from phone app to device
  // Sending a string command directly as UTF-8 bytes
  private processCommandQueue = async () => {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;
    while (this.commandQueue.length > 0) {
      const next = this.commandQueue.shift()!;
      await next();
    }
    this.isProcessingQueue = false;
  };

  sendCommand = (
    deviceId: string,
    command: BleCommand | String,
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      this.commandQueue.push(async () => {
        try {
          const connected = await this.isDeviceConnected(deviceId);
          if (!connected) {
            throw new Error('Device disconnected');
          }
          const updatedCommand = buildCommand(command);
          const bufferCommand = Buffer.from(updatedCommand, 'utf-8');

          await this.bleManager.writeCharacteristicWithoutResponseForDevice(
            deviceId,
            this.serviceUUID,
            this.rxUUID,
            bufferCommand.toString('base64'),
          );
          resolve();
        } catch (error: any) {
          reject(new Error(error?.message || 'Failed to send command'));
        }
      });
      this.processCommandQueue();
    });
  };

  // Receiving data from the device
  subscribeToNotifications = async (
    deviceId: string,
    onData: (data: BleData) => void,
  ): Promise<Subscription> => {
    const subscription = this.bleManager.monitorCharacteristicForDevice(
      deviceId,
      this.serviceUUID,
      this.txUUID,
      (error, characteristic) => {
        if (error) {
          const msg = error?.message ?? '';
          // console.log('[BLE] monitor error:', msg);

          if (
            msg.includes('disconnected') ||
            msg.includes('cancelled') ||
            msg.includes('Device is not connected')
          ) {
            return;
          }

          return;
        }

        if (!characteristic?.value) return;

        const buf = Buffer.from(characteristic.value, 'base64');

        // Binary mic-stream frames start with 0x42 'B'. All ASCII text frames
        // start with '0'..'3' (frame-type digit), so the magic byte is
        // unambiguous. Route binary → parseBinaryFrame, ASCII → parseBleMessage.
        if (buf.length > 0 && buf[0] === 0x42) {
          const parsed = parseBinaryFrame(buf);
          if (parsed) onData(parsed);
          return;
        }

        const decoded = buf.toString('utf-8');
        const parsed = parseBleMessage(decoded);
        if (parsed) onData(parsed);
      },
    );

    this.monitorSubscriptions.push(subscription);

    return subscription;
  };

  /**
   * Clean up BLE manager resources. Call when the app is shutting down.
   */
  destroy = () => {
    this.cleanupMonitors();
    this.stateSubscription?.remove();
    this.stateSubscription = null;
    this.bleManager.destroy();
  };

  /**
   * Remove a single subscription and clean it from the tracked array.
   */
  removeSubscription = (sub: Subscription) => {
    try {
      sub.remove();
    } catch (e) {
      if (__DEV__) console.warn('Failed to remove BLE subscription:', e);
    }
    this.monitorSubscriptions = this.monitorSubscriptions.filter(
      s => s !== sub,
    );
  };

  private cleanupMonitors() {
    for (const sub of this.monitorSubscriptions) {
      try {
        sub.remove();
      } catch (e) {
        if (__DEV__) console.warn('Failed to remove BLE subscription:', e);
      }
    }
    this.monitorSubscriptions = [];
  }

  /* ===================================================================
   * MCUboot SMP FOTA
   *
   * =================================================================== */

  private fotaServiceUUID = '8d53dc1d-1db7-4cd3-868b-8a527460aa84';
  private fotaCharUUID = 'da2e7828-fbce-4e01-ae9e-261174997c48';

  private fotaSeq = 0;
  private fotaResolver: ((data: any) => void) | null = null;
  private fotaRejecter: ((err: Error) => void) | null = null;
  private smpBuffer: Buffer | null = null;
  private smpExpectedLength = 0;
  private pendingFotaResponse: any | null = null;

  /* ── Subscribe to FOTA notifications ── */

  subscribeToFotaNotifications = (deviceId: string): Subscription => {
    const fotasubscrption = this.bleManager.monitorCharacteristicForDevice(
      deviceId,
      this.fotaServiceUUID,
      this.fotaCharUUID,
      (error, characteristic) => {
        if (error) {
          const msg = String(error?.message ?? '');

          if (
            msg.includes('disconnected') ||
            msg.includes('GATT') ||
            msg.includes('Operation was cancelled') ||
            msg.includes('Device is not connected')
          ) {
            return;
          }

          if (this.fotaRejecter) {
            const rej = this.fotaRejecter;
            this.fotaResolver = null;
            this.fotaRejecter = null;
            rej(new Error(msg));
          }

          return;
        }

        if (!characteristic?.value) return;

        // if device disconnected, ignore
        if (!deviceId) {
          return;
        }

        const chunk = Buffer.from(characteristic.value, 'base64');
        if (chunk.length < 1) return;

        /* ── Reassembly ──
         * First packet: contains 8-byte SMP header
         *   bytes[2-3] = payload length (big-endian)
         *   total expected = 8 + payloadLen
         * Subsequent packets: appended until full
         */
        if (!this.smpBuffer) {
          if (chunk.length < 8) {
            return;
          }
          const payloadLen = chunk.readUInt16BE(2);
          this.smpExpectedLength = 8 + payloadLen;
          this.smpBuffer = Buffer.from(chunk);
        } else {
          this.smpBuffer = Buffer.concat([this.smpBuffer, chunk]);
        }

        if (this.smpBuffer.length < this.smpExpectedLength) {
          return;
        }

        // Full frame received
        const fullFrame = this.smpBuffer.slice(0, this.smpExpectedLength);
        this.smpBuffer = null;
        this.smpExpectedLength = 0;

        const payloadBytes = fullFrame.slice(8);
        let decoded: any = {};

        if (payloadBytes.length > 0) {
          try {
            decoded = decode(payloadBytes);
          } catch {
            return;
          }
        }

        if (this.fotaResolver) {
          const resolve = this.fotaResolver;
          this.fotaResolver = null;
          this.fotaRejecter = null;
          resolve(decoded);
        } else {
          // resolver not ready yet → store response
          this.pendingFotaResponse = decoded;
        }
      },
    );
    this.monitorSubscriptions.push(fotasubscrption);
    return fotasubscrption;
  };

  /* ── Wait for one FOTA response ── */

  private waitForFotaResponse(timeoutMs = 15000): Promise<any> {
    return new Promise((resolve, reject) => {
      // if response already arrived
      if (this.pendingFotaResponse) {
        const data = this.pendingFotaResponse;
        this.pendingFotaResponse = null;
        resolve(data);
        return;
      }

      const timer = setTimeout(() => {
        this.fotaResolver = null;
        this.fotaRejecter = null;
        if (__DEV__) console.log('[FOTA]', `No answer within ${timeoutMs}ms`);
        reject(
          new FirmwareUpdateError(
            'The board stopped answering while the firmware was being sent. ' +
              'Keep it close to the phone and try again.',
          ),
        );
      }, timeoutMs);

      this.fotaResolver = (data: any) => {
        clearTimeout(timer);
        resolve(data);
      };

      this.fotaRejecter = (err: Error) => {
        clearTimeout(timer);
        reject(err);
      };
    });
  }

  /* ── Build SMP header ──
   *
   * byte[0] = (version << 3) | op
   *   v=1 op=0 (ReadReq)  → 0x08   ← used for: bootloader, mode, image list
   *   v=1 op=2 (WriteReq) → 0x0A   ← used for: upload, confirm, reset
   *
   * Verified from log bytes:
   *   Version:1 Op:0 Cmd:8  (bootloader query)
   *   Version:1 Op:2 Cmd:0  (confirm)
   *   Version:1 Op:2 Cmd:5  (reset)
   */
  private buildSmpPacket(
    op: number,
    group: number,
    command: number,
    payload: Buffer,
    version = 1,
  ): Buffer {
    const header = Buffer.alloc(8);
    header.writeUInt8((version << 3) | (op & 0x07), 0);
    header.writeUInt8(0x00, 1);
    header.writeUInt16BE(payload.length, 2);
    header.writeUInt16BE(group, 4);
    header.writeUInt8(this.fotaSeq++ & 0xff, 6);
    header.writeUInt8(command, 7);
    return Buffer.concat([header, payload]);
  }

  /* ── Convert Buffer → Uint8Array recursively ──
   *
   */
  private prepareCborBody(body: any): any {
    if (Buffer.isBuffer(body)) return new Uint8Array(body);
    if (body instanceof Uint8Array) return body;
    if (Array.isArray(body)) return body.map(v => this.prepareCborBody(v));
    if (body && typeof body === 'object') {
      const result: Record<string, any> = {};
      for (const key of Object.keys(body)) {
        result[key] = this.prepareCborBody(body[key]);
      }
      return result;
    }
    return body;
  }

  /* ── Core send + wait ──
   *
   */
  private async sendSmp(
    deviceId: string,
    op: number,
    group: number,
    command: number,
    body: any,
    version = 1,
    timeoutMs = 15000,
  ): Promise<any> {
    // Reset reassembly
    this.smpBuffer = null;
    this.smpExpectedLength = 0;

    const cborBody = this.prepareCborBody(body);

    const encoder = new Encoder({
      useRecords: false,
      structuredClone: false,
      tagUint8Array: false,
    });

    const payload = Buffer.from(encoder.encode(cborBody));
    const packet = this.buildSmpPacket(op, group, command, payload, version);
    const responsePromise = this.waitForFotaResponse(timeoutMs);

    if (Platform.OS === 'ios') {
      await this.bleManager.writeCharacteristicWithoutResponseForDevice(
        deviceId,
        this.fotaServiceUUID,
        this.fotaCharUUID,
        packet.toString('base64'),
      );
    } else {
      await this.bleManager.writeCharacteristicWithResponseForDevice(
        deviceId,
        this.fotaServiceUUID,
        this.fotaCharUUID,
        packet.toString('base64'),
      );
    }

    return responsePromise;
  }

  /* ── Step 1: SMP params — v0 header, MUST be first ──
   *
   */
  querySmpParams = async (
    deviceId: string,
  ): Promise<{ bufSize: number; bufCount: number }> => {
    this.smpBuffer = null;
    this.smpExpectedLength = 0;

    const header = Buffer.alloc(8);
    header.writeUInt8(0x00, 0); // version=0, op=0
    header.writeUInt8(0x00, 1); // flags
    header.writeUInt16BE(0x01, 2); // payload len = 1
    header.writeUInt16BE(0x00, 4); // group = 0
    header.writeUInt8(0xff, 6); // seq = 0xFF
    header.writeUInt8(0x06, 7); // cmd = 6

    const packet = Buffer.concat([header, Buffer.from([0xa0])]); // 0xA0 = empty CBOR map
    const responsePromise = this.waitForFotaResponse(5000);

    await this.bleManager.writeCharacteristicWithoutResponseForDevice(
      deviceId,
      this.fotaServiceUUID,
      this.fotaCharUUID,
      packet.toString('base64'),
    );

    const response = await responsePromise;
    return {
      bufSize: response?.buf_size ?? 256,
      bufCount: response?.buf_count ?? 4,
    };
  };

  /* ── Step 2: Bootloader info ── */

  async queryBootloaderInfo(deviceId: string): Promise<string> {
    const res = await this.sendSmp(deviceId, 0, 0, 8, {});
    return res?.bootloader ?? 'unknown';
  }

  /* ── Step 3: Boot mode ── */

  async queryBootMode(deviceId: string): Promise<number> {
    const res = await this.sendSmp(deviceId, 0, 0, 8, { query: 'mode' });
    return res?.mode ?? -1;
  }

  /* ── Step 4: List images ── */

  async sendImageList(deviceId: string): Promise<any> {
    return this.sendSmp(deviceId, 0, 1, 0, {});
  }

  /* ── Step 5: Upload firmware ──
   *
   * ✅ op=2 (WriteReq) — upload is a WRITE not a READ
   * ✅ CBOR key order: { data, len (first only), off }
   * ✅ Uint8Array for data field — encodes as CBOR byte string
   * ✅ No MTU re-negotiation — uses already negotiated MTU
   */
  async sendFirmwareFile(
    deviceId: string,
    filePath: string,
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    const mtu = Math.max(this.negotiatedMTU, 64);

    // ATT payload
    const attPayload = mtu - 3;

    // SMP header
    const smpHeader = 8;

    // CBOR overhead safety
    const cborSafety = 20;

    const chunkDataMax = attPayload - smpHeader - cborSafety;
    const firstChunkDataMax = chunkDataMax - 10;

    const fileBuffer = Buffer.from(
      await RNFS.readFile(filePath, 'base64'),
      'base64',
    );
    const totalSize = fileBuffer.length;

    let offset = 0;

    while (offset < totalSize) {
      const isFirst = offset === 0;
      const maxData = isFirst ? firstChunkDataMax : chunkDataMax;
      const end = Math.min(offset + maxData, totalSize);
      const slice = fileBuffer.slice(offset, end);

      // ✅ CBOR key order: data → len → off  (MCUboot is order-sensitive)
      // ✅ Uint8Array so cbor-x encodes as byte string
      const body: Record<string, any> = {};
      body.data = new Uint8Array(slice);
      if (isFirst) body.len = totalSize;
      body.off = offset;

      // First chunk: device erases flash → allow 30s
      const timeout = isFirst ? 30000 : 15000;

      const response = await this.sendSmp(
        deviceId,
        2, // ✅ op = WriteReq (was 0 = ReadReq — this caused "status" error)
        1, // Group = Image
        1, // Cmd = Upload
        body,
        1,
        timeout,
      );

      if (response?.rc !== undefined && response.rc !== 0) {
        if (__DEV__) {
          console.log(
            '[FOTA]',
            `Upload refused at ${offset}, rc=${response.rc}`,
          );
        }
        throw new FirmwareUpdateError(
          'The board stopped accepting the firmware partway through. Try ' +
            'sending it again.',
        );
      }

      // Device echoes next expected offset in response.off
      const nextOffset: number | undefined = response?.off;
      if (typeof nextOffset === 'number' && nextOffset > offset) {
        offset = nextOffset;
      } else {
        offset += slice.length;
      }

      onProgress?.(Math.min((offset / totalSize) * 100, 100));

      await new Promise(r => setTimeout(r, 5));
    }
  }

  /* ── Step 6: Confirm new image ── */

  async confirmFirmware(deviceId: string, hashBase64: string): Promise<any> {
    return this.sendSmp(deviceId, 2, 1, 0, {
      confirm: true,
      hash: new Uint8Array(Buffer.from(hashBase64, 'base64')), // ✅ Uint8Array
    });
  }

  /* ── Step 7: Reset device ──
   * GATT_CONN_TIMEOUT (status=8) after this = NORMAL, device is rebooting
   */

  async resetDevice(deviceId: string): Promise<void> {
    const payload = Buffer.from(
      new Encoder({
        useRecords: false,
        structuredClone: false,
        tagUint8Array: false,
      }).encode({}),
    );

    const packet = this.buildSmpPacket(2, 0, 5, payload, 1);

    try {
      if (Platform.OS === 'ios') {
        await this.bleManager.writeCharacteristicWithoutResponseForDevice(
          deviceId,
          this.fotaServiceUUID,
          this.fotaCharUUID,
          packet.toString('base64'),
        );
        // 🔥 important for iOS flush
        await new Promise(r => setTimeout(r, 300));
      } else {
        // keep Android behavior unchanged
        await this.bleManager.writeCharacteristicWithResponseForDevice(
          deviceId,
          this.fotaServiceUUID,
          this.fotaCharUUID,
          packet.toString('base64'),
        );
      }
    } catch {}
  }

  /**
   * Ask for the largest ATT MTU the link will carry, before sending a file.
   *
   * The MTU asked for at connection time does not always take, and a link left
   * at the 23-byte minimum carries 16 bytes of a transfer per write, which is
   * fifteen times less than a negotiated one. Both update paths therefore ask
   * again on their own account rather than trusting what connecting left
   * behind.
   *
   * @param deviceId - Board to renegotiate with.
   */
  private async requestLargeMtu(deviceId: string): Promise<void> {
    try {
      const device = await this.bleManager.requestMTUForDevice(deviceId, 498);

      this.negotiatedMTU = device.mtu ?? 23;
    } catch {
      this.negotiatedMTU = 247; // safe fallback
    }
  }

  /**
   * Locate the signed image inside whatever the user picked.
   *
   * @param filePath - A `.bin`, or a `.zip` holding exactly one.
   * @returns The image to send, and the directory a zip was expanded into,
   *   which is empty for a `.bin` and is the caller's to delete.
   * @throws If a zip carries no `.bin`.
   */
  private extractFirmwareBinary = async (
    filePath: string,
  ): Promise<{ binaryPath: string; unzipPath: string }> => {
    if (!filePath.endsWith('.zip')) {
      return { binaryPath: filePath, unzipPath: '' };
    }

    const unzipPath = `${RNFS.TemporaryDirectoryPath}/firmware_${Date.now()}/`;
    if (await RNFS.exists(unzipPath)) {
      await RNFS.unlink(unzipPath);
    }
    await RNFS.mkdir(unzipPath);
    await unzip(filePath, unzipPath);

    const rootFiles = await RNFS.readDir(unzipPath);
    const files =
      rootFiles.length === 1 && rootFiles[0].isDirectory()
        ? await RNFS.readDir(rootFiles[0].path)
        : rootFiles;

    const binFile = files.find(f => f.name.endsWith('.bin'));
    if (!binFile) {
      throw new FirmwareUpdateError(
        'This ZIP does not contain a firmware image.',
      );
    }

    return { binaryPath: binFile.path, unzipPath };
  };

  /**
   * Read the MCUboot header out of an image already on disk.
   *
   * @param binaryPath - Signed image, extracted from whatever carried it.
   * @returns The image's version and signing key fingerprint.
   * @throws If the file is not a firmware image the app can send.
   */
  private readImageHeader = async (binaryPath: string): Promise<McubootImage> =>
    parseMcubootImage(
      Buffer.from(await RNFS.readFile(binaryPath, 'base64'), 'base64'),
    );

  /**
   * Read the header of the firmware the user picked, without touching a board.
   *
   * @param filePath - A `.bin`, or a `.zip` holding exactly one.
   * @returns The image's version and signing key fingerprint.
   * @throws If the file is not a firmware image the app can send.
   */
  readFirmwareImage = async (filePath: string): Promise<McubootImage> => {
    const { binaryPath, unzipPath } = await this.extractFirmwareBinary(
      filePath,
    );

    try {
      return await this.readImageHeader(binaryPath);
    } finally {
      this.safeDelete(unzipPath);
    }
  };

  /**
   * Push an image into the board's spare slot and mark it for installation.
   *
   * @param deviceId - Board to write to, connected.
   * @param binaryPath - Signed image to send.
   * @param onProgress - Called with the percentage uploaded so far.
   * @param log - Sink for the protocol trace.
   * @returns The hash the board reports for the image it stored, which is how
   *   the same image is recognised again after the reboot.
   * @throws If the board rejects a chunk, stores nothing, or refuses to mark
   *   the image for installation.
   */
  private uploadAndConfirm = async (
    deviceId: string,
    binaryPath: string,
    onProgress: ((percent: number) => void) | undefined,
    log: (msg: string) => void,
  ): Promise<string> => {
    await this.requestLargeMtu(deviceId);
    const sub = this.subscribeToFotaNotifications(deviceId);

    try {
      // Matches nRF Connect: let the subscription settle before the first write.
      await new Promise(r => setTimeout(r, 500));

      const params = await this.querySmpParams(deviceId);
      log(`buf_size=${params.bufSize} buf_count=${params.bufCount}`);
      log(`Bootloader: ${await this.queryBootloaderInfo(deviceId)}`);
      log(`Boot mode: ${await this.queryBootMode(deviceId)}`);
      log(`Images: ${JSON.stringify(await this.sendImageList(deviceId))}`);

      await this.sendFirmwareFile(deviceId, binaryPath, onProgress);
      log('Upload complete');

      const updatedList = await this.sendImageList(deviceId);
      const staged = updatedList?.images?.find((img: any) => img.slot === 1);
      if (!staged?.hash) {
        throw new FirmwareUpdateError(
          'The board did not store the firmware that was sent.',
        );
      }

      const confirmed = await this.confirmFirmware(
        deviceId,
        Buffer.from(staged.hash).toString('base64'),
      );
      if (confirmed?.rc) {
        if (__DEV__) {
          console.log('[FOTA]', `Confirm refused, rc=${confirmed.rc}`);
        }
        throw new FirmwareUpdateError(
          'The board would not install the firmware it stored. Try sending ' +
            'it again.',
        );
      }
      log('Image confirmed');

      return Buffer.from(staged.hash).toString('hex');
    } finally {
      this.removeSubscription(sub);
    }
  };

  /**
   * Collect the ids of every AkidaTag board advertising right now.
   *
   * @param timeoutMs - How long to keep scanning before answering.
   */
  private scanForAkidaTagIds = (timeoutMs: number): Promise<string[]> =>
    new Promise(resolve => {
      const ids: string[] = [];
      const stopScan = this.scanDevices(
        device => {
          if (!ids.includes(device.id)) {
            ids.push(device.id);
          }
        },
        null,
        timeoutMs,
      );

      setTimeout(() => {
        stopScan();
        resolve(ids);
      }, timeoutMs);
    });

  /**
   * Ask a connected board for its permanent hardware serial.
   *
   * @param deviceId - Board to ask, connected.
   * @param timeoutMs - How long to wait for the device-info burst.
   * @returns The serial in lowercase hex, or null if the burst never lands.
   */
  private readDeviceSerial = (
    deviceId: string,
    timeoutMs: number,
  ): Promise<string | null> =>
    new Promise(resolve => {
      let subscription: Subscription | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let settled = false;

      const finish = (serial: string | null) => {
        if (settled) {
          return;
        }
        settled = true;
        if (timer) {
          clearTimeout(timer);
        }
        if (subscription) {
          this.removeSubscription(subscription);
        }
        resolve(serial);
      };

      timer = setTimeout(() => finish(null), timeoutMs);

      this.subscribeToNotifications(deviceId, data => {
        if (data.type === 'DEVICE_INFO' && data.data.serial) {
          finish(String(data.data.serial).trim().toLowerCase());
        }
      })
        .then(sub => {
          subscription = sub;
          return this.sendCommand(deviceId, BleCommand.DEVICE_INFO);
        })
        .catch(() => finish(null));
    });

  /**
   * Connect to a candidate board and check it is the one that was updated.
   *
   * Every AkidaTag advertises the same chip id, so the serial from the
   * device-info burst is the only thing that tells two boards apart.
   *
   * @param deviceId - Candidate to try.
   * @param expectedSerial - Serial the board reported before the update.
   * @param connectTimeoutMs - How long to let the connect request hang before
   *   giving up on this candidate.
   * @returns `same` with the connection left open, `no-serial` after
   *   disconnecting a board that answered but never said which board it is,
   *   and `not-it` for everything else, which is a board that named itself as
   *   a different one and a candidate that could not be connected to alike.
   *   Only `no-serial` says anything about the board being looked for: a board
   *   that gave a different serial is simply some other AkidaTag in the room.
   */
  private isSameBoard = async (
    deviceId: string,
    expectedSerial: string,
    connectTimeoutMs: number,
  ): Promise<'same' | 'no-serial' | 'not-it'> => {
    try {
      await this.connectDevice(deviceId, connectTimeoutMs);
    } catch {
      // The MTU request and service discovery both run on a link that is
      // already up, and both reject on a board still settling after a reboot,
      // so a failure here can leave one open.
      try {
        await this.bleManager.cancelDeviceConnection(deviceId);
      } catch {}
      return 'not-it';
    }

    const serial = await this.readDeviceSerial(
      deviceId,
      SERIAL_READ_TIMEOUT_MS,
    );
    if (serial === expectedSerial) {
      return 'same';
    }

    try {
      await this.bleManager.cancelDeviceConnection(deviceId);
    } catch {}
    return serial === null ? 'no-serial' : 'not-it';
  };

  /**
   * Get back to the board that was just updated, once it has restarted.
   *
   * Its Bluetooth address can change across a reboot, so the previous id is
   * only tried first and a scan finds the board again when that fails.
   *
   * @param previousDeviceId - Id the board had before it restarted.
   * @param expectedSerial - Serial the board reported before the update.
   * @param log - Sink for the protocol trace.
   * @returns The id to talk to, or null with whether a board answered and
   *   would not say which board it is, which is what separates the board
   *   never coming back from it coming back nameless. Meeting some other
   *   AkidaTag counts as neither.
   */
  private reconnectToBoard = async (
    previousDeviceId: string,
    expectedSerial: string,
    log: (msg: string) => void,
  ): Promise<{ deviceId: string | null; foundBoardWithoutSerial: boolean }> => {
    const deadline = Date.now() + REBOOT_RECONNECT_TIMEOUT_MS;
    let triedPreviousId = false;
    let foundBoardWithoutSerial = false;

    while (Date.now() < deadline) {
      const candidates = triedPreviousId
        ? await this.scanForAkidaTagIds(REBOOT_SCAN_WINDOW_MS)
        : [previousDeviceId];
      triedPreviousId = true;

      for (const candidate of candidates) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
          break;
        }

        const attemptTimeoutMs = Math.min(
          REBOOT_CONNECT_TIMEOUT_MS,
          remainingMs,
        );
        const verdict = await this.isSameBoard(
          candidate,
          expectedSerial,
          attemptTimeoutMs,
        );
        if (verdict === 'same') {
          log(`Reconnected to ${candidate}`);
          return { deviceId: candidate, foundBoardWithoutSerial: false };
        }
        foundBoardWithoutSerial =
          foundBoardWithoutSerial || verdict === 'no-serial';
      }
    }

    log('Board did not come back within the reconnect timeout');
    return { deviceId: null, foundBoardWithoutSerial };
  };

  /**
   * Ask a rebooted board which images it holds.
   *
   * @param deviceId - Board to ask, connected.
   * @returns The running image's version and hash, and every slot's hash with
   *   the pending flag off its trailer, or null if the board would not answer.
   *   The hashes are the board's own, so they compare directly with the one it
   *   reported for the staged image before the reboot.
   */
  private readImages = async (
    deviceId: string,
  ): Promise<{
    version: string | null;
    hash: string;
    slots: { hash: string; pending: boolean }[];
  } | null> => {
    this.pendingFotaResponse = null;
    this.fotaResolver = null;
    this.fotaRejecter = null;

    await this.requestLargeMtu(deviceId);
    const sub = this.subscribeToFotaNotifications(deviceId);

    try {
      await new Promise(r => setTimeout(r, 500));
      await this.querySmpParams(deviceId);

      const images: any[] = (await this.sendImageList(deviceId))?.images ?? [];
      const active =
        images.find(img => img.active) ?? images.find(img => img.slot === 0);

      if (!active?.hash) {
        return null;
      }

      return {
        version: typeof active.version === 'string' ? active.version : null,
        hash: Buffer.from(active.hash).toString('hex'),
        slots: images
          .filter(img => img.hash)
          .map(img => ({
            hash: Buffer.from(img.hash).toString('hex'),
            pending: img.pending === true,
          })),
      };
    } catch {
      return null;
    } finally {
      this.removeSubscription(sub);
    }
  };

  /**
   * Decide whether an update took, by asking the board what it is running.
   *
   * @param previousDeviceId - Id the board had before it restarted.
   * @param expectedSerial - Serial the board reported before the update, or
   *   null if it never reported one.
   * @param stagedHash - Hash the board reported for the image it stored.
   * @param sentVersion - Version of the image that was sent.
   * @param log - Sink for the protocol trace.
   * @returns Installed when the board came back running the staged image,
   *   rejected when it booted back onto its previous one, not-restarted when
   *   it never rebooted at all, and unconfirmed when it could not be reached,
   *   could not be recognised, would not answer, or cannot be told apart from
   *   any other AkidaTag in range, alongside the id the board answered on. A
   *   board that did come back is left connected, since the app has just
   *   proved it is the same one.
   */
  private verifyFirmwareInstalled = async (
    previousDeviceId: string,
    expectedSerial: string | null,
    stagedHash: string,
    sentVersion: string,
    log: (msg: string) => void,
  ): Promise<{
    outcome: FirmwareUpdateOutcome;
    reconnectedDeviceId: string | null;
  }> => {
    if (!expectedSerial) {
      log('Board reported no serial, so it cannot be recognised after reboot');
      return {
        outcome: { status: 'unconfirmed', reason: 'unidentifiable' },
        reconnectedDeviceId: null,
      };
    }

    const { deviceId, foundBoardWithoutSerial } = await this.reconnectToBoard(
      previousDeviceId,
      expectedSerial,
      log,
    );
    if (!deviceId) {
      return {
        outcome: {
          status: 'unconfirmed',
          reason: foundBoardWithoutSerial ? 'unrecognised' : 'unreachable',
        },
        reconnectedDeviceId: null,
      };
    }

    const images = await this.readImages(deviceId);
    if (!images) {
      log('Board would not report its running image');
      return {
        outcome: { status: 'unconfirmed', reason: 'unanswered' },
        reconnectedDeviceId: deviceId,
      };
    }

    if (images.hash === stagedHash) {
      log('Board is running the firmware that was sent');
      return {
        outcome: { status: 'installed', version: sentVersion },
        reconnectedDeviceId: deviceId,
      };
    }

    // An image the board has not booted to yet still has the trailer that
    // marks it pending; refusing one scrambles that trailer. The image being
    // there proves nothing either way, since a refused one can stay put.
    const staged = images.slots.find(slot => slot.hash === stagedHash);
    if (staged?.pending) {
      log('Board never restarted, and still holds the firmware that was sent');
      return {
        outcome: { status: 'not-restarted', runningVersion: images.version },
        reconnectedDeviceId: deviceId,
      };
    }

    log('Board came back on its previous firmware');
    return {
      outcome: { status: 'rejected', runningVersion: images.version },
      reconnectedDeviceId: deviceId,
    };
  };

  /**
   * Send firmware to a board, restart it, and report what the board actually
   * did with it.
   *
   * The transfer succeeding proves nothing: an image signed with a key the
   * board does not trust is refused by the bootloader on the next boot, with
   * no error on any channel the phone can see. So the board is asked, once it
   * is back up, which firmware it is running.
   *
   * @param deviceId - Board to update, connected.
   * @param filePath - A `.bin`, or a `.zip` holding exactly one.
   * @param options - `expectedSerial` is the board's permanent serial, used to
   *   recognise it again after the reboot; without it the outcome is
   *   unconfirmed, because no other identifier survives the reboot.
   * @returns Whether the firmware installed, was refused, or could not be
   *   checked. The board never says why it refused an image.
   * @throws If another update is already running, or the transfer itself
   *   fails. Only a `FirmwareUpdateError` carries a message written here;
   *   anything else is whatever the Bluetooth stack raised, and the offsets
   *   and result codes behind either go to the development log.
   */
  async performFota(
    deviceId: string,
    filePath: string,
    options: {
      expectedSerial?: string | null;
      onProgress?: (percent: number) => void;
      onPhase?: (phase: FirmwareUpdatePhase) => void;
    } = {},
  ): Promise<FirmwareUpdateOutcome> {
    if (this.otaInProgress) {
      if (__DEV__) {
        console.log('[FOTA]', `Busy with a ${this.otaInProgress} update`);
      }
      const boardName = nameForDevice(useBleStore.getState().connectedDevice);
      throw new FirmwareUpdateError(
        `Your ${boardName} is busy with another update. Wait for that one ` +
          'to finish and try again.',
      );
    }

    this.otaInProgress = 'firmware';
    this.fotaSeq = 0;
    this.smpBuffer = null;
    this.smpExpectedLength = 0;
    this.pendingFotaResponse = null;
    this.fotaResolver = null;
    this.fotaRejecter = null;

    const log = (msg: string) => {
      if (__DEV__) console.log('[FOTA]', msg);
    };

    this.cleanupMonitors();
    BleConnectionHelper.setFotaRunning(true);

    let unzipPath = '';

    try {
      const extracted = await this.extractFirmwareBinary(filePath);
      unzipPath = extracted.unzipPath;

      const image = await this.readImageHeader(extracted.binaryPath);
      log(`Sending firmware ${image.version}`);

      const stagedHash = await this.uploadAndConfirm(
        deviceId,
        extracted.binaryPath,
        options.onProgress,
        log,
      );

      options.onPhase?.('restarting');
      BleConnectionHelper.setExpectedReboot(true);
      await this.resetDevice(deviceId);
      log('Reset command sent');

      try {
        await this.bleManager.cancelDeviceConnection(deviceId);
      } catch {}
      await new Promise(r => setTimeout(r, REBOOT_SETTLE_MS));

      options.onPhase?.('checking');
      const verified = await this.verifyFirmwareInstalled(
        deviceId,
        options.expectedSerial ?? null,
        stagedHash,
        image.version,
        log,
      );

      // Published once the update is over rather than from inside the
      // reconnect loop: the screens react to this, and a board that changed
      // address mid-verification would restart the app's device session on
      // top of the SMP exchange still running here.
      if (verified.reconnectedDeviceId) {
        BleConnectionHelper.updateConnectedDeviceId(
          verified.reconnectedDeviceId,
        );
      }

      return verified.outcome;
    } catch (error) {
      // The transfer tore the board's monitors down, and only the endings that
      // reconnect put them back. A transfer that threw with the board still
      // there has to go through the same publish, or the app holds on to a
      // connection it can no longer hear anything over.
      if (await this.isDeviceConnected(deviceId)) {
        BleConnectionHelper.updateConnectedDeviceId(deviceId);
      }
      throw error;
    } finally {
      this.otaInProgress = null;
      this.fotaResolver = null;
      this.fotaRejecter = null;
      this.smpBuffer = null;
      this.smpExpectedLength = 0;
      this.fotaSeq = 0;
      this.pendingFotaResponse = null;
      BleConnectionHelper.setFotaRunning(false);
      this.safeDelete(unzipPath);
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                         MODEL TRANSFER UUID CONFIG                          */
  /* -------------------------------------------------------------------------- */

  // Service
  private modelServiceUUID = 'f000aa00-0451-4000-b000-000000000000';

  // Characteristics
  private fileTransferUUID = 'f000aa01-0451-4000-b000-000000000000'; // FILE_TRANSFER_CHAR_UUID, offset-prefixed data writes
  private statusUUID = 'f000aa02-0451-4000-b000-000000000000'; // STATUS_CHAR_UUID, notify, 14 bytes
  private ctrlUUID = 'f000aa03-0451-4000-b000-000000000000'; // CTRL_CHAR_UUID, START and ABORT
  private appUUID = 'f000aa05-0451-4000-b000-000000000000'; // APP_CHAR_UUID             — app index
  private crcUUID = 'f000aa06-0451-4000-b000-000000000000'; // FILE_CRC_CHAR_UUID        — combined/data CRC32 (32-bit LE)
  private modelInputShapeUUID = 'f000aa08-0451-4000-b000-000000000000'; // MODEL_INPUT_SHAPE_CHAR_UUID
  private modelOutputShapeUUID = 'f000aa09-0451-4000-b000-000000000000'; // MODEL_OUTPUT_SHAPE_CHAR_UUID
  private flashAddressUUID = 'f000aa0a-0451-4000-b000-000000000000'; // FLASH_ADDRESS_CHAR_UUID   — target flash address (32-bit LE)
  private totalLengthUUID = 'f000aa0b-0451-4000-b000-000000000000'; // TOTAL_LENGTH_CHAR_UUID    — info+data combined bytes (32-bit LE)
  private isEdgeLearnedUUID = 'f000aa0c-0451-4000-b000-000000000000'; // IS_EDGE_LEARNED_CHAR_UUID — 1 = edge-learned model (32-bit LE)
  private numEdgeClassesUUID = 'f000aa0d-0451-4000-b000-000000000000'; // NUM_EDGE_CLASSES_CHAR_UUID — neurons<<16 | classes (32-bit LE)
  private fsNameUUID = 'f000aa0e-0451-4000-b000-000000000000'; // FS_NAME_CHAR_UUID         — LittleFS metadata path (UTF-8)
  private mfccFsUUID = 'f000aa0f-0451-4000-b000-000000000000'; // MFCC_FS_CHAR_UUID         — MFCC normalisation scalar (IEEE-754 float bits, 32-bit LE)
  private silenceClassUUID = 'f000aa10-0451-4000-b000-000000000000'; // SILENCE_CLASS_CHAR_UUID   — silence class output index (32-bit LE)
  private unknownClassUUID = 'f000aa11-0451-4000-b000-000000000000'; // UNKNOWN_CLASS_CHAR_UUID   — unknown class output index (32-bit LE)
  private inferenceModeUUID = 'f000aa12-0451-4000-b000-000000000000'; // INFERENCE_MODE_CHAR_UUID  — 0=sync, 1=async (32-bit LE)

  // Edge-learning service/chars
  private edgeCommandServiceUUID = 'f000bb11-0111-9000-c000-000000000000';
  private edgeCharUUID = 'f000bb10-0111-9000-c000-000000000000';
  private edgeAckUUID = 'f000bb12-0111-9000-c000-000000000000';

  // ACK codes
  private readonly ACK_EDGE_COMMAND = 0xa7;
  private readonly ACK_EDGE_START_COMMAND = 0xa6;

  // Max dims/name length — must match firmware model_meta_t layout
  private readonly MAX_DIMS = 3;
  private readonly MAX_FS_NAME_LEN = 64;
  private detectAppIndex = (): number => 0;

  // Model OTA Updation
  private modelStatusSubscription: Subscription | null = null;
  private modelStatusQueue: TransferStatus[] = [];
  private modelStatusWaiter: ((status: TransferStatus | null) => void) | null =
    null;
  private cancelModelTransfer = false;

  /**
   * CRC32 over raw file bytes.
   *   crc = 0xFFFFFFFF → zlib.crc32(chunks, crc) → crc ^ 0xFFFFFFFF
   */
  private computeDataCRC32 = async (filePath: string): Promise<number> => {
    const base64 = await RNFS.readFile(filePath, 'base64');
    const buffer = Buffer.from(base64, 'base64');
    let crc = 0xffffffff;
    crc = CRC32.buf(buffer, crc);
    return (crc ^ 0xffffffff) >>> 0;
  };

  /**
   * CRC32 over header fields + info file bytes.
   *
   * Mirrors the firmware's model_info_hdr_crc32 in file_transfer.c: the CRC
   * covers sizeof(model_meta_t) - offsetof(model_meta_t, total_length) = 124
   * header bytes followed by the raw program_info bytes.
   *
   * Struct layout (15 × uint32_t little-endian, in model_meta_t field order):
   *   total_length, input_shape[3], output_shape[3],
   *   flash_address, is_edge_learned, num_edge_classes, info_data_len,
   *   mfcc_fs_bits, silence_class, unknown_class, inference_mode
   *   + model_name[64] null-padded  = 60 + 64 = 124 bytes
   * Then the raw info binary bytes are appended to the CRC stream.
   */
  private computeCombinedCRC32 = async (
    totalLength: number,
    inputShape: number[],
    outputShape: number[],
    flashAddress: number,
    isEdgeLearned: boolean,
    numEdgeClasses: number,
    infoFilePath: string,
    modelName: string = '',
    mfccFsBits: number = 0,
    silenceClass: number = 0,
    unknownClass: number = 0,
    inferenceMode: number = 0,
  ): Promise<number> => {
    const infoStat = await RNFS.stat(infoFilePath);
    const infoDataLen = infoStat.size;

    // Zero-pad shapes to MAX_DIMS (3) elements each
    const inPad = [
      ...inputShape,
      ...Array(this.MAX_DIMS - inputShape.length).fill(0),
    ];
    const outPad = [
      ...outputShape,
      ...Array(this.MAX_DIMS - outputShape.length).fill(0),
    ];

    // Pack: total_length, input_shape[3], output_shape[3],
    //       flash_address, is_edge_learned, num_edge_classes, info_data_len,
    //       mfcc_fs_bits, silence_class, unknown_class, inference_mode
    // = 1 + 3 + 3 + 8 = 15 uint32_t values -> 60 bytes
    const numFields = 1 + this.MAX_DIMS + this.MAX_DIMS + 8;
    const headerBuf = Buffer.alloc(numFields * 4);
    const fields = [
      totalLength,
      ...inPad,
      ...outPad,
      flashAddress,
      isEdgeLearned ? 1 : 0,
      numEdgeClasses,
      infoDataLen,
      mfccFsBits,
      silenceClass,
      unknownClass,
      inferenceMode,
    ];
    fields.forEach((v, i) => headerBuf.writeUInt32LE(v >>> 0, i * 4));

    // Append model_name null-padded to MAX_FS_NAME_LEN (64) bytes
    const nameBytes = Buffer.alloc(this.MAX_FS_NAME_LEN, 0);
    const encoded = Buffer.from(modelName, 'utf8').slice(
      0,
      this.MAX_FS_NAME_LEN,
    );
    encoded.copy(nameBytes);

    const fullHeader = Buffer.concat([headerBuf, nameBytes]);

    // CRC over header then over raw info file bytes
    let crc = 0xffffffff;
    crc = CRC32.buf(fullHeader, crc);
    const infoBase64 = await RNFS.readFile(infoFilePath, 'base64');
    const infoBuffer = Buffer.from(infoBase64, 'base64');
    crc = CRC32.buf(infoBuffer, crc);

    return (crc ^ 0xffffffff) >>> 0;
  };

  /**
   * Listen for the board's transfer status notifications.
   *
   * The board refuses to begin a transfer it has no way to report on, so this
   * has to be in place, and settled, before the first START.
   *
   * @param deviceId - Board to listen to.
   */
  private subscribeToTransferStatus = async (
    deviceId: string,
  ): Promise<void> => {
    this.modelStatusQueue = [];
    this.modelStatusSubscription =
      this.bleManager.monitorCharacteristicForDevice(
        deviceId,
        this.modelServiceUUID,
        this.statusUUID,
        (error, characteristic) => {
          if (error || !characteristic?.value) return;

          const status = parseTransferStatus(
            Buffer.from(characteristic.value, 'base64'),
          );
          if (status) this.deliverTransferStatus(status);
        },
      );

    await new Promise(resolve =>
      setTimeout(resolve, STATUS_SUBSCRIBE_SETTLE_MS),
    );
  };

  /**
   * Hand a status to whoever is waiting for one, or hold it until someone is.
   *
   * A notification can land between a write completing and the transfer
   * starting to wait for its answer, so an unclaimed status is queued rather
   * than dropped. The queue is emptied at every START, which is the only point
   * where a status from before can no longer mean anything.
   */
  private deliverTransferStatus = (status: TransferStatus): void => {
    const waiter = this.modelStatusWaiter;

    if (!waiter) {
      this.modelStatusQueue.push(status);
      return;
    }

    this.modelStatusWaiter = null;
    waiter(status);
  };

  /**
   * Wait for the board's next word on the transfer.
   *
   * @param timeoutMs - How long the board has to answer.
   * @returns The status, or null if the board did not answer in time or the
   *   user stopped the update while the app was waiting.
   */
  private awaitTransferStatus = (
    timeoutMs: number,
  ): Promise<TransferStatus | null> =>
    new Promise(resolve => {
      const queued = this.modelStatusQueue.shift();
      if (queued) {
        resolve(queued);
        return;
      }

      const timer = setTimeout(() => {
        this.modelStatusWaiter = null;
        resolve(null);
      }, timeoutMs);

      this.modelStatusWaiter = status => {
        clearTimeout(timer);
        resolve(status);
      };
    });

  /**
   * Send a model package to the board and report what became of it.
   *
   * The ZIP must hold `info.yaml`, `<name>_program_info.bin` and
   * `<name>_program_data.bin`. A session is the metadata characteristics, then
   * the info file, then the data file, in that order on one connection: the
   * data half carries no metadata of its own and inherits the session's.
   *
   * The board's last word on the data file being stored is not the update
   * having worked. Programming the Akida chip and proving the model runs takes
   * several seconds more, and `onInstalling` is where that begins.
   *
   * @param deviceId - Board to send to.
   * @param zipPath - The model package on this phone.
   * @param options - Callbacks following the transfer: `onProgress` reports
   *   0..100 over the data file, `onInstalling` fires once every byte is
   *   stored and the board starts installing.
   * @returns Whether the model is running on the board, or is merely stored on
   *   it.
   * @throws ModelUpdateError if the package cannot be read, or the board
   *   refuses the transfer, or it stops answering.
   */
  async sendModelZip(
    deviceId: string,
    zipPath: string,
    options?: {
      onProgress?: (percent: number) => void;
      onInstalling?: () => void;
    },
  ): Promise<ModelUpdateOutcome> {
    if (this.otaInProgress) {
      throw new Error(
        `Cannot start model update — ${this.otaInProgress} update in progress`,
      );
    }
    this.otaInProgress = 'model';
    this.cancelModelTransfer = false;

    const unzipPath = `${RNFS.TemporaryDirectoryPath}/model_${Date.now()}/`;

    try {
      const model = await this.readModelPackage(zipPath, unzipPath);

      await this.requestLargeMtu(deviceId);
      await this.subscribeToTransferStatus(deviceId);

      try {
        await this.writeSessionMetadata(deviceId, model);
        await this.transferModelFile(
          deviceId,
          TRANSFER_TYPE_INFO,
          model.infoBytes,
        );

        await this.writeU32LE(deviceId, this.crcUUID, model.dataCrc);
        await this.transferModelFile(
          deviceId,
          TRANSFER_TYPE_DATA,
          model.dataBytes,
          options?.onProgress,
        );
      } catch (error: unknown) {
        await this.abandonModelTransfer(deviceId);
        throw error;
      }

      options?.onInstalling?.();
      return await this.awaitModelInstallation();
    } finally {
      this.otaInProgress = null;
      this.modelStatusSubscription?.remove();
      this.modelStatusSubscription = null;
      this.modelStatusWaiter = null;
      this.modelStatusQueue = [];
      this.safeDelete(unzipPath);
    }
  }

  /**
   * Unpack a model package and read everything the board will be told about it.
   *
   * @param zipPath - The package the user picked.
   * @param unzipPath - Scratch directory to unpack into.
   * @returns The two binaries and the metadata that describes them.
   * @throws ModelUpdateError if the package is not a model package.
   */
  private readModelPackage = async (
    zipPath: string,
    unzipPath: string,
  ): Promise<ModelPackage> => {
    if (await RNFS.exists(unzipPath)) await RNFS.unlink(unzipPath);
    await RNFS.mkdir(unzipPath);
    await unzip(zipPath, unzipPath);

    const rootFiles = await RNFS.readDir(unzipPath);
    const files =
      rootFiles.length === 1 && rootFiles[0].isDirectory()
        ? await RNFS.readDir(rootFiles[0].path)
        : rootFiles;

    const infoYamlFile = files.find(f => f.name === 'info.yaml');
    const dataBinFile = files.find(
      f => f.name.endsWith('_program_data.bin') || f.name.endsWith('_data.bin'),
    );
    const infoBinFile = files.find(
      f => f.name.endsWith('_program_info.bin') || f.name.endsWith('_info.bin'),
    );

    if (!infoYamlFile || !dataBinFile || !infoBinFile) {
      throw new ModelUpdateError(
        'This package is missing one of the three files a model is made of.',
        false,
      );
    }

    const yamlContent = await RNFS.readFile(infoYamlFile.path, 'utf8');
    const meta: any = yaml.load(yamlContent);

    const inputShape: number[] = meta?.input_shape ?? [];
    const outputShape: number[] = meta?.output_shape ?? [];
    const rawAddr = meta?.flash_address ?? '0x1000';
    const flashAddress: number =
      typeof rawAddr === 'string' ? parseInt(rawAddr, 16) : Number(rawAddr);
    const modelName: string = String(meta?.app ?? meta?.model_name ?? '');

    // The firmware refuses to run a KWS model whose mfcc_fs is missing, so
    // this is written for every model rather than only for a KWS one.
    const mfccFsBuf = Buffer.alloc(4);
    mfccFsBuf.writeFloatLE(Number(meta?.mfcc_fs ?? 0));
    const mfccFsBits: number = mfccFsBuf.readUInt32LE(0);

    const elMeta = meta?.edge_learning ?? {};
    const neuronsPerClass: number = Number(elMeta?.num_neurons ?? 1);
    const numClasses: number = Number(elMeta?.num_el_classes ?? 0);

    const infoBytes = await this.readFileBytes(infoBinFile.path);
    const dataBytes = await this.readFileBytes(dataBinFile.path);
    const totalLength = infoBytes.length + dataBytes.length;

    // The firmware takes the model name from the text after the last slash.
    const fsNamePrefix = infoBinFile.name
      .replace('_program_info.bin', '')
      .replace('_info.bin', '');

    const model: ModelPackage = {
      fsName: `/model_meta/${fsNamePrefix}`,
      infoBytes,
      dataBytes,
      totalLength,
      inputShape,
      outputShape,
      flashAddress,
      isEdgeLearned: Boolean(elMeta?.enabled ?? false),
      // Upper 16 bits are the neurons per class, lower 16 the class count.
      packedClasses: ((neuronsPerClass & 0xffff) << 16) | (numClasses & 0xffff),
      mfccFsBits,
      silenceClass: Number(meta?.silence_class ?? 0),
      unknownClass: Number(meta?.unknown_class ?? 0),
      inferenceMode:
        String(meta?.inference_mode ?? 'sync').toLowerCase() === 'async'
          ? 1
          : 0,
      infoCrc: 0,
      dataCrc: await this.computeDataCRC32(dataBinFile.path),
    };

    model.infoCrc = await this.computeCombinedCRC32(
      model.totalLength,
      model.inputShape,
      model.outputShape,
      model.flashAddress,
      model.isEdgeLearned,
      model.packedClasses,
      infoBinFile.path,
      modelName,
      model.mfccFsBits,
      model.silenceClass,
      model.unknownClass,
      model.inferenceMode,
    );

    return model;
  };

  /**
   * Describe the model to the board, before asking it to take any of it.
   *
   * Every field here is copied into the header the board stores and is covered
   * by the CRC that goes with it, so a value written after the transfer has
   * begun would be stored but not accounted for, and the board would reject
   * the whole thing without saying which field did it.
   */
  private writeSessionMetadata = async (
    deviceId: string,
    model: ModelPackage,
  ): Promise<void> => {
    await this.writeU8(deviceId, this.appUUID, this.detectAppIndex());

    await this.bleManager.writeCharacteristicWithResponseForDevice(
      deviceId,
      this.modelServiceUUID,
      this.fsNameUUID,
      Buffer.from(model.fsName, 'utf8').toString('base64'),
    );

    await this.writeU32LE(deviceId, this.totalLengthUUID, model.totalLength);
    await this.writeShape(deviceId, this.modelInputShapeUUID, model.inputShape);
    await this.writeShape(
      deviceId,
      this.modelOutputShapeUUID,
      model.outputShape,
    );
    await this.writeU32LE(deviceId, this.flashAddressUUID, model.flashAddress);
    await this.writeU32LE(
      deviceId,
      this.isEdgeLearnedUUID,
      model.isEdgeLearned ? 1 : 0,
    );
    await this.writeU32LE(
      deviceId,
      this.numEdgeClassesUUID,
      model.packedClasses,
    );
    await this.writeU32LE(deviceId, this.mfccFsUUID, model.mfccFsBits);
    await this.writeU32LE(deviceId, this.silenceClassUUID, model.silenceClass);
    await this.writeU32LE(deviceId, this.unknownClassUUID, model.unknownClass);
    await this.writeU32LE(
      deviceId,
      this.inferenceModeUUID,
      model.inferenceMode,
    );
    await this.writeU32LE(deviceId, this.crcUUID, model.infoCrc);
  };
  /**
   * Send one half of a model, INFO or DATA, and see it committed.
   *
   * The board takes the file a block at a time and says, after each one, which
   * byte it expects next. That number is the app's own offset if nothing has
   * gone astray, so it is checked rather than trusted: it is what turns a
   * mistake on either side into a clear error instead of a corrupted model.
   *
   * @param deviceId - Board to send to.
   * @param transferType - TRANSFER_TYPE_INFO or TRANSFER_TYPE_DATA.
   * @param bytes - The whole file for this half.
   * @param onProgress - Called with 0..100 as the bytes go out.
   * @throws ModelUpdateError if the board refuses the transfer, stops
   *   answering, or disagrees about how far the transfer has got.
   */
  private transferModelFile = async (
    deviceId: string,
    transferType: number,
    bytes: Buffer,
    onProgress?: (percent: number) => void,
  ): Promise<void> => {
    // From the moment the board is asked to begin the data half it deletes the
    // record naming the model it had, so any failure past here leaves it with
    // nothing to run.
    const boardHasNoModel = transferType === TRANSFER_TYPE_DATA;

    this.modelStatusQueue = [];
    await this.writeModelControl(
      deviceId,
      buildStartFrame(transferType, bytes.length),
    );

    const armed = await this.awaitTransferStatus(START_STATUS_TIMEOUT_MS);
    this.throwIfStopped(boardHasNoModel);
    if (!armed) {
      throw new ModelUpdateError(BOARD_WENT_QUIET, boardHasNoModel);
    }
    if (armed.result !== TransferResult.Ok) {
      throw new ModelUpdateError(
        describeTransferFailure(armed.result),
        boardHasNoModel,
      );
    }

    const blockSize = armed.blockSize;
    if (blockSize <= 0) {
      throw new ModelUpdateError(
        'The board asked for the model in blocks of no size at all.',
        boardHasNoModel,
      );
    }

    const payloadLimit = this.negotiatedMTU - 3 - DATA_OFFSET_BYTES;
    let offset = 0;

    if (__DEV__) {
      console.log(
        `[MODEL] ${bytes.length} bytes in blocks of ${blockSize}, ` +
          `${payloadLimit} per write at MTU ${this.negotiatedMTU}`,
      );
    }

    while (offset < bytes.length) {
      // A write may not cross a block boundary: that is what makes the
      // position the board reports a number the app already knows.
      const blockEnd = Math.min(
        (Math.floor(offset / blockSize) + 1) * blockSize,
        bytes.length,
      );

      while (offset < blockEnd) {
        this.throwIfStopped(boardHasNoModel);
        const end = Math.min(offset + payloadLimit, blockEnd);
        await this.writeModelChunk(
          deviceId,
          offset,
          bytes.subarray(offset, end),
        );
        offset = end;
        onProgress?.((offset / bytes.length) * 100);
      }

      const isLastBlock = offset === bytes.length;
      const status = await this.awaitTransferStatus(
        isLastBlock ? LAST_BLOCK_STATUS_TIMEOUT_MS : BLOCK_STATUS_TIMEOUT_MS,
      );

      this.throwIfStopped(boardHasNoModel);
      if (!status) {
        throw new ModelUpdateError(BOARD_WENT_QUIET, boardHasNoModel);
      }
      if (
        status.result !== TransferResult.Ok &&
        status.result !== TransferResult.Done
      ) {
        throw new ModelUpdateError(
          describeTransferFailure(status.result),
          boardHasNoModel,
        );
      }
      if (status.position !== offset) {
        throw new ModelUpdateError(
          'The app and the board disagree about how much of the model has arrived.',
          boardHasNoModel,
        );
      }
      if (isLastBlock && status.result !== TransferResult.Done) {
        throw new ModelUpdateError(
          'The board took the whole model without ever calling it complete.',
          boardHasNoModel,
        );
      }
    }
  };

  /**
   * Wait for the board to say whether the model it stored actually runs.
   *
   * A board that never answers is reported exactly as one that answered that
   * the model would not start: the transfer itself is finished either way, and
   * nothing about the silence says the model is running.
   */
  private awaitModelInstallation = async (): Promise<ModelUpdateOutcome> => {
    const status = await this.awaitTransferStatus(INSTALL_STATUS_TIMEOUT_MS);
    return status?.result === TransferResult.Ready
      ? 'installed'
      : 'not-running';
  };

  /**
   * Tell the board to drop whatever it was holding, and forget its answer.
   *
   * Safe at any point, including when no transfer is in progress, so a failing
   * transfer can always end this way rather than leaving the board armed.
   */
  private abandonModelTransfer = async (deviceId: string): Promise<void> => {
    try {
      await this.writeModelControl(deviceId, buildAbortFrame());
      await this.awaitTransferStatus(START_STATUS_TIMEOUT_MS);
    } catch {
      // The link is often already gone by the time a transfer fails, and
      // nothing is left to clean up on a board that cannot be reached.
    }
  };

  /**
   * End the transfer if the user has stopped it.
   *
   * @throws ModelUpdateError naming the stop, so the transfer unwinds and its
   *   caller can abandon the transfer on the board.
   */
  private throwIfStopped = (boardHasNoModel: boolean): void => {
    if (this.cancelModelTransfer) {
      throw new ModelUpdateError('The update was stopped.', boardHasNoModel);
    }
  };

  /**
   * Write one piece of the file, prefixed with where in the file it belongs.
   *
   * Android writes without a response, which is several times faster and is
   * safe here precisely because every write carries its offset: one that goes
   * missing is caught by the next status rather than corrupting flash. iOS
   * writes with one, because Core Bluetooth drops an unacknowledged write when
   * its buffer is full and nothing in this library waits for it to drain.
   */
  private writeModelChunk = async (
    deviceId: string,
    offset: number,
    payload: Buffer,
  ): Promise<void> => {
    const frame = buildDataFrame(offset, payload).toString('base64');

    if (Platform.OS === 'ios') {
      await this.bleManager.writeCharacteristicWithResponseForDevice(
        deviceId,
        this.modelServiceUUID,
        this.fileTransferUUID,
        frame,
      );
      return;
    }

    await this.bleManager.writeCharacteristicWithoutResponseForDevice(
      deviceId,
      this.modelServiceUUID,
      this.fileTransferUUID,
      frame,
    );
  };

  /** Write a START or ABORT frame to the board's control characteristic. */
  private writeModelControl = async (
    deviceId: string,
    frame: Buffer,
  ): Promise<void> => {
    await this.bleManager.writeCharacteristicWithResponseForDevice(
      deviceId,
      this.modelServiceUUID,
      this.ctrlUUID,
      frame.toString('base64'),
    );
  };

  /** Read a whole file into memory. */
  private readFileBytes = async (filePath: string): Promise<Buffer> =>
    Buffer.from(await RNFS.readFile(filePath, 'base64'), 'base64');

  /**
   * Write a model shape, one 32-bit dimension per element.
   *
   * A shape the package did not give is not written at all, leaving the board
   * to keep whatever the session already set.
   */
  private writeShape = async (
    deviceId: string,
    charUUID: string,
    dimensions: number[],
  ): Promise<void> => {
    if (dimensions.length === 0) return;

    const packed = Buffer.alloc(dimensions.length * 4);
    dimensions.forEach((value, index) =>
      packed.writeUInt32LE(value >>> 0, index * 4),
    );

    await this.bleManager.writeCharacteristicWithResponseForDevice(
      deviceId,
      this.modelServiceUUID,
      charUUID,
      packed.toString('base64'),
    );
  };

  // ── Tiny write helpers (keep call-sites clean) ──

  private writeU8 = async (
    deviceId: string,
    charUUID: string,
    value: number,
  ): Promise<void> => {
    await this.bleManager.writeCharacteristicWithResponseForDevice(
      deviceId,
      this.modelServiceUUID,
      charUUID,
      Buffer.from([value & 0xff]).toString('base64'),
    );
  };

  private writeU32LE = async (
    deviceId: string,
    charUUID: string,
    value: number,
  ): Promise<void> => {
    const buf = Buffer.alloc(4);
    buf.writeUInt32LE(value >>> 0, 0);
    await this.bleManager.writeCharacteristicWithResponseForDevice(
      deviceId,
      this.modelServiceUUID,
      charUUID,
      buf.toString('base64'),
    );
  };

  /**
   * Stop the model transfer that is running.
   *
   * The transfer notices at its next chunk, or straight away if it is waiting
   * on the board, and tells the board to abandon what it has. A stopped
   * transfer cannot be picked up again: starting over sends every byte.
   */
  public stopModelTransfer = () => {
    this.cancelModelTransfer = true;

    const waiter = this.modelStatusWaiter;
    this.modelStatusWaiter = null;
    waiter?.(null);
  };

  public getAckEdgeMode() {
    return this.ACK_EDGE_COMMAND;
  }

  public getAckEdgeStartMode() {
    return this.ACK_EDGE_START_COMMAND;
  }

  /* ===============================
   Send Edge Command (0/1/2/3)
   =============================== */

  private edgeAckResolver: (() => void) | null = null;

  private waitForEdgeAck = (timeoutMs = 10000): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.edgeAckResolver === settle) {
          this.edgeAckResolver = null;
        }
        reject(new Error('Edge ACK timeout'));
      }, timeoutMs);

      const settle = () => {
        clearTimeout(timeout);
        resolve();
      };

      this.edgeAckResolver = settle;
    });
  };

  subscribeToEdgeLearningAck = (
    deviceId: string,
    callback: (ack: number) => void,
  ) => {
    const edgeSubscription = this.bleManager.monitorCharacteristicForDevice(
      deviceId,
      this.edgeCommandServiceUUID,
      this.edgeAckUUID,
      (error, characteristic) => {
        if (error) {
          const msg = error?.message ?? '';
          // console.log('[EDGE ACK] monitor error:', msg);

          if (
            msg.includes('disconnected') ||
            msg.includes('cancelled') ||
            msg.includes('Device is not connected')
          ) {
            return;
          }

          return;
        }

        if (!characteristic?.value) return;

        const ack = Buffer.from(characteristic.value, 'base64')[0];

        if (
          ack === this.ACK_EDGE_COMMAND ||
          ack === this.ACK_EDGE_START_COMMAND
        ) {
          callback(ack);
          this.edgeAckResolver?.();
          this.edgeAckResolver = null;
        }
      },
    );
    this.monitorSubscriptions.push(edgeSubscription);
    return edgeSubscription;
  };

  async sendEdgeCommand(deviceId: string, value: number) {
    try {
      const connected = await this.isDeviceConnected(deviceId);

      if (!connected) {
        throw new Error('Device disconnected');
      }

      const buffer = Buffer.from([value]);

      await this.bleManager.writeCharacteristicWithResponseForDevice(
        deviceId,
        this.edgeCommandServiceUUID,
        this.edgeCharUUID,
        buffer.toString('base64'),
      );

      // console.log('[EDGE] Command sent:', value);

      // wait only for learning command
      if (value === 1) {
        // console.log('[EDGE] Waiting for learning ACK...');
        await this.waitForEdgeAck();
        // console.log('[EDGE] Learning completed');
      }
    } catch (error: any) {
      // console.log('[EDGE] Command failed:', error?.message || error);

      // propagate error to UI
      throw new Error(error?.message || 'Failed to send edge command');
    }
  }

  private safeDelete = async (path?: string) => {
    if (!path) return;

    try {
      const exists = await RNFS.exists(path);
      if (!exists) return;

      await RNFS.unlink(path);
    } catch (e) {
      if (__DEV__) console.warn('Delete failed:', e);
    }
  };
}

export default new BleService();
