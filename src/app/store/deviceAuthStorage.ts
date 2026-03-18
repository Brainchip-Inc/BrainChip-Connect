import AsyncStorage from '@react-native-async-storage/async-storage';

export const DEVICE_AUTH_KEY = '@spark_device_auth';

export interface DeviceAuthCache {
  deviceId: string;
  deviceUniqId?: string;
  deviceName?: string;
  token: string;
  authenticated: boolean;
}

export const getStoredDeviceAuth = async (
  deviceUniqId: string,
): Promise<DeviceAuthCache | null> => {
  try {
    const stored = await AsyncStorage.getItem(
      `${DEVICE_AUTH_KEY}_${deviceUniqId}`,
    );

    if (!stored) return null;

    return JSON.parse(stored);
  } catch {
    return null;
  }
};

export const storeDeviceAuth = async (
  device: DeviceAuthCache,
): Promise<void> => {
  await AsyncStorage.setItem(
    `${DEVICE_AUTH_KEY}_${device.deviceUniqId}`,
    JSON.stringify(device),
  );
};

export const clearDeviceAuth = async (deviceUniqId: string): Promise<void> => {
  await AsyncStorage.removeItem(`${DEVICE_AUTH_KEY}_${deviceUniqId}`);
};
