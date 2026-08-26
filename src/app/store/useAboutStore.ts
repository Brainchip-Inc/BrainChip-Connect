import { create } from 'zustand';

export type AboutItem =
  | { type: 'text'; content: string }
  | { type: 'list'; items: string[] }
  | { type: 'kv'; label: string; value: string }
  | { type: 'link'; label: string; url: string };

export type AboutSection = {
  id: string;
  title?: string;
  items: AboutItem[];
};

type AboutState = {
  version: string;
  build: string;
  sections: AboutSection[];
};

export const useAboutStore = create<AboutState>(() => ({
  version: '1.0.0',
  build: '2026.08.26',

  sections: [
    {
      id: 'hardware',
      title: 'Device Hardware',
      items: [
        { type: 'kv', label: 'MCU', value: 'nRF5340, Arm Cortex-M33' },
        { type: 'kv', label: 'AI Processor', value: 'BRN AKD1500' },
        { type: 'kv', label: 'Connectivity', value: 'Bluetooth 5.3 LE' },
      ],
    },

    {
      id: 'aboutApp',
      title: 'About This App',
      items: [
        {
          type: 'text',
          content:
            'BrainChip Connect is the official companion app for BrainChip Edge AI IoT devices powered by the Akida neuromorphic processor. Manage your edge AI devices, monitor real-time sensor data, deploy AI models, and receive intelligent notifications—all from your mobile device.',
        },
      ],
    },

    {
      id: 'features',
      title: 'Key Features',
      items: [
        {
          type: 'list',
          items: [
            'Bluetooth Low Energy device pairing and management',
            'Real-time sensor monitoring (IMU, Audio, Environmental)',
            'AI model deployment and performance tracking',
            'Over-the-air (OTA) firmware updates',
            'Event detection and notification alerts',
            'Power mode optimization and battery monitoring',
            'Device configuration and settings management',
          ],
        },
      ],
    },

    {
      id: 'powered',
      title: 'Powered by Akida',
      items: [
        {
          type: 'text',
          content:
            "BrainChip's Akida™ is a revolutionary neuromorphic processor that brings AI capabilities to the edge. With ultra-low power consumption and real-time processing, Akida enables intelligent IoT devices.",
        },
      ],
    },

    {
      id: 'company',
      title: 'About BrainChip',
      items: [
        {
          type: 'text',
          content:
            'BrainChip is a leading provider of ultra-low power, high-performance AI technology that is both scalable and flexible to address the requirements of edge AI applications.',
        },
        {
          type: 'text',
          content: '© 2026 BrainChip Holdings Ltd. All rights reserved.',
        },
      ],
    },

    {
      id: 'support',
      items: [
        {
          type: 'link',
          label: 'brainchip.com',
          url: 'https://brainchip.com',
        },
      ],
    },
  ],
}));
