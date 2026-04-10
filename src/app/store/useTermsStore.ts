import { create } from 'zustand';
import { apiService } from '../../services/backend/api';

/* ================= TYPES ================= */

export interface TermsItem {
  text: string;
}

export interface TermsSection {
  heading: string;
  content: string;
  items: TermsItem[];
}

export interface TermsContent {
  title: string;
  last_updated: string;
  banners: Banner[];
  sections: TermsSection[];
}

export interface TermsResponse {
  content: TermsContent;
  updated_at: string;
}

export interface Banner {
  title: string;
  content: string;
}

/* ================= STORE ================= */

interface TermsState {
  terms: TermsResponse | null;
  loading: boolean;
  error: string | null;

  fetchTerms: () => Promise<void>;
}

/* ================= STORE ================= */

export const useTermsStore = create<TermsState>(set => ({
  terms: null,
  loading: false,
  error: null,

  fetchTerms: async () => {
    // console.log('🚀 Fetching Terms from API');

    set({ loading: true, error: null });

    try {
      const data = await apiService.get<TermsContent>('/terms-conditions');

      // console.log('✅ Terms API response', data);

      set({
        terms: {
          content: data,
          updated_at: new Date().toISOString(),
        },
        loading: false,
      });
    } catch (err: any) {
      // console.log('❌ Terms API error', err);

      set({
        error: err?.message ?? 'Failed to fetch terms',
        loading: false,
      });
    }
  },
}));
