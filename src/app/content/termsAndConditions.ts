/**
 * Terms and Conditions shown by the Start and Account legal screens.
 *
 * Bundled at build time: the app has no network access, so this is the single
 * source of the wording that used to come from `GET /terms-conditions`. Keep it
 * byte-identical to the reviewed legal text.
 */

import { TermsContent } from '../../types/legalContent';

export const TERMS_AND_CONDITIONS: TermsContent = {
  title: 'Terms and Conditions',
  last_updated: '2025-12-15',
  banners: [
    {
      title: 'Terms of Service',
      content:
        'By using Akida Mobile Connect, you agree to these terms and conditions. Please read them carefully before using the application.',
    },
  ],
  sections: [
    {
      title: 'Acceptance of Terms',
      description:
        'By downloading, installing, or using Akida Mobile Connect, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions. If you do not agree to these terms, please do not use this application.',
      items: [],
    },
    {
      title: 'License Grant',
      description:
        'BrainChip grants you a limited, non-exclusive, non-transferable, revocable license to use Akida Mobile Connect for personal or commercial purposes in connection with BrainChip Edge AI IoT devices. This license does not permit you to:',
      items: [
        {
          title: 'Modify, reverse engineer, or decompile the application',
        },
        {
          title: 'Use the application for any unlawful purpose',
        },
        {
          title:
            'Distribute, Sublicense, or transfer the application to third parties',
        },
        {
          title: 'Remove or modify any proprietary notices or labels',
        },
      ],
    },
    {
      title: 'Device Compatibility',
      description:
        'Akida Mobile Connect is designed to work with BrainChip Edge AI IoT devices. The application requires compatible hardware and firmware versions. BrainChip does not guarantee compatibility with all mobile devices or operating system versions.',
      items: [],
    },
    {
      title: 'User Responsibilities',
      description: 'You are responsible for:',
      items: [
        {
          title:
            'Maintaining the security of your device and BrainChip hardware',
        },
        {
          title: 'Ensuring proper use of connected devices and AI models',
        },
        {
          title: 'Complying with applicable laws and regulations',
        },
        {
          title: 'Maintaining adequate backups of important configurations',
        },
        {
          title: 'Using the application in a safe and responsible manner',
        },
      ],
    },
    {
      title: 'Disclaimer of Warranties',
      description:
        'The application is provided "as is" without warranties of any kind, either express or implied. BrainChip does not warrant that the application will be error-free, uninterrupted, or meet your specific requirements. Use of the application is at your own risk.',
      items: [],
    },
    {
      title: 'Limitation of Liability',
      description:
        'To the maximum extent permitted by law, BrainChip shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your use of the application.',
      items: [],
    },
    {
      title: 'Updates and Modifications',
      description:
        'BrainChip may update, modify, or discontinue the application at any time without notice. We may also update these Terms and Conditions periodically. Continued use of the application after changes constitutes acceptance of the new terms.',
      items: [],
    },
    {
      title: 'Intellectual Property',
      description:
        'All intellectual property rights in Akida Mobile Connect, including but not limited to trademarks, logos, software, and documentation, are owned by BrainChip Holdings Ltd. The Akida™ name and logo are trademarks of BrainChip.',
      items: [],
    },
    {
      title: 'Termination',
      description:
        'BrainChip may terminate your access to the application at any time for violation of these terms. Upon termination, you must cease all use of the application and delete all copies from your devices.',
      items: [],
    },
    {
      title: 'Governing Law',
      description:
        'These Terms and Conditions shall be governed by and construed in accordance with the laws of the jurisdiction where BrainChip Holdings Ltd. is incorporated, without regard to its conflict of law provisions.',
      items: [],
    },
    {
      title: 'Contact Information',
      description:
        'For questions about these Terms and Conditions, please visit brainchip.com/contact/',
      items: [],
    },
  ],
};
