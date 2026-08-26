/**
 * Privacy Policy shown by the Start and Account legal screens.
 *
 * Bundled at build time: the app has no network access, so this is the single
 * source of the wording that used to come from `GET /privacy-policy`. Keep it
 * byte-identical to the reviewed legal text.
 */

import { PrivacyPolicyContent } from '../../types/legalContent';

export const PRIVACY_POLICY: PrivacyPolicyContent = {
  title: 'Privacy Policy',
  last_updated: '2026-08-25',
  banners: [
    {
      title: 'Your Privacy is Our Priority',
      content:
        'BrainChip Connect is designed with privacy at its core. All data processing happens locally on your device and your connected BrainChip hardware. We do not collect, store, or transmit your personal data to external servers.',
    },
  ],
  sections: [
    {
      title: 'What Data We Access',
      icon: 'database',
      description:
        'This app accesses the following data solely for device operation:',
      items: [
        {
          icon: 'bluetooth',
          title: 'Bluetooth Connection Data',
          description:
            'Device names, signal strength, and pairing information to establish and maintain connection with your BrainChip device',
        },
        {
          icon: 'cpu',
          title: 'Sensor Data',
          description:
            'IMU, audio, and environmental sensor readings displayed in real-time. All processing occurs on-device',
        },
        {
          icon: 'bell',
          title: 'Notification Preferences',
          description:
            'Your notification settings and event history, stored locally on your mobile device only',
        },
      ],
    },
    {
      title: 'How We Store Your Data',
      icon: 'hdd',
      description:
        'All application data is stored locally on your mobile device using device secure local storage:',
      items: [
        {
          icon: 'database',
          title: 'Device pairing information and connection preferences',
        },
        {
          icon: 'cpu',
          title: 'AI model configurations and deployment history',
        },
        {
          icon: 'bell',
          title: 'Notification history and alert preferences',
        },
        {
          icon: 'key',
          title: 'Power management and sensor configuration settings',
        },
        {
          icon: 'person',
          title: 'User profile preferences and customization',
        },
      ],
    },
    {
      title: 'Data Sharing',
      icon: 'share',
      description: null,
      items: [
        {
          icon: 'shield-x',
          title: 'We do not share, sell, or transmit your data',
          description:
            'All processing happens locally. The app communicates only with your paired BrainChip device via Bluetooth. No data leaves your device unless you explicitly choose to export or share it.',
        },
      ],
    },
    {
      title: 'Required Permissions',
      icon: 'check-circle',
      description: 'The app requires following permissions to function:',
      items: [
        {
          icon: 'bluetooth',
          title: 'Bluetooth',
          description:
            'To discover, connect, and communicate with BrainChip devices',
        },
        {
          icon: 'geo-alt',
          title: 'Location',
          description: 'Required by Android/iOS for Bluetooth scanning',
        },
        {
          icon: 'bell',
          title: 'Notifications',
          description: 'To alert you about AI model events and system updates',
        },
      ],
    },
    {
      title: 'Security',
      icon: 'lock',
      description: null,
      items: [
        {
          icon: 'shield-lock',
          title: 'Encrypted Communication',
          description:
            'Bluetooth connections are authenticated and encrypted. Your device pairing is secured with industry-standard cryptographic protocols. All communication between the app and your BrainChip device uses secure Bluetooth Low Energy (BLE) with pairing authentication.',
        },
      ],
    },
    {
      title: 'Questions?',
      icon: 'question-circle',
      description: null,
      items: [
        {
          icon: 'envelope',
          title: 'Contact Us',
          description:
            'If you have questions about our privacy practices, please contact us at brainchip.com/contact/',
        },
      ],
    },
  ],
};
