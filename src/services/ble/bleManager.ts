import { BleManager } from 'react-native-ble-plx';
import { Platform, PermissionsAndroid } from 'react-native';

class BleService {
  private bleManager: BleManager;

  constructor() {
    this.bleManager = new BleManager();
  }

  // Check if Bluetooth is enabled
  isBluetoothEnabled = async (): Promise<boolean> => {
    try {
      const state = await this.bleManager.state();
      console.log('Bluetooth state:', state); // Debugging log
      return state === 'PoweredOn'; // Bluetooth is powered on
    } catch (error) {
      console.error('Error checking Bluetooth state', error);
      return false;
    }
  };

  // Request Bluetooth permissions for Android (Android 12+)
  requestBluetoothPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      const bluetoothScanPermission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        {
          title: 'Bluetooth Scan Permission',
          message: 'This app needs permission to scan for Bluetooth devices.',
          buttonPositive: 'OK',
        },
      );

      const bluetoothConnectPermission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        {
          title: 'Bluetooth Connect Permission',
          message: 'This app needs permission to connect to Bluetooth devices.',
          buttonPositive: 'OK',
        },
      );

      const locationPermission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission',
          message: 'This app needs location permission to scan for devices.',
          buttonPositive: 'OK',
        },
      );

      return (
        bluetoothScanPermission === PermissionsAndroid.RESULTS.GRANTED &&
        bluetoothConnectPermission === PermissionsAndroid.RESULTS.GRANTED &&
        locationPermission === PermissionsAndroid.RESULTS.GRANTED
      );
    }
    return true; // For iOS, permission is handled through Info.plist
  };

  // Scan for devices
  scanDevices = (onDeviceFound: (device: any) => void) => {
    return new Promise<void>((resolve, reject) => {
      console.log('Starting device scan...');
      //   let scanTimeout = setTimeout(() => {
      //     this.stopScan(); // Stop scanning after 10 seconds
      //     console.log('Scan stopped due to timeout');
      //     resolve(); // Resolve the promise
      //   }, 10000); // 10 seconds timeout

      this.bleManager.startDeviceScan(
        [],
        { allowDuplicates: false },
        (error, device) => {
          if (error) {
            console.error('Error while scanning:', error); // Log error
            // clearTimeout(scanTimeout); // Clear timeout if error happens
            reject(error);
            return;
          }

          if (device) {
            console.log('Device found:', device.name, device.id); // Log found device
            onDeviceFound(device); // Callback to handle each discovered device
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
      const device = await this.bleManager.connectToDevice(deviceId);
      await device.discoverAllServicesAndCharacteristics();
      console.log('Device connected:', device.name);
      return device;
    } catch (error: any) {
      throw new Error(`Failed to connect to device: ${error.message}`);
    }
  };

  // Disconnect from a device
  disconnectDevice = async (deviceId: string) => {
    try {
      const device = await this.bleManager.devices([deviceId]);
      device[0]?.cancelConnection();
    } catch (error: any) {
      throw new Error(`Failed to disconnect from device: ${error.message}`);
    }
  };
}

export default new BleService();
