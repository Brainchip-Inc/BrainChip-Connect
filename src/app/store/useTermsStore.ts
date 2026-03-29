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
  effective_date: string;
  banner: {
    title: string;
    content: string;
  };
  sections: TermsSection[];
}

export interface TermsResponse {
  content: TermsContent;
  updated_at: string;
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
      const data = await apiService.get<TermsResponse>('/terms-conditions');

      // console.log('✅ Terms API response', data);

      set({
        terms: data,
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
