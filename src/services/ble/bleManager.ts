import { decode, Encoder } from 'cbor-x';
import CRC32 from 'crc-32';
import yaml from 'js-yaml';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';
import RNFS from 'react-native-fs';
import { unzip } from 'react-native-zip-archive';
import BleConnectionHelper from '../../app/utils/BleConnectionHelper';
import { BleData } from '../../types/bleData';
import {
  FirmwareUpdateOutcome,
  FirmwareUpdatePhase,
} from '../../types/firmwareUpdate';
import { McubootImage, parseMcubootImage } from '../firmware/mcubootImage';
import { isAkidaTagManufacturerData } from './akidaTagAdvertisement';
import { BleCommand } from './bleCommands';
import { parseBinaryFrame, parseBleMessage } from './bleParser';
import { buildCommand } from './buildCommand';

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

/** How long to wait for a board to answer with its hardware serial. */
const SERIAL_READ_TIMEOUT_MS = 6000;

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
   */
  connectDevice = async (deviceId: string): Promise<Device> => {
    try {
      const device = await this.bleManager.connectToDevice(deviceId);
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
        reject(new Error(`FOTA timeout after ${timeoutMs}ms`));
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
        throw new Error(`Upload error at offset ${offset}: rc=${response.rc}`);
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

  /* ──FOTA MTU REQUEST ──
   *
   */

  private async requestFotaMtu(deviceId: string): Promise<number> {
    try {
      const device = await this.bleManager.requestMTUForDevice(deviceId, 498);

      const mtu = device.mtu ?? 23;

      this.negotiatedMTU = mtu;
      return mtu;
    } catch {
      this.negotiatedMTU = 247; // safe fallback
      return this.negotiatedMTU;
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
      throw new Error('This ZIP does not contain a firmware image.');
    }

    return { binaryPath: binFile.path, unzipPath };
  };

  /**
   * Read the header of the firmware the user picked, without touching a board.
   *
   * @param filePath - A `.bin`, or a `.zip` holding exactly one.
   * @returns The image's version and signing key fingerprint.
   * @throws If the file is not AkidaTag firmware.
   */
  readFirmwareImage = async (filePath: string): Promise<McubootImage> => {
    const { binaryPath, unzipPath } = await this.extractFirmwareBinary(
      filePath,
    );

    try {
      return parseMcubootImage(
        Buffer.from(await RNFS.readFile(binaryPath, 'base64'), 'base64'),
      );
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
    await this.requestFotaMtu(deviceId);
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
        throw new Error('The board did not store the firmware that was sent.');
      }

      const confirmed = await this.confirmFirmware(
        deviceId,
        Buffer.from(staged.hash).toString('base64'),
      );
      if (confirmed?.rc) {
        throw new Error(
          `The board would not install the firmware, error ${confirmed.rc}.`,
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
   * @param expectedSerial - Serial the board reported before the update, or
   *   null to accept the first AkidaTag that answers.
   * @returns True with the connection left open; false after disconnecting.
   */
  private isSameBoard = async (
    deviceId: string,
    expectedSerial: string | null,
  ): Promise<boolean> => {
    try {
      await this.connectDevice(deviceId);
    } catch {
      return false;
    }

    if (!expectedSerial) {
      return true;
    }

    const serial = await this.readDeviceSerial(
      deviceId,
      SERIAL_READ_TIMEOUT_MS,
    );
    if (serial === expectedSerial) {
      return true;
    }

    try {
      await this.bleManager.cancelDeviceConnection(deviceId);
    } catch {}
    return false;
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
   * @returns The id to talk to, or null if the board never came back.
   */
  private reconnectToBoard = async (
    previousDeviceId: string,
    expectedSerial: string | null,
    log: (msg: string) => void,
  ): Promise<string | null> => {
    const deadline = Date.now() + REBOOT_RECONNECT_TIMEOUT_MS;
    let triedPreviousId = false;

    while (Date.now() < deadline) {
      const candidates = triedPreviousId
        ? await this.scanForAkidaTagIds(REBOOT_SCAN_WINDOW_MS)
        : [previousDeviceId];
      triedPreviousId = true;

      for (const candidate of candidates) {
        if (await this.isSameBoard(candidate, expectedSerial)) {
          log(`Reconnected to ${candidate}`);
          return candidate;
        }
      }
    }

    log('Board did not come back within the reconnect timeout');
    return null;
  };

  /**
   * Ask a rebooted board which image it is running.
   *
   * @param deviceId - Board to ask, connected.
   * @returns The running image's version and hash, or null if the board would
   *   not answer. The hash is the board's own, so it compares directly with
   *   the one it reported for the staged image before the reboot.
   */
  private readActiveImage = async (
    deviceId: string,
  ): Promise<{ version: string | null; hash: string } | null> => {
    this.pendingFotaResponse = null;
    this.fotaResolver = null;
    this.fotaRejecter = null;

    await this.requestFotaMtu(deviceId);
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
   * @param expectedSerial - Serial the board reported before the update.
   * @param stagedHash - Hash the board reported for the image it stored.
   * @param sentVersion - Version of the image that was sent.
   * @param log - Sink for the protocol trace.
   * @returns Installed when the board came back running the staged image,
   *   rejected when it came back running something else, and unconfirmed when
   *   it could not be reached or would not answer.
   */
  private verifyFirmwareInstalled = async (
    previousDeviceId: string,
    expectedSerial: string | null,
    stagedHash: string,
    sentVersion: string,
    log: (msg: string) => void,
  ): Promise<FirmwareUpdateOutcome> => {
    const deviceId = await this.reconnectToBoard(
      previousDeviceId,
      expectedSerial,
      log,
    );
    if (!deviceId) {
      return { status: 'unconfirmed' };
    }

    try {
      const active = await this.readActiveImage(deviceId);
      if (!active) {
        log('Board would not report its running image');
        return { status: 'unconfirmed' };
      }

      if (active.hash === stagedHash) {
        log('Board is running the firmware that was sent');
        return { status: 'installed', version: sentVersion };
      }

      log('Board came back on its previous firmware');
      return { status: 'rejected', runningVersion: active.version };
    } finally {
      try {
        await this.disconnectDevice(deviceId);
      } catch {}
    }
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
   *   recognise it again after the reboot; without it the first AkidaTag that
   *   answers is taken to be the same board.
   * @returns Whether the firmware installed, was refused, or could not be
   *   checked. The board never says why it refused an image.
   * @throws If another update is already running, or the transfer itself
   *   fails. Those messages are written to be shown to the user.
   */
  async performFota(
    deviceId: string,
    filePath: string,
    options: {
      expectedSerial?: string | null;
      onProgress?: (percent: number) => void;
      onPhase?: (phase: FirmwareUpdatePhase) => void;
      onLog?: (msg: string) => void;
    } = {},
  ): Promise<FirmwareUpdateOutcome> {
    if (this.otaInProgress) {
      throw new Error(
        `Cannot start firmware update: a ${this.otaInProgress} update is already in progress.`,
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
      options.onLog?.(msg);
    };

    this.cleanupMonitors();
    BleConnectionHelper.setFotaRunning(true);
    options.onPhase?.('sending');

    let unzipPath = '';

    try {
      const extracted = await this.extractFirmwareBinary(filePath);
      unzipPath = extracted.unzipPath;

      const image = parseMcubootImage(
        Buffer.from(
          await RNFS.readFile(extracted.binaryPath, 'base64'),
          'base64',
        ),
      );
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
      return await this.verifyFirmwareInstalled(
        deviceId,
        options.expectedSerial ?? null,
        stagedHash,
        image.version,
        log,
      );
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
  private fileTransferUUID = 'f000aa01-0451-4000-b000-000000000000'; // FILE_TRANSFER_CHAR_UUID  — write data chunks
  private ackUUID = 'f000aa02-0451-4000-b000-000000000000'; // ACK_CHAR_UUID            — notify
  private ctrlUUID = 'f000aa03-0451-4000-b000-000000000000'; // CTRL_CHAR_UUID           — control
  private fileSizeUUID = 'f000aa04-0451-4000-b000-000000000000'; // FILE_SIZE_CHAR_UUID       — this file's size (32-bit LE)
  private appUUID = 'f000aa05-0451-4000-b000-000000000000'; // APP_CHAR_UUID             — app index
  private crcUUID = 'f000aa06-0451-4000-b000-000000000000'; // FILE_CRC_CHAR_UUID        — combined/data CRC32 (32-bit LE)
  private transferTypeUUID = 'f000aa07-0451-4000-b000-000000000000'; // TRANSFER_TYPE_CHAR_UUID   — 0=INFO, 1=DATA
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

  // Transfer type bytes
  private readonly TRANSFER_TYPE_INFO = 0x00;
  private readonly TRANSFER_TYPE_DATA = 0x01;

  // ACK codes
  private readonly ACK_FLASH_ERASE_DONE = 0xee;
  private readonly ACK_FLASH_WRITE_DONE = 0xcc;
  private readonly ACK_CRC_FAIL = 0xbb;
  private readonly BUFFER_SIZE = 102236; // 419 * 244 chunks
  private readonly ACK_EDGE_COMMAND = 0xa7;
  private readonly ACK_EDGE_START_COMMAND = 0xa6;

  // Max dims/name length — must match firmware model_meta_t layout
  private readonly MAX_DIMS = 3;
  private readonly MAX_FS_NAME_LEN = 64;
  private detectAppIndex = (): number => 0;

  // Model OTA Updation
  private ackResolver: (() => void) | null = null;
  private cancelModelTransfer = false;
  private pendingAck: number | null = null;

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

  private waitForAck = (timeoutMs = 5000): Promise<void> => {
    return new Promise((resolve, reject) => {
      // ✅ if ACK already came, consume it instantly
      if (this.pendingAck !== null) {
        this.pendingAck = null;
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        this.ackResolver = null;
        reject(new Error('ACK timeout'));
      }, timeoutMs);

      this.ackResolver = () => {
        clearTimeout(timeout);
        this.ackResolver = null;
        resolve();
      };
    });
  };

  subscribeToModelAck = (deviceId: string, callback: (ack: number) => void) => {
    const modelsubscription = this.bleManager.monitorCharacteristicForDevice(
      deviceId,
      this.modelServiceUUID,
      this.ackUUID,
      (error, characteristic) => {
        if (error) {
          const msg = error?.message ?? '';
          // console.log('[MODEL ACK] monitor error:', msg);

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

        // console.log('[ACK]', ack);

        if (ack === this.ACK_FLASH_ERASE_DONE) {
          // console.log('ACK_FLASH_ERASE_DONE');
          callback(ack);
          // Erase done — unblock waitForAck so transfer can proceed
          if (this.ackResolver) {
            this.ackResolver?.();
            this.ackResolver = null;
          } else {
            this.pendingAck = ack;
          }
        }

        if (ack === this.ACK_FLASH_WRITE_DONE) {
          // console.log('ACK_FLASH_WRITE_DONE');
          callback(ack);
          if (this.ackResolver) {
            this.ackResolver?.();
            this.ackResolver = null;
          } else {
            this.pendingAck = ack;
          }
        }

        if (ack === this.ACK_CRC_FAIL) {
          // console.log('ACK_CRC_FAIL — peripheral rejected transfer');
          callback(ack);
          // Do not resolve — let waitForAck timeout so caller sees the failure
          this.ackResolver = null;
        }
      },
    );

    this.monitorSubscriptions.push(modelsubscription);
    return modelsubscription;
  };

  /**
   * Full model OTA transfer from a ZIP file.
   *
   *    *
   *  ZIP must contain:
   *    info.yaml              — model metadata
   *    <name>_program_info.bin — info binary
   *    <name>_program_data.bin — model data binary
   *
   *  Transfer sequence:
   *    1. Write APP index
   *    ── INFO transfer ──
   *    2. Set TRANSFER_TYPE = INFO (0x00)
   *    3. Write fs_name (UTF-8 string) — before the size write, so the firmware
   *       can build its LittleFS paths when the erase is triggered
   *    4. Write info file size → wait for ERASE ACK
   *    5. Write combined CRC32 (124-byte header + info bytes)
   *    6. Write total length (info + data)
   *    7. Write input shape (N × uint32 LE)
   *    8. Write output shape (N × uint32 LE)
   *    9. Write flash address (uint32 LE)
   *   10. Write is_edge_learned (uint32 LE)
   *   11. Write num_edge_classes packed as (neurons<<16 | classes) (uint32 LE)
   *   12. Write mfcc_fs as IEEE-754 float bits (uint32 LE)
   *   13. Write silence_class (uint32 LE)
   *   14. Write unknown_class (uint32 LE)
   *   15. Write inference_mode, 0=sync / 1=async (uint32 LE)
   *   16. Stream info chunks → wait for WRITE ACK per BUFFER_SIZE window
   *    ── DATA transfer ──
   *   17. Set TRANSFER_TYPE = DATA (0x01)
   *   18. Write data file size → wait for ERASE ACK
   *   19. Write data CRC32 (uint32 LE)
   *   20. Stream data chunks → wait for WRITE ACK per BUFFER_SIZE window
   */
  async sendModelZip(
    deviceId: string,
    zipPath: string,
    onProgress?: (p: number) => void,
  ): Promise<void> {
    if (this.otaInProgress) {
      throw new Error(
        `Cannot start model update — ${this.otaInProgress} update in progress`,
      );
    }
    this.otaInProgress = 'model';
    this.cancelModelTransfer = false;
    this.ackResolver = null;
    this.pendingAck = null;

    let unzipPath = '';

    try {
      // ── Unzip ──
      unzipPath = `${RNFS.TemporaryDirectoryPath}/model_${Date.now()}/`;
      // Remove old unzip folder if exists
      if (await RNFS.exists(unzipPath)) await RNFS.unlink(unzipPath);

      // Ensure folder exists
      await RNFS.mkdir(unzipPath);

      await unzip(zipPath, unzipPath);
      const rootFiles = await RNFS.readDir(unzipPath);

      let files = rootFiles;

      if (rootFiles.length === 1 && rootFiles[0].isDirectory()) {
        files = await RNFS.readDir(rootFiles[0].path);
      }
      if (__DEV__) console.log('files-models', files);

      const infoYamlFile = files.find(f => f.name === 'info.yaml');
      const dataBinFile = files.find(
        f =>
          f.name.endsWith('_program_data.bin') || f.name.endsWith('_data.bin'),
      );
      const infoBinFile = files.find(
        f =>
          f.name.endsWith('_program_info.bin') || f.name.endsWith('_info.bin'),
      );

      if (!infoYamlFile || !dataBinFile || !infoBinFile) {
        throw new Error(
          'Invalid ZIP: info.yaml, _program_info.bin or _program_data.bin missing',
        );
      }

      // ── Parse YAML ──
      const yamlContent = await RNFS.readFile(infoYamlFile.path, 'utf8');
      const meta: any = yaml.load(yamlContent);

      const inputShape: number[] = meta?.input_shape ?? [];
      const outputShape: number[] = meta?.output_shape ?? [];
      const rawAddr = meta?.flash_address ?? '0x1000';
      const flashAddress: number =
        typeof rawAddr === 'string' ? parseInt(rawAddr, 16) : Number(rawAddr);
      const modelName: string = String(meta?.app ?? meta?.model_name ?? '');

      // KWS runtime fields — the firmware refuses to run a KWS model whose
      // mfcc_fs is missing, so these are always written during INFO.
      const mfccFsBuf = Buffer.alloc(4);
      mfccFsBuf.writeFloatLE(Number(meta?.mfcc_fs ?? 0));
      const mfccFsBits: number = mfccFsBuf.readUInt32LE(0);
      const silenceClass: number = Number(meta?.silence_class ?? 0);
      const unknownClass: number = Number(meta?.unknown_class ?? 0);
      const inferenceMode: number =
        String(meta?.inference_mode ?? 'sync').toLowerCase() === 'async'
          ? 1
          : 0;

      // Edge-learning fields
      const elMeta = meta?.edge_learning ?? {};
      const isEdgeLearned: boolean = Boolean(elMeta?.enabled ?? false);
      const numClasses: number = Number(elMeta?.num_el_classes ?? 0);
      const neuronsPerClass: number = Number(elMeta?.num_neurons ?? 1);

      // packed num_edge_classes: upper 16 bits = neurons_per_class, lower 16 bits = num_classes
      // Pack: upper 16 bits = neurons_per_class, lower 16 bits = num_classes
      const packedClasses: number =
        ((neuronsPerClass & 0xffff) << 16) | (numClasses & 0xffff);

      // Derive fs_name: /model_meta/<prefix>
      const prefix = infoBinFile.name
        .replace('_program_info.bin', '')
        .replace('_info.bin', '');
      const fsName = `/model_meta/${prefix}`;

      // ── File sizes & CRCs ──
      const infoSize = (await RNFS.stat(infoBinFile.path)).size;
      const dataSize = (await RNFS.stat(dataBinFile.path)).size;
      const totalLength = infoSize + dataSize;

      const dataCRC = await this.computeDataCRC32(dataBinFile.path);

      const combinedCRC = await this.computeCombinedCRC32(
        totalLength,
        inputShape,
        outputShape,
        flashAddress,
        isEdgeLearned,
        packedClasses,
        infoBinFile.path,
        modelName,
        mfccFsBits,
        silenceClass,
        unknownClass,
        inferenceMode,
      );

      // ── Detect APP index ──
      const appIndex = this.detectAppIndex();
      if (__DEV__) console.log('appindex', appIndex);
      // =====================================================================
      // 1. Send APP index
      // =====================================================================
      await this.writeU8(deviceId, this.appUUID, appIndex);

      // =====================================================================
      // ── INFO transfer ──
      // =====================================================================

      // 2. Set transfer type = INFO
      await this.writeU8(
        deviceId,
        this.transferTypeUUID,
        this.TRANSFER_TYPE_INFO,
      );

      // 3. fs_name (UTF-8 string)
      if (__DEV__)
        console.log('🚀 ~ BleService ~ sendModelZip ~ fsName:', fsName);
      await this.bleManager.writeCharacteristicWithResponseForDevice(
        deviceId,
        this.modelServiceUUID,
        this.fsNameUUID,
        Buffer.from(fsName, 'utf8').toString('base64'),
      );

      // 4. Send info file size → triggers flash erase on firmware, wait for ERASE ACK
      await this.writeU32LE(deviceId, this.fileSizeUUID, infoSize);

      await this.waitForAck(10000); // erase can take a moment

      // 5. Combined CRC32 (header fields + info bytes)
      await this.writeU32LE(deviceId, this.crcUUID, combinedCRC);

      // 6. Total length (info + data)
      await this.writeU32LE(deviceId, this.totalLengthUUID, totalLength);
      if (__DEV__) console.log('length', totalLength);

      // 7. Input shape (N × uint32 LE)
      if (inputShape.length > 0) {
        const buf = Buffer.alloc(inputShape.length * 4);
        inputShape.forEach((v, i) => buf.writeUInt32LE(v >>> 0, i * 4));
        await this.bleManager.writeCharacteristicWithResponseForDevice(
          deviceId,
          this.modelServiceUUID,
          this.modelInputShapeUUID,
          buf.toString('base64'),
        );
      }
      if (__DEV__) console.log('inputshape', inputShape.length);

      // 8. Output shape (N × uint32 LE)
      if (outputShape.length > 0) {
        const buf = Buffer.alloc(outputShape.length * 4);
        outputShape.forEach((v, i) => buf.writeUInt32LE(v >>> 0, i * 4));
        await this.bleManager.writeCharacteristicWithResponseForDevice(
          deviceId,
          this.modelServiceUUID,
          this.modelOutputShapeUUID,
          buf.toString('base64'),
        );
      }
      if (__DEV__) console.log('outputShape', outputShape.length);

      // 9. Flash address
      await this.writeU32LE(deviceId, this.flashAddressUUID, flashAddress);

      if (__DEV__) console.log('flashAddress', flashAddress);

      // 10. is_edge_learned (always written — avoids a stale firmware value)
      await this.writeU32LE(
        deviceId,
        this.isEdgeLearnedUUID,
        isEdgeLearned ? 1 : 0,
      );

      if (__DEV__) console.log('isEdgeLearned', isEdgeLearned);

      // 11. num_edge_classes packed (always written — firmware reads it even for non-EL)
      await this.writeU32LE(deviceId, this.numEdgeClassesUUID, packedClasses);

      // 12. mfcc_fs as IEEE-754 float bits
      await this.writeU32LE(deviceId, this.mfccFsUUID, mfccFsBits);

      // 13. silence_class output index
      await this.writeU32LE(deviceId, this.silenceClassUUID, silenceClass);

      // 14. unknown_class output index
      await this.writeU32LE(deviceId, this.unknownClassUUID, unknownClass);

      // 15. inference_mode (0=sync, 1=async)
      await this.writeU32LE(deviceId, this.inferenceModeUUID, inferenceMode);

      if (__DEV__) console.log('Streaming start');

      // 16. Stream info binary chunks → wait for WRITE ACK
      await this.sendFileChunksWithAck(deviceId, infoBinFile.path);

      if (__DEV__) console.log('Streaming end');

      this.pendingAck = null;
      this.ackResolver = null;

      // =====================================================================
      // ── DATA transfer ──
      // =====================================================================

      // 17. Set transfer type = DATA
      await this.writeU8(
        deviceId,
        this.transferTypeUUID,
        this.TRANSFER_TYPE_DATA,
      );

      // 18. Send data file size → triggers flash erase, wait for ERASE ACK
      await this.writeU32LE(deviceId, this.fileSizeUUID, dataSize);
      await this.waitForAck(10000);

      // 19. Data CRC32
      await this.writeU32LE(deviceId, this.crcUUID, dataCRC);

      // 20. Stream data binary chunks → wait for WRITE ACK, report progress
      await this.sendFileChunksWithAck(deviceId, dataBinFile.path, onProgress);

      BleConnectionHelper.setExpectedReboot(true);
    } catch (e) {
      throw e;
    } finally {
      this.otaInProgress = null;
      this.ackResolver = null;
      this.pendingAck = null;
      this.safeDelete(unzipPath);
    }
  }

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
   * Stream file in MTU-sized chunks with ACK windowing.
   *
   *    *   - Sends chunks without waiting after each one
   *   - After every BUFFER_SIZE bytes waits for a WRITE ACK
   *   - Waits for a final WRITE ACK after the last chunk
   *   - Returns false (throws here) if ACK_CRC_FAIL is received
   */
  private sendFileChunksWithAck = async (
    deviceId: string,
    filePath: string,
    onProgress?: (p: number) => void,
  ): Promise<void> => {
    const base64 = await RNFS.readFile(filePath, 'base64');
    const buffer = Buffer.from(base64, 'base64');
    const total = buffer.length;

    let sent = 0;
    let sinceLastAck = 0;

    while (sent < total) {
      if (this.cancelModelTransfer) {
        throw new Error('Transfer cancelled');
      }
      const payloadSize = this.negotiatedMTU - 3;
      const chunk = buffer.slice(sent, sent + payloadSize);

      if (Platform.OS === 'ios') {
        await this.bleManager.writeCharacteristicWithResponseForDevice(
          deviceId,
          this.modelServiceUUID,
          this.fileTransferUUID,
          chunk.toString('base64'),
        );
      } else {
        await this.bleManager.writeCharacteristicWithoutResponseForDevice(
          deviceId,
          this.modelServiceUUID,
          this.fileTransferUUID,
          chunk.toString('base64'),
        );
      }

      sent += chunk.length;
      sinceLastAck += chunk.length;

      onProgress?.((sent / total) * 100);

      // Wait for WRITE ACK every BUFFER_SIZE bytes
      if (sinceLastAck >= this.BUFFER_SIZE) {
        await this.waitForAck(10000);
        sinceLastAck = 0;
      }

      await new Promise(r => setTimeout(r, 5));
    }

    // Final ACK for any remaining bytes
    if (sinceLastAck > 0) {
      await this.waitForAck(10000);
    }
  };

  public stopModelTransfer = () => {
    this.cancelModelTransfer = true;
  };

  public getAckFlashErase() {
    return this.ACK_FLASH_ERASE_DONE;
  }

  public getAckFlashWrite() {
    return this.ACK_FLASH_WRITE_DONE;
  }

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
