import { create } from 'zustand';
import { apiService, BASE_URL } from '../../services/backend/api';
import RNFS from 'react-native-fs';

export interface AIModel {
  id: number;
  version: string;
  description: string;
  release_notes: string;
  size_kb: number;
  filepath: string;
  filename: string;
  created_at: string;
}

interface ModelState {
  models: AIModel[];
  latestModel: AIModel | null;
  loading: boolean;
  error: string | null;

  setModels: (models: AIModel[]) => void;

  fetchModels: (token: string) => Promise<void>;
  downloadModel: (
    id: number,
    token: string,
    filename: string,
  ) => Promise<string | null>;
}

export const useModelStore = create<ModelState>(set => ({
  models: [],
  latestModel: null,
  loading: false,
  error: null,

  setModels: models => set({ models }),

  /* ================= FETCH MODELS ================= */
  fetchModels: async (token: string) => {
    try {
      set({ loading: true, error: null });

      const response = await apiService.get<AIModel[]>('/device/models', token);

      if (!response) {
        throw new Error('Failed to fetch models');
      }

      // Sort newest first
      const sorted = [...response].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      set({
        models: sorted,
        latestModel: sorted[0] ?? null,
        loading: false,
      });
    } catch (error: any) {
      set({
        error: error.message || 'Unknown error',
        loading: false,
      });
    }
  },

  /* ================= DOWNLOAD MODEL ================= */
  downloadModel: async (id, token, filename) => {
    try {
      set({ loading: true, error: null });

      const downloadUrl = `${BASE_URL}/device/models/${id}/download`;

      const localPath = `${RNFS.DocumentDirectoryPath}/model_${id}_${filename}`;

      const result = await RNFS.downloadFile({
        fromUrl: downloadUrl,
        toFile: localPath,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).promise;

      if (result.statusCode !== 200) {
        throw new Error('Model download failed');
      }

      set({ loading: false });

      return localPath; // return file path for OTA
    } catch (error: any) {
      set({
        error: error.message || 'Download error',
        loading: false,
      });
      return null;
    }
  },
}));
