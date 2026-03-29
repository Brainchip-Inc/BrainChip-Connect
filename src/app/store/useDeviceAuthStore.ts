import { create } from 'zustand';
import { apiService } from '../../services/backend/api';
import {
  getStoredDeviceAuth,
  storeDeviceAuth,
} from './deviceAuthStorage';

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
  deviceName: string | null;
  deviceType: string | null;

  loading: boolean;
  error: string | null;

  authenticateDevice: (
    deviceId: string,
    deviceName: string,
    deviceType: string,
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
  deviceName: null,
  deviceType: null,

  /* ===== AUTHENTICATE DEVICE ===== */

  authenticateDevice: async (
    deviceId,
    deviceName,
    deviceType,
    deviceUniqId,
  ) => {
    set({ loading: true, error: null });

    try {
      // ✅ Check cache first
      const cached = await getStoredDeviceAuth(deviceUniqId);

      if (
        cached &&
        cached.authenticated &&
        (!cached.expiresAt || cached.expiresAt > Date.now())
      ) {
        set({
          token: cached.token,
          deviceName,
          deviceType,
          deviceUniqId,
          loading: false,
        });

        return;
      }
      // 🔵 If not cached → call server
      const formData = new FormData();
      formData.append('device_id', deviceUniqId);
      formData.append('device_name', deviceName);
      formData.append('device_type', deviceType);
      const response = await apiService.post<AuthResponse>(
        '/device/authenticate',
        formData,
        true,
      );

      // ✅ Save token in storage with expiry
      const expiresAt = response.expires_in
        ? Date.now() + response.expires_in * 1000
        : Date.now() + 24 * 60 * 60 * 1000; // Default 24h

      await storeDeviceAuth({
        deviceId: deviceId,
        deviceUniqId: deviceUniqId,
        deviceName: deviceName,
        token: response.access_token,
        authenticated: true,
        deviceType: deviceType,
        expiresAt,
      });

      set({
        token: response.access_token,
        deviceName,
        deviceType,
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
