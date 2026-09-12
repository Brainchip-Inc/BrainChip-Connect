import { create } from 'zustand';
import {
  FirmwareUpdateStage,
  SelectedFirmware,
  SigningKeyWarning,
} from '../../types/firmwareUpdate';

/**
 * The firmware update in flight, held outside the screens that show it.
 *
 * An update outlives any one screen: the board takes up to two minutes to
 * restart and answer what it is running, and the user is free to walk away
 * from the screen meanwhile. Keeping this in component state threw the
 * outcome away with the screen, which is the one thing the flow exists to
 * report. Both firmware surfaces read this, so they cannot disagree either.
 */
interface FirmwareUpdateState {
  selected: SelectedFirmware | null;
  keyWarning: SigningKeyWarning | null;
  stage: FirmwareUpdateStage;
  setSelected: (selected: SelectedFirmware | null) => void;
  setKeyWarning: (keyWarning: SigningKeyWarning | null) => void;
  setStage: (stage: FirmwareUpdateStage) => void;
  reset: () => void;
}

export const useFirmwareUpdateStore = create<FirmwareUpdateState>(set => ({
  selected: null,
  keyWarning: null,
  stage: { kind: 'idle' },

  setSelected: selected => set({ selected }),
  setKeyWarning: keyWarning => set({ keyWarning }),
  setStage: stage => set({ stage }),

  reset: () =>
    set({ selected: null, keyWarning: null, stage: { kind: 'idle' } }),
}));
