import { create } from 'zustand';
import { FirmwareBuild } from '../../types/FirmwareBuild';

interface FirmwareState {
  installedBuild: FirmwareBuild | null;
  setInstalledBuild: (build: FirmwareBuild | null) => void;
}

export const useFirmwareStore = create<FirmwareState>(set => ({
  installedBuild: null,
  setInstalledBuild: build => set({ installedBuild: build }),
}));
