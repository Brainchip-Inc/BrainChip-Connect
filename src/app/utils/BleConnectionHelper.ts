import { NavigationContainerRef } from '@react-navigation/native';
import { Alert } from 'react-native';

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
    console.log('[BLE] Disconnected:', deviceId);

    if (this.isManualDisconnect) {
      console.log('[BLE] Manual disconnect');
      this.clearDevice();
      return;
    }

    if (this.isExpectedReboot) {
      console.log('[BLE] Ignoring reboot disconnect');
    }

    console.log('[BLE] Disconnected:', deviceId);

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
