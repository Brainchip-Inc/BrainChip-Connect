import { NavigationContainerRef } from '@react-navigation/native';
import { Alert } from 'react-native';
import { useBleStore } from '../store/useBleStore';

class BleConnectionHelper {
  private navigationRef: NavigationContainerRef<any> | null = null;
  private currentDeviceId: string | null = null;
  private isManualDisconnect = false;
  private isFotaRunning = false;

  private disconnectHandled = false;

  private isExpectedReboot = false;
  

  /* ---------------------------------- */
  /* Navigation                         */
  /* ---------------------------------- */

  setNavigationRef(ref: NavigationContainerRef<any>) {
    this.navigationRef = ref;
  }

  /* ---------------------------------- */
  /* Track connected device             */
  /* ---------------------------------- */

  setConnectedDevice(deviceId: string) {
    this.currentDeviceId = deviceId;
    this.isManualDisconnect = false;
    this.disconnectHandled = false;
    this.isExpectedReboot = false;
  }

  clearDevice() {
    this.currentDeviceId = null;
  }

  markManualDisconnect() {
    this.isManualDisconnect = true;
  }

  setFotaRunning(running: boolean) {
    this.isFotaRunning = running;
  }

  isFotaActive() {
    return this.isFotaRunning;
  }

  setExpectedReboot(value: boolean) {
    this.isExpectedReboot = value;
  }

  isRebootExpected() {
    return this.isExpectedReboot;
  }

  setDisconnecthandled(value: boolean) {
    this.disconnectHandled = value;
  }

  /* ---------------------------------- */
  /* Global Disconnect Handler          */
  /* ---------------------------------- */

  handleDisconnect = (deviceId: string) => {
    if (__DEV__) console.log('[BLE] Disconnected:', deviceId);

    if (this.isManualDisconnect) {
      if (__DEV__) console.log('[BLE] Manual disconnect');
      this.clearDevice();
      return;
    }

    if (this.isExpectedReboot) {
      if (__DEV__) console.log('[BLE] Ignoring reboot disconnect');
      this.showRebootAlert();
    }

    this.clearDevice();

    if (!this.navigationRef || !this.navigationRef.isReady()) return;

    Alert.alert(
      'Device Disconnected',
      'The device connection was lost or the device restarted. Please reconnect to continue.',
      [
        {
          text: 'Reconnect',
          onPress: () => {
            this.disconnectHandled = false;
            this.isExpectedReboot = false;
            const { setConnectedDevice, setConnectionState } = useBleStore.getState();
            setConnectedDevice(null);
            setConnectionState('disconnected');

            this.navigationRef?.reset({
              index: 0,
              routes: [{ name: 'DeviceDiscovery' }],
            });
          },
        },
      ],
      { cancelable: false },
    );
  };
  /* ---------------------------------- */
  /* Reboot Alert for Expected Reboot  */
  /* ---------------------------------- */
  private showRebootAlert = () => {
    if (!this.navigationRef || !this.navigationRef.isReady()) return;
    this.clearDevice();

    Alert.alert(
      'Device Restarting',
      'The device is restarting. Please select again to continue.',
      [
        {
          text: 'Reconnect',
          onPress: () => {
            this.disconnectHandled = false;
            this.isExpectedReboot = false;
            const { setConnectedDevice, setConnectionState } = useBleStore.getState();
            setConnectedDevice(null);
            setConnectionState('disconnected');
            // Redirect to the device discovery or the same screen after reboot
            this.navigationRef?.reset({
              index: 0,
              routes: [{ name: 'DeviceDiscovery' }],
            });
          },
        },
      ],
      { cancelable: false },
    );
  };
}

export default new BleConnectionHelper();
