import { create } from 'zustand';
import { apiService } from '../../services/backend/api';

/* ================= TYPES ================= */

export interface Banner {
  title: string;
  content: string;
}

export interface TermsItem {
  title: string;
}

export interface TermsSection {
  title: string;
  description: string;
  items: TermsItem[];
}

export interface TermsContent {
  title: string;
  last_updated: string;
  banners: Banner[];
  sections: TermsSection[];
}

/* ================= STORE ================= */

interface TermsState {
  terms: TermsContent | null;
  loading: boolean;
  error: string | null;

  fetchTerms: () => Promise<void>;
}

export const useTermsStore = create<TermsState>(set => ({
  terms: null,
  loading: false,
  error: null,

  fetchTerms: async () => {
    set({ loading: true, error: null });

    try {
      const data = await apiService.get<TermsContent>('/terms-conditions');

      set({
        terms: data,
        loading: false,
      });
    } catch (err: any) {
      set({
        error: err?.message ?? 'Failed to fetch terms',
        loading: false,
      });
    }
  },
}));
