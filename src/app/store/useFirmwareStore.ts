import { create } from 'zustand';
import { FirmwareBuild } from '../../types/FirmwareBuild';
import { apiService, BASE_URL } from '../../services/backend/api';
import RNFS from 'react-native-fs';

interface FirmwareState {
  firmwareBuilds: FirmwareBuild[];
  installedBuild: FirmwareBuild | null;
  loading: boolean;
  error: string | null;

  setFirmwareBuilds: (builds: FirmwareBuild[]) => void;
  setInstalledBuild: (build: FirmwareBuild | null) => void;

  fetchFirmwareBuilds: (token: string) => Promise<void>;
  downloadFirmware: (
    id: string,
    token: string,
    filename: string,
  ) => Promise<string | null>;
}

export const useFirmwareStore = create<FirmwareState>(set => ({
  firmwareBuilds: [],
  installedBuild: null,
  loading: false,
  error: null,

  setFirmwareBuilds: builds => set({ firmwareBuilds: builds }),
  setInstalledBuild: build => set({ installedBuild: build }),

  fetchFirmwareBuilds: async (token: string) => {
    try {
      set({ loading: true, error: null });

      const response = await apiService.get<FirmwareBuild[]>(
        '/device/firmware',
        token,
      );

      if (!response) {
        throw new Error('Failed to fetch firmware builds');
      }

      const mappedBuilds: FirmwareBuild[] = response.map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        useCases: item.use_cases,
        version: item.version,
        size: `${item.size_kb} KB`,
        filename: item.filename,
      }));

      set({ firmwareBuilds: mappedBuilds, loading: false });
    } catch (error: any) {
      set({
        error: error.message || 'Unknown error',
        loading: false,
      });
    }
  },

  downloadFirmware: async (id: string, token: string, filename: string) => {
    const localPath = `${RNFS.DocumentDirectoryPath}/firmware_${id}_${filename}`;

    try {
      const downloadUrl = `${BASE_URL}/device/firmware/${id}/download`;

      const downloadResult = await RNFS.downloadFile({
        fromUrl: downloadUrl,
        toFile: localPath,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).promise;

      if (downloadResult.statusCode !== 200) {
        throw new Error('Download failed');
      }

      return localPath;
    } catch (error: any) {
      try { await RNFS.unlink(localPath); } catch {}
      set({
        error: error.message || 'Download error',
        loading: false,
      });
      return null;
    }
  },
}));
