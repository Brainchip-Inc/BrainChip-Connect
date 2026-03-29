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
  effective_date: string;
  banner: {
    title: string;
    content: string;
  };
  sections: PolicySection[];
}

export interface PrivacyPolicyResponse {
  content: PrivacyPolicyContent;
  updated_at: string;
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
      const data = await apiService.get<PrivacyPolicyResponse>(
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
