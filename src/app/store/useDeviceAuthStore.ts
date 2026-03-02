import { create } from 'zustand';
import { apiService } from '../../services/backend/api';

/* ================= TYPES ================= */

interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface DeviceAuthState {
  token: string | null;
  deviceId: string | null;

  loading: boolean;
  error: string | null;

  authenticateDevice: (deviceId: string, deviceSecret: string) => Promise<void>;
  logout: () => void;
}

/* ================= STORE ================= */

export const useDeviceAuthStore = create<DeviceAuthState>(set => ({
  token: '',
  deviceId: null,
  loading: false,
  error: null,

  /* ===== AUTHENTICATE DEVICE ===== */

  authenticateDevice: async (deviceId, deviceSecret) => {
    set({ loading: true, error: null });

    const formData = new FormData();
    formData.append('device_id', deviceId); // added for testing
    formData.append('device_secret', deviceSecret);

    try {
      const response = await apiService.post<AuthResponse>(
        '/device/authenticate',
        formData,
        true,
      );

      set({
        token: response.access_token,
        deviceId,
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
    }),
}));
