import { create } from 'zustand';
import { useBleCommandStore } from './useBleCommandStore';

export type AppType = 'keyword' | 'anomaly' | 'imu' | 'vision';

interface SensorState {
  isStreaming: boolean;
  appType: AppType | null;

  keywordConfidence: number | undefined;
  detectedWord: string | undefined;

  anomalyScore: number;
  systemStatus: string;

  micWave: Int16Array;
  accel: { x: number[]; y: number[]; z: number[] };
  gyro: { x: number[]; y: number[]; z: number[] };

  // Stop resolves once the board acks (11:170), so callers can surface a stop
  // that did not take.
  startStreaming: (type: AppType) => Promise<void>;
  stopStreaming: (type: AppType) => Promise<void>;
  simulateData: () => void;
}

export const useLiveSensorStore = create<SensorState>((set, _get) => ({
  isStreaming: false,
  appType: null,

  keywordConfidence: undefined,
  detectedWord: 'Waiting',

  anomalyScore: 12,
  systemStatus: 'Normal',

  micWave: new Int16Array(),

  accel: {
    x: Array(30).fill(0.3),
    y: Array(30).fill(0.4),
    z: Array(30).fill(0.5),
  },

  gyro: {
    x: Array(30).fill(0.2),
    y: Array(30).fill(0.6),
    z: Array(30).fill(0.3),
  },

  startStreaming: async type => {
    set({ isStreaming: true, appType: type });
    await useBleCommandStore.getState().startStreaming(type);
  },

  stopStreaming: async type => {
    set({ isStreaming: false });
    await useBleCommandStore.getState().stopStreaming(type);
  },

  simulateData: () => {
    // if (!get().isStreaming) return; // need to confirm once

    set({
      detectedWord: useBleCommandStore.getState().latestDetection,
      keywordConfidence: useBleCommandStore.getState().confidence,
      anomalyScore: Math.random() * 30,

      micWave: useBleCommandStore.getState().micWave ?? new Int16Array(),

      accel: {
        x: Array(30)
          .fill(0)
          .map(() => Math.random()),
        y: Array(30)
          .fill(0)
          .map(() => Math.random()),
        z: Array(30)
          .fill(0)
          .map(() => Math.random()),
      },

      gyro: {
        x: Array(30)
          .fill(0)
          .map(() => Math.random()),
        y: Array(30)
          .fill(0)
          .map(() => Math.random()),
        z: Array(30)
          .fill(0)
          .map(() => Math.random()),
      },
    });
  },
}));
