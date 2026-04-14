import { create } from 'zustand';
import { apiService } from '../../services/backend/api';

/* ================= TYPES ================= */

export interface Banner {
  title: string;
  content: string;
}

export interface PolicyItem {
  icon?: string;
  title: string;
  description?: string | null;
}

export interface PolicySection {
  title: string;
  icon?: string;
  description?: string | null;
  items: PolicyItem[];
}

export interface PrivacyPolicyContent {
  title: string;
  last_updated: string;
  banners: Banner[];
  sections: PolicySection[];
}

/* ================= STORE ================= */

interface PolicyState {
  privacyPolicy: PrivacyPolicyContent | null;
  loading: boolean;
  error: string | null;
  fetchPrivacyPolicy: () => Promise<void>;
}

export const usePolicyStore = create<PolicyState>(set => ({
  privacyPolicy: null,
  loading: false,
  error: null,

  fetchPrivacyPolicy: async () => {
    set({ loading: true, error: null });

    try {
      const data = await apiService.get<PrivacyPolicyContent>(
        '/privacy-policy',
      );

      set({
        privacyPolicy: data,
        loading: false,
      });
    } catch (err: any) {
      set({
        error: err?.message ?? 'Failed to fetch privacy policy',
        loading: false,
      });
    }
  },
}));
