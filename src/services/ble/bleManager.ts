import { BleManager } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';

class BleService {
  private bleManager: BleManager;
  private SERVICE_UUID = 'YOUR_SERVICE_UUID';
  private CHARACTERISTIC_UUID = 'YOUR_CHARACTERISTIC_UUID';

  constructor() {
    this.bleManager = new BleManager();
  }

  // Check if Bluetooth is enabled
  isBluetoothEnabled = async (): Promise<boolean> => {
    try {
      const state = await this.bleManager.state();
      console.log('Bluetooth state:', state);
      return state === 'PoweredOn';
    } catch (error) {
      console.error('Error checking Bluetooth state', error);
      return false;
    }
  };

  // Request all required permissions (Bluetooth, Location, Notifications)
  requestAllPermissions = async (): Promise<{
    bluetooth: boolean;
    location: boolean;
    notifications: boolean;
  }> => {
    if (Platform.OS === 'android') {
      try {
        const androidVersion = Platform.Version;
        console.log('Android Version:', androidVersion);

        let bluetoothGranted = false;
        let locationGranted = false;
        let notificationsGranted = false;

        // Request Bluetooth permissions (Android 12+)
        if (androidVersion >= 31) {
          console.log('Requesting Bluetooth permissions for Android 12+...');

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
          console.log('Bluetooth Scan Permission:', bluetoothScanPermission);

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
          console.log(
            'Bluetooth Connect Permission:',
            bluetoothConnectPermission,
          );

          bluetoothGranted =
            bluetoothScanPermission === PermissionsAndroid.RESULTS.GRANTED &&
            bluetoothConnectPermission === PermissionsAndroid.RESULTS.GRANTED;
        } else {
          // For Android < 12, Bluetooth permissions are automatically granted
          bluetoothGranted = true;
        }

        // Request Location permission (required for BLE scanning on all Android versions)
        console.log('Requesting Location permission...');
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
        console.log('Location Permission:', locationPermission);
        locationGranted =
          locationPermission === PermissionsAndroid.RESULTS.GRANTED;

        // Request Notification permission (Android 13+)
        if (androidVersion >= 33) {
          console.log('Requesting Notification permission for Android 13+...');
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
          console.log('Notification Permission:', notificationPermission);
          notificationsGranted =
            notificationPermission === PermissionsAndroid.RESULTS.GRANTED;
        } else {
          // For Android < 13, notification permission is automatically granted
          notificationsGranted = true;
        }

        return {
          bluetooth: bluetoothGranted,
          location: locationGranted,
          notifications: notificationsGranted,
        };
      } catch (error) {
        console.error('Error requesting permissions:', error);
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

  // Legacy method for backward compatibility
  requestBluetoothPermission = async (): Promise<boolean> => {
    const permissions = await this.requestAllPermissions();
    return permissions.bluetooth && permissions.location;
  };

  // Scan for devices
  scanDevices = (onDeviceFound: (device: any) => void) => {
    return new Promise<void>((resolve, reject) => {
      console.log('Starting device scan...');

      this.bleManager.startDeviceScan(
        null, // Scan for all devices
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            console.error('Error while scanning:', error);
            reject(error);
            return;
          }

          if (device) {
            console.log('Device found:', device.name, device.id);
            onDeviceFound(device);
          }
        },
      );
    });
  };

  // Stop scanning for devices
  stopScan = () => {
    this.bleManager.stopDeviceScan();
    console.log('Scan stopped');
  };

  // Connect to a device
  connectDevice = async (deviceId: string) => {
    try {
      console.log('Connecting to device:', deviceId);
      const device = await this.bleManager.connectToDevice(deviceId);
      console.log('Device connected, discovering services...');
      await device.discoverAllServicesAndCharacteristics();
      console.log('Device connected successfully:', device.name);
      return device;
    } catch (error: any) {
      console.error('Connection error:', error);
      throw new Error(`Failed to connect to device: ${error.message}`);
    }
  };

  // Disconnect from a device
  disconnectDevice = async (deviceId: string) => {
    try {
      console.log('Disconnecting from device:', deviceId);
      await this.bleManager.cancelDeviceConnection(deviceId);
      console.log('Device disconnected successfully');
    } catch (error: any) {
      console.error('Disconnection error:', error);
      throw new Error(`Failed to disconnect from device: ${error.message}`);
    }
  };

  // Check if device is connected
  isDeviceConnected = async (deviceId: string): Promise<boolean> => {
    try {
      const isConnected = await this.bleManager.isDeviceConnected(deviceId);
      return isConnected;
    } catch (error) {
      console.error('Error checking device connection:', error);
      return false;
    }
  };

  // Get connected devices
  getConnectedDevices = async (serviceUUIDs: string[] = []): Promise<any[]> => {
    try {
      const devices = await this.bleManager.connectedDevices(serviceUUIDs);
      return devices;
    } catch (error) {
      console.error('Error getting connected devices:', error);
      return [];
    }
  };

  /* -------------------------------------------------------------------------- */
  /*                         🔥 COLLECT DEVICE DATA 🔥                           */
  /* -------------------------------------------------------------------------- */

  /**
   * Reads data from a BLE characteristic
   */
  getDeviceData = async (deviceId: string): Promise<any> => {
    try {
      const device = await this.bleManager.devices([deviceId]).then(d => d[0]);

      if (!device) {
        throw new Error('Device not found');
      }

      await device.discoverAllServicesAndCharacteristics();

      // 🔹 Direct read using known UUIDs
      const characteristic = await device.readCharacteristicForService(
        this.SERVICE_UUID,
        this.CHARACTERISTIC_UUID,
      );

      if (!characteristic?.value) {
        throw new Error('No data received from device');
      }

      // Decode Base64 value
      const decoded = Buffer.from(characteristic.value, 'base64').toString(
        'utf-8',
      );

      // Try JSON parse, fallback to raw string
      try {
        return JSON.parse(decoded);
      } catch {
        return {
          raw: decoded,
        };
      }
    } catch (error: any) {
      console.error('getDeviceData error:', error);
      throw new Error(error.message || 'Failed to read device data');
    }
  };

  /* -------------------------------------------------------------------------- */
  /*                 🔍 OPTIONAL: DISCOVER ALL CHARACTERISTICS                  */
  /* -------------------------------------------------------------------------- */

  /**
   * Use this if you DON'T know UUIDs yet
   */
  discoverAllCharacteristics = async (deviceId: string) => {
    const device = await this.bleManager.connectToDevice(deviceId);
    await device.discoverAllServicesAndCharacteristics();

    const services = await device.services();
    const result: any[] = [];

    for (const service of services) {
      const characteristics = await service.characteristics();
      result.push({
        serviceUUID: service.uuid,
        characteristics: characteristics.map(c => ({
          uuid: c.uuid,
          readable: c.isReadable,
          writable: c.isWritableWithResponse || c.isWritableWithoutResponse,
          notifiable: c.isNotifiable,
        })),
      });
    }

    return result;
  };

  // Discover all services and characteristics
  discoverServicesAndCharacteristics = async (deviceId: string) => {
    try {
      const device = await this.bleManager.devices([deviceId]);
      const connectedDevice = device[0];

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
    } catch (error) {
      console.error('Error discovering services:', error);
      throw error;
    }
  };
}

export default new BleService();
