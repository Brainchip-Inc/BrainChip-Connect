import { decode, Encoder } from 'cbor-x';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';
import RNFS from 'react-native-fs';
import { BleData } from '../../types/bleData';
import { BleCommand } from './bleCommands';
import { parseBleMessage } from './bleParser';
import { buildCommand } from './buildCommand';
import BleConnectionHelper from '../../app/utils/BleConnectionHelper';
import CRC32 from 'crc-32';

const DEFAULT_SCAN_TIMEOUT_MS = 15000;

class BleService {
  private bleManager: BleManager;
  private stateSubscription: Subscription | null = null;

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
  private disconnectSubscriptions: Map<string, Subscription> = new Map();

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

        // Skip devices that have no name or serviceUUIDs
        if (!device.name || !device.serviceUUIDs) {
          return;
        }

        // **Important**: Here we filter the devices explicitly
        if (serviceUUIDs && serviceUUIDs.length > 0) {
          // Ensure device.serviceUUIDs is not null or undefined
          if (device.serviceUUIDs && device.serviceUUIDs.length > 0) {
            // Check if the device has one of the provided serviceUUIDs
            const deviceHasServiceUUID = device.serviceUUIDs.some(serviceUUID =>
              serviceUUIDs.includes(serviceUUID),
            );

            // If the device does not have any matching serviceUUIDs, skip it
            if (!deviceHasServiceUUID) {
              return;
            }
          } else {
            return; // Skip device if it doesn't advertise any serviceUUIDs
          }
        }

        if (device) {
          onDeviceFound(device);
        }
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
  connectDevice = async (
    deviceId: string,
    onDisconnected?: () => void,
  ): Promise<Device> => {
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
    const subscription = this.bleManager.onDeviceDisconnected(
      deviceId,
      (error, device) => {
        if (error) {
          return;
        }

        // Cleanup subscription
        this.disconnectSubscriptions.get(deviceId)?.remove();
        this.disconnectSubscriptions.delete(deviceId);

        onDisconnected();
      },
    );

    this.disconnectSubscriptions.set(deviceId, subscription);
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
  sendCommand = async (deviceId: string, command: BleCommand | String) => {
    try {
      const connected = await this.isDeviceConnected(deviceId);
      if (!connected) {
        Alert.alert('Device Disconnected');
        return;
      }
      const updatedCommand = buildCommand(command);
      // Convert the string into a buffer with UTF-8 encoding
      const bufferCommand = Buffer.from(updatedCommand, 'utf-8');

      // Write the buffer to the BLE characteristic
      await this.bleManager.writeCharacteristicWithoutResponseForDevice(
        deviceId,
        this.serviceUUID,
        this.rxUUID,
        bufferCommand.toString('base64'),
      );

      // console.log('Command sent successfully.');
    } catch (error) {
      // console.error('Error sending command:', error);
    }
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
          // console.error('Notification error:', error);
          return;
        }

        if (!characteristic?.value) return;

        // Decode Base64 to string
        const decoded = Buffer.from(characteristic.value, 'base64').toString(
          'utf-8',
        );

        // Parse BLE message
        const parsed = parseBleMessage(decoded) as BleData;

        // Pass parsed data to callback
        onData(parsed);
      },
    );

    return {
      remove: () => subscription.remove(),
    };
  };

  /**
   * Clean up BLE manager resources. Call when the app is shutting down.
   */
  destroy = () => {
    this.stateSubscription?.remove();
    this.stateSubscription = null;
    this.bleManager.destroy();
  };

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
  private smpExpectedLength = 0; // renamed — avoids clash with model transfer

  /* ── Subscribe to FOTA notifications ── */

  subscribeToFotaNotifications = (deviceId: string): Subscription => {
    return this.bleManager.monitorCharacteristicForDevice(
      deviceId,
      this.fotaServiceUUID,
      this.fotaCharUUID,
      (error, characteristic) => {
        if (error) {
          const msg = String(error?.message ?? '');

          // 🔥 Always ignore disconnect during reboot
          if (
            msg.includes('disconnected') ||
            msg.includes('GATT') ||
            msg.includes('Device is not connected') ||
            msg.includes('Operation was cancelled')
          ) {
            console.log('[FOTA] Disconnect during reboot (expected)');
            return;
          }
          if (this.fotaRejecter) {
            const rej = this.fotaRejecter;
            this.fotaResolver = null;
            this.fotaRejecter = null;
            rej(new Error(error.message));
          }
          return;
        }

        if (!characteristic?.value) return;

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
            console.log('[FOTA] fragment too short, dropping');
            return;
          }
          const payloadLen = chunk.readUInt16BE(2);
          this.smpExpectedLength = 8 + payloadLen;
          this.smpBuffer = Buffer.from(chunk);
        } else {
          this.smpBuffer = Buffer.concat([this.smpBuffer, chunk]);
        }

        if (this.smpBuffer.length < this.smpExpectedLength) {
          console.log(
            `[FOTA] reassembling ${this.smpBuffer.length}/${this.smpExpectedLength}`,
          );
          return;
        }

        // Full frame received
        const fullFrame = this.smpBuffer.slice(0, this.smpExpectedLength);
        this.smpBuffer = null;
        this.smpExpectedLength = 0;

        // Log header fields
        const op = fullFrame[0];
        const group = fullFrame.readUInt16BE(4);
        const seq = fullFrame[6];
        const cmd = fullFrame[7];

        const payloadBytes = fullFrame.slice(8);
        let decoded: any = {};

        if (payloadBytes.length > 0) {
          try {
            decoded = decode(payloadBytes);
          } catch (e) {
            console.log(
              '[FOTA] CBOR decode failed:',
              e,
              '| raw:',
              payloadBytes.toString('hex'),
            );
          }
        }

        if (this.fotaResolver) {
          const resolve = this.fotaResolver;
          this.fotaResolver = null;
          this.fotaRejecter = null;
          resolve(decoded);
        }
      },
    );
  };

  /* ── Wait for one FOTA response ── */

  private waitForFotaResponse(timeoutMs = 15000): Promise<any> {
    return new Promise((resolve, reject) => {
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
   *   0x0800000100000008A0 → Version:1 Op:0 Cmd:8  (bootloader query)
   *   0x0A0000310001ED00…  → Version:1 Op:2 Cmd:0  (confirm)
   *   0x0A0000010000EE05A0 → Version:1 Op:2 Cmd:5  (reset)
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
   * cbor-x encodes Uint8Array as CBOR byte string (major type 2).
   * If you pass a Buffer, some cbor-x versions encode it as an array
   * of numbers (major type 4) — which MCUboot rejects as "status" error.
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
   * build smp packet
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

    // ✅ FIX 2: convert Buffer → Uint8Array for CBOR byte strings
    const cborBody = this.prepareCborBody(body);

    const encoder = new Encoder({
      useRecords: false,
      structuredClone: false,
      tagUint8Array: false, // 🔥 CRITICAL FIX
    });

    const payload = Buffer.from(encoder.encode(cborBody));
    // const payload = Buffer.from(encode(cborBody));
    const packet = this.buildSmpPacket(op, group, command, payload, version);

    const responsePromise = this.waitForFotaResponse(timeoutMs);

    await this.bleManager.writeCharacteristicWithResponseForDevice(
      deviceId,
      this.fotaServiceUUID,
      this.fotaCharUUID,
      packet.toString('base64'),
    );

    return responsePromise;
  }

  /* ── Step 1: SMP params — v0 header, MUST be first ──
   *
   * Log sends: 0x000000010000FF06A0
   *   byte[0]=0x00 → version=0, op=0
   *   seq=0xFF, cmd=6, payload=0xA0 (empty CBOR map)
   * Response: {"buf_size":2475,"buf_count":4}
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
    header.writeUInt8(0xff, 6); // seq = 0xFF (matches log exactly)
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
   */
  async sendFirmwareFile(
    deviceId: string,
    filePath: string,
    onProgress?: (percent: number) => void,
  ): Promise<void> {
    const firstChunkDataMax = 400;
    const chunkDataMax = 450;

    const fileBuffer = Buffer.from(
      await RNFS.readFile(filePath, 'base64'),
      'base64',
    );
    const totalSize = fileBuffer.length;

    let offset = 0;
    const t0 = Date.now();

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

      const elapsed = (Date.now() - t0) / 1000;
      const speed = elapsed > 0 ? (offset / 1024 / elapsed).toFixed(1) : '?';

      await new Promise(r => setTimeout(r, 10));
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
    // Reset reassembly
    this.smpBuffer = null;
    this.smpExpectedLength = 0;

    const payload = Buffer.from(
      new Encoder({
        useRecords: false,
        structuredClone: false,
        tagUint8Array: false,
      }).encode({}),
    );

    const packet = this.buildSmpPacket(2, 0, 5, payload, 1);

    // 🔥 IMPORTANT: create response promise BEFORE write
    const responsePromise = this.waitForFotaResponse(5000);

    await this.bleManager.writeCharacteristicWithResponseForDevice(
      deviceId,
      this.fotaServiceUUID,
      this.fotaCharUUID,
      packet.toString('base64'),
    );

    try {
      const response = await responsePromise;
      console.log('[FOTA] Reset ACK:', response);
    } catch (e) {
      console.log('[FOTA] No reset ACK (device rebooted too fast)');
    }
  }

  /* ── Full FOTA flow ──
   *
   * ✅ USE THIS in downloadFile() — replace the manual step calls:
   *
   *   // Stop UART
   *   useBleCommandStore.getState().stopNotifications();
   *
   *   // Run FOTA
   *   await bleService.performFota(deviceId, filePath, setProgress);
   *
   *   setInstalledBuild(build);
   *   setInstallingId(null);
   */

  private async requestFotaMtu(deviceId: string): Promise<number> {
    try {
      const device = await this.bleManager.requestMTUForDevice(deviceId, 498);

      const mtu = device.mtu ?? 23;

      this.negotiatedMTU = mtu;
      return mtu;
    } catch (e) {
      this.negotiatedMTU = 247; // safe fallback
      return this.negotiatedMTU;
    }
  }

  async performFota(
    deviceId: string,
    filePath: string,
    onProgress?: (percent: number) => void,
    onLog?: (msg: string) => void,
  ): Promise<void> {
    const log = (msg: string) => {
      console.log('[FOTA]', msg);
      onLog?.(msg);
    };

    // 1️⃣ Request high MTU FIRST
    await this.requestFotaMtu(deviceId);

    // 2️⃣ Then subscribe to notifications
    const sub = this.subscribeToFotaNotifications(deviceId);

    // Wait for subscription to stabilise (matches nRF Connect wait(300))
    await new Promise(r => setTimeout(r, 300));

    try {
      // 2. SMP params — v0 handshake, MUST be before anything else
      const params = await this.querySmpParams(deviceId);

      // 3. Bootloader info
      const bootloader = await this.queryBootloaderInfo(deviceId);

      // 4. Boot mode
      const mode = await this.queryBootMode(deviceId);

      // 5. List images
      const imageList = await this.sendImageList(deviceId);

      // 6. Upload firmware
      await this.sendFirmwareFile(deviceId, filePath, onProgress);

      // 7. Get updated image list for slot 1 hash
      const updatedList = await this.sendImageList(deviceId);
      const slot1 = updatedList?.images?.find((img: any) => img.slot === 1);
      if (!slot1?.hash) throw new Error('Slot 1 not found after upload');

      const hashBase64 = Buffer.from(slot1.hash).toString('base64');

      // 8. Confirm
      await this.confirmFirmware(deviceId, hashBase64);

      // 9. Reset
      await this.resetDevice(deviceId);

      // Give device time to start reboot
      await new Promise(r => setTimeout(r, 400));

      sub.remove();

      this.fotaResolver = null;
      this.fotaRejecter = null;
      this.smpBuffer = null;
      this.smpExpectedLength = 0;

      console.log('[FOTA] Reset complete — device rebooting');
      return;
    } catch (error: any) {
      console.error('[FOTA ERROR]', error);
      throw new Error(error?.message || 'FOTA failed');
    }
  }

  /* -------------------------------------------------------------------------- */
  /*                         MODEL TRANSFER UUID CONFIG                          */
  /* -------------------------------------------------------------------------- */

  private modelServiceUUID = 'f000aa00-0451-4000-b000-000000000000';
  private fileTransferUUID = 'f000aa01-0451-4000-b000-000000000000';
  private ackUUID = 'f000aa02-0451-4000-b000-000000000000';
  private ctrlUUID = 'f000aa03-0451-4000-b000-000000000000';
  private fileSizeUUID = 'f000aa04-0451-4000-b000-000000000000';
  private appUUID = 'f000aa05-0451-4000-b000-000000000000';
  private crcUUID = 'f000aa06-0451-4000-b000-000000000000';

  private readonly ACK_FLASH_ERASE_DONE = 0xee;
  private readonly ACK_FLASH_WRITE_DONE = 0xcc;
  private readonly BUFFER_SIZE = 102236;

  //Model OTA Updation

  private ackResolver: (() => void) | null = null;

  private computeCRC32 = async (filePath: string): Promise<number> => {
    const base64 = await RNFS.readFile(filePath, 'base64');
    const buffer = Buffer.from(base64, 'base64');

    // Initial CRC value matches Python
    let crc = 0xffffffff;

    // Update CRC in chunks
    crc = CRC32.buf(buffer, crc);

    // Final XOR to match Python
    return (crc ^ 0xffffffff) >>> 0;
  };

  private detectAppIndex = (filePath: string): number => {
    const name = filePath.toLowerCase();

    if (name.includes('mnist')) return 0;
    if (name.includes('kws')) return 1;

    throw new Error("Filename must contain 'mnist' or 'kws'");
  };

  // private waitForAck = (timeoutMs = 5000): Promise<void> => {
  //   return new Promise((resolve, reject) => {
  //     this.ackResolver = resolve;
  //     setTimeout(() => reject(new Error('ACK timeout')), timeoutMs);
  //   });
  // };
  private waitForAck = (timeoutMs = 5000): Promise<void> => {
    return new Promise((resolve, reject) => {
      this.ackResolver = resolve;

      const timeout = setTimeout(() => {
        this.ackResolver = null;
        reject(new Error('ACK timeout'));
      }, timeoutMs);
    });
  };

  subscribeToModelAck = (deviceId: string, callback: (ack: number) => void) => {
    return this.bleManager.monitorCharacteristicForDevice(
      deviceId,
      this.modelServiceUUID,
      this.ackUUID,
      (error, characteristic) => {
        if (error) {
          // console.error('[ACK] Monitor error:', error);
          return;
        }

        if (!characteristic?.value) return;

        const ack = Buffer.from(characteristic.value, 'base64')[0];

        // console.log('[ACK]', ack);

        if (ack === this.ACK_FLASH_ERASE_DONE) {
          // console.log('ACK_FLASH_ERASE_DONE');
          callback(ack);
        }

        if (ack === this.ACK_FLASH_WRITE_DONE) {
          // console.log('ACK_FLASH_WRITE_DONE');
          callback(ack);
          this.ackResolver?.();
          this.ackResolver = null;
        }
      },
    );
  };

  sendModelFile = async (
    deviceId: string,
    filePath: string,
    writeToSram = false,
    onProgress?: (percent: number) => void,
  ) => {
    try {
      const stat = await RNFS.stat(filePath);
      const fileSize = stat.size;

      const appIndex = this.detectAppIndex(filePath);

      // console.log('Selected APP:', appIndex === 0 ? 'MNIST' : 'KWS');

      await this.bleManager.writeCharacteristicWithResponseForDevice(
        deviceId,
        this.modelServiceUUID,
        this.appUUID,
        Buffer.from([appIndex]).toString('base64'),
      );

      const sizeBuf = Buffer.alloc(4);
      sizeBuf.writeUInt32LE(fileSize);

      await this.bleManager.writeCharacteristicWithResponseForDevice(
        deviceId,
        this.modelServiceUUID,
        this.fileSizeUUID,
        sizeBuf.toString('base64'),
      );

      const crc32 = await this.computeCRC32(filePath);
      // console.log('crc32', crc32);
      const crcBuf = Buffer.alloc(4);
      crcBuf.writeUInt32LE(crc32);

      await this.bleManager.writeCharacteristicWithResponseForDevice(
        deviceId,
        this.modelServiceUUID,
        this.crcUUID,
        crcBuf.toString('base64'),
      );

      // console.log(`CRC32 sent: 0x${crc32.toString(16)}`);

      const base64 = await RNFS.readFile(filePath, 'base64');
      const fileBuffer = Buffer.from(base64, 'base64');

      let sent = 0;
      let sinceLastAck = 0;
      const ackLimit = writeToSram ? this.BUFFER_SIZE : fileSize;
      // console.log('ackLimit', ackLimit);

      while (sent < fileBuffer.length) {
        const connected = await this.isDeviceConnected(deviceId);
        if (!connected) {
          throw new Error('Device disconnected during transfer');
        }
        const payloadSize = this.negotiatedMTU - 3;
        // console.log('payloadSize', payloadSize);
        const chunk = fileBuffer.slice(sent, sent + payloadSize);
        // console.log('chunk', chunk);
        await this.bleManager.writeCharacteristicWithoutResponseForDevice(
          deviceId,
          this.modelServiceUUID,
          this.fileTransferUUID,
          chunk.toString('base64'),
        );

        sent += chunk.length;
        sinceLastAck += chunk.length;

        onProgress?.((sent / fileSize) * 100);

        // console.log('ackLimit', ackLimit, 'sinceLastAck', sinceLastAck);
        if (sinceLastAck >= ackLimit) {
          // console.log('Waiting for ACK...');
          await this.waitForAck();
          sinceLastAck = 0;
        }

        await new Promise(r => setTimeout(r, 100));
      }

      // console.log('Model transfer complete');
    } catch (error) {
      // console.error('Model transfer failed:', error);
      Alert.alert('Transfer Failed', String(error));
      throw error;
    }
  };

  public getAckFlashErase() {
    return this.ACK_FLASH_ERASE_DONE;
  }

  public getAckFlashWrite() {
    return this.ACK_FLASH_WRITE_DONE;
  }
}

export default new BleService();
