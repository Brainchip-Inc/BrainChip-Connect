import { create } from 'zustand';
import { apiService } from '../../services/backend/api';
import {
  clearDeviceAuth,
  getStoredDeviceAuth,
  storeDeviceAuth,
} from './deviceAuthStorage';
import { Alert } from 'react-native';

/* ================= TYPES ================= */

interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface DeviceAuthState {
  token: string | null;
  deviceId: string | null;
  deviceUniqId: string | null;

  loading: boolean;
  error: string | null;

  authenticateDevice: (
    deviceId: string,
    deviceSecret: string,
    deviceUniqId: string,
  ) => Promise<void>;
  logout: () => void;
}

/* ================= STORE ================= */

export const useDeviceAuthStore = create<DeviceAuthState>(set => ({
  token: '',
  deviceId: null,
  deviceUniqId: null,
  loading: false,
  error: null,

  /* ===== AUTHENTICATE DEVICE ===== */

  authenticateDevice: async (deviceId, deviceSecret, deviceUniqId) => {
    set({ loading: true, error: null });

    // const formData = new FormData();
    // formData.append('device_id', deviceUniqId); // added for testing
    // formData.append('device_secret', deviceSecret);

    try {
      // ✅ Check cache first
      const cached = await getStoredDeviceAuth(deviceUniqId);

      if (cached && cached.authenticated) {
        console.log('Using cached token');

        set({
          token: cached.token,
          deviceId,
          deviceUniqId,
          loading: false,
        });

        return;
      }
      console.log('deviceUniqId', deviceUniqId);

      // 🔵 If not cached → call server
      const formData = new FormData();
      formData.append('device_id', deviceUniqId);
      formData.append('device_secret', deviceSecret);

      const response = await apiService.post<AuthResponse>(
        '/device/authenticate',
        formData,
        true,
      );

      // ✅ Save token in storage
      await storeDeviceAuth({
        deviceId: deviceId,
        deviceUniqId: deviceUniqId,
        deviceName: '',
        token: response.access_token,
        authenticated: true,
      });

      set({
        token: response.access_token,
        deviceId,
        deviceUniqId,
        loading: false,
      });
    } catch (err: any) {
      set({
        error: err.message ?? 'Authentication failed',
        loading: false,
      });

      throw err;
    }
  },

  /* ===== LOGOUT ===== */

  logout: () =>
    set({
      token: null,
      deviceId: null,
      deviceUniqId: null,
      loading: false,
      error: null,
    }),
}));
