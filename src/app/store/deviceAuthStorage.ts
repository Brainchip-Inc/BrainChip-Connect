import * as Keychain from 'react-native-keychain';

export const DEVICE_AUTH_KEY = '@spark_device_auth';

export interface DeviceAuthCache {
  deviceId: string;
  deviceUniqId?: string;
  deviceName?: string;
  token: string;
  authenticated: boolean;
  deviceType: string;
}

export const getStoredDeviceAuth = async (
  deviceUniqId: string,
): Promise<DeviceAuthCache | null> => {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: `${DEVICE_AUTH_KEY}_${deviceUniqId}`,
    });

    if (!credentials) return null;

    return JSON.parse(credentials.password);
  } catch {
    return null;
  }
};

export const storeDeviceAuth = async (
  device: DeviceAuthCache,
): Promise<void> => {
  await Keychain.setGenericPassword(
    device.deviceUniqId ?? device.deviceId,
    JSON.stringify(device),
    { service: `${DEVICE_AUTH_KEY}_${device.deviceUniqId}` },
  );
};

export const clearDeviceAuth = async (deviceUniqId: string): Promise<void> => {
  await Keychain.resetGenericPassword({
    service: `${DEVICE_AUTH_KEY}_${deviceUniqId}`,
  });
};
