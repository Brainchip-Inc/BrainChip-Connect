import { create } from 'zustand';
import { apiService } from '../../services/backend/api';

/* ================= TYPES ================= */

export interface PolicyItem {
  icon?: string;
  title: string;
  description?: string | null;
}

export interface PolicySection {
  heading: string;
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

export interface PrivacyPolicyResponse {
  content: PrivacyPolicyContent;
  updated_at: string;
}

export interface Banner {
  title: string;
  content: string;
}

/* ================= STORE ================= */

interface PolicyState {
  privacyPolicy: PrivacyPolicyResponse | null;
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
        privacyPolicy: {
          content: data,
          updated_at: new Date().toISOString(),
        },
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
