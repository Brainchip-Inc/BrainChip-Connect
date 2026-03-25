// import { create } from 'zustand';
// import { FirmwareBuild } from '../../types/FirmwareBuild';

// interface FirmwareState {
//   firmwareBuilds: FirmwareBuild[];
//   installedBuild: FirmwareBuild | null;
//   setFirmwareBuilds: (builds: FirmwareBuild[]) => void;
//   setInstalledBuild: (build: FirmwareBuild | null) => void;
// }

// export const useFirmwareStore = create<FirmwareState>(set => ({
//   firmwareBuilds: [
//     {
//       id: 'smart-audio-motion',
//       title: 'Smart Audio & Motion',
//       description:
//         'Optimized for audio keyword spotting and IMU gesture recognition with anomaly detection',
//       useCases: ['Keyword Spotting', 'IMU Gesture', 'Anomaly Detection'],
//       version: '2.4.1',
//       size: '1.8 MB',
//     },
//     {
//       id: 'vision-detection',
//       title: 'Vision & Detection',
//       description:
//         'Focused on lightweight vision processing with anomaly and audio detection',
//       useCases: ['Vision Lite', 'Anomaly Detection', 'Keyword Spotting'],
//       version: '2.4.0',
//       size: '2.1 MB',
//     },
//     {
//       id: 'industrial-monitoring',
//       title: 'Industrial Monitoring',
//       description:
//         'Industrial-grade anomaly detection with gesture control and vision capabilities',
//       useCases: ['Anomaly Detection', 'IMU Gesture', 'Vision Lite'],
//       version: '2.3.8',
//       size: '1.9 MB',
//     },
//   ],
//   installedBuild: null, // Initially, no build is installed
//   setFirmwareBuilds: (builds: FirmwareBuild[]) =>
//     set({ firmwareBuilds: builds }),
//   setInstalledBuild: (build: FirmwareBuild | null) =>
//     set({ installedBuild: build }),
// }));

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

  // ✅ NEW FUNCTION
  downloadFirmware: async (id: string, token: string, filename: string) => {
    try {
      const downloadUrl = `${BASE_URL}/device/firmware/${id}/download`;

      const localPath = `${RNFS.DocumentDirectoryPath}/firmware_${id}_${filename}`;

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

      return localPath; // return file path for OTA usage
    } catch (error: any) {
      set({
        error: error.message || 'Download error',
        loading: false,
      });
      return null;
    }
  },
}));
