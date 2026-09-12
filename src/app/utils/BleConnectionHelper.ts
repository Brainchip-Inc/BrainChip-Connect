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

  /**
   * Drop the current device and send the user back to the device list.
   *
   * The board's Bluetooth address changes when it restarts, so there is
   * nothing to resume: reconnecting always means picking it again.
   */
  returnToDeviceList = () => {
    this.disconnectHandled = false;
    this.isExpectedReboot = false;

    const { setConnectedDevice, setConnectionState } = useBleStore.getState();
    setConnectedDevice(null);
    setConnectionState('disconnected');

    this.navigationRef?.reset({
      index: 0,
      routes: [{ name: 'DeviceDiscovery' }],
    });
  };

  handleDisconnect = (deviceId: string) => {
    if (__DEV__) console.log('[BLE] Disconnected:', deviceId);

    // A firmware update restarts the board and reconnects to it on purpose.
    // It owns the whole sequence and reports the outcome itself, so an alert
    // here would interrupt it with a failure that has not happened.
    if (this.isFotaRunning) {
      return;
    }

    if (this.isManualDisconnect) {
      if (__DEV__) console.log('[BLE] Manual disconnect');
      this.clearDevice();
      return;
    }

    this.clearDevice();

    if (!this.navigationRef || !this.navigationRef.isReady()) return;

    const [title, message] = this.isExpectedReboot
      ? [
          'Device Restarting',
          'The device is restarting. Please select again to continue.',
        ]
      : [
          'Device Disconnected',
          'The device connection was lost or the device restarted. Please reconnect to continue.',
        ];

    Alert.alert(
      title,
      message,
      [{ text: 'Reconnect', onPress: this.returnToDeviceList }],
      { cancelable: false },
    );
  };
}

export default new BleConnectionHelper();
