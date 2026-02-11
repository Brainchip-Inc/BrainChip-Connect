import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';

const DEFAULT_SCAN_TIMEOUT_MS = 15000;

class BleService {
  private bleManager: BleManager;
  private stateSubscription: Subscription | null = null;

  // TODO: Replace with actual BrainChip device UUIDs from device documentation
  private SERVICE_UUID: string | null = null;
  private CHARACTERISTIC_UUID: string | null = null;

  constructor() {
    this.bleManager = new BleManager();
  }

  /**
   * Configure the service/characteristic UUIDs for device communication.
   * Must be called before getDeviceData().
   */
  setUUIDs = (serviceUUID: string, characteristicUUID: string) => {
    this.SERVICE_UUID = serviceUUID;
    this.CHARACTERISTIC_UUID = characteristicUUID;
  };

  /**
   * Check if Bluetooth is currently powered on.
   */
  isBluetoothEnabled = async (): Promise<boolean> => {
    try {
      const state = await this.bleManager.state();
      return state === State.PoweredOn;
    } catch (error) {
      return false;
    }
  };

  /**
   * Subscribe to Bluetooth adapter state changes (powered on/off, unauthorized, etc.)
   * Returns an unsubscribe function.
   */
  onBluetoothStateChange = (callback: (state: State) => void): (() => void) => {
    this.stateSubscription = this.bleManager.onStateChange((newState) => {
      callback(newState);
    }, true);

    return () => {
      this.stateSubscription?.remove();
      this.stateSubscription = null;
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
      } catch (error) {
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
  connectDevice = async (deviceId: string): Promise<Device> => {
    try {
      const device = await this.bleManager.connectToDevice(deviceId);
      await device.discoverAllServicesAndCharacteristics();
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
    } catch (error) {
      return false;
    }
  };

  /**
   * Get a list of currently connected devices (filtered by service UUIDs if provided).
   */
  getConnectedDevices = async (serviceUUIDs: string[] = []): Promise<Device[]> => {
    try {
      return await this.bleManager.connectedDevices(serviceUUIDs);
    } catch (error) {
      return [];
    }
  };

  /**
   * Read data from a BLE characteristic.
   * Requires setUUIDs() to be called first.
   */
  getDeviceData = async (deviceId: string): Promise<unknown> => {
    if (!this.SERVICE_UUID || !this.CHARACTERISTIC_UUID) {
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
        this.SERVICE_UUID,
        this.CHARACTERISTIC_UUID,
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
      const message = error instanceof Error ? error.message : 'Failed to read device data';
      throw new Error(message);
    }
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

  /**
   * Clean up BLE manager resources. Call when the app is shutting down.
   */
  destroy = () => {
    this.stateSubscription?.remove();
    this.stateSubscription = null;
    this.bleManager.destroy();
  };
}

export default new BleService();
