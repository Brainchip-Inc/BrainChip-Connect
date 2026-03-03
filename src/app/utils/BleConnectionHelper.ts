import { NavigationContainerRef } from '@react-navigation/native';
import { Alert } from 'react-native';

class BleConnectionHelper {
  private navigationRef: NavigationContainerRef<any> | null = null;
  private currentDeviceId: string | null = null;
  private isManualDisconnect = false;

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
  }

  clearDevice() {
    this.currentDeviceId = null;
  }

  markManualDisconnect() {
    this.isManualDisconnect = true;
  }

  /* ---------------------------------- */
  /* Global Disconnect Handler          */
  /* ---------------------------------- */

  handleDisconnect = (deviceId: string) => {
    console.log('[BLE] Disconnected:', deviceId);

    // Ignore manual disconnect
    if (this.isManualDisconnect) {
      console.log('[BLE] Manual disconnect — no navigation');
      this.clearDevice();
      return;
    }

    this.clearDevice();

    // Delay to allow BLE stack cleanup
    setTimeout(() => {
      if (!this.navigationRef?.isReady()) return;

      Alert.alert(
        'Device Disconnected',
        'Device disconnected or signal lost.',
        [
          {
            text: 'Reconnect',
            onPress: () => {
              this.navigationRef?.reset({
                index: 0,
                routes: [{ name: 'DeviceDiscovery' }],
              });
            },
          },
        ],
        { cancelable: false },
      );
    }, 400);
  };
}

export default new BleConnectionHelper();
