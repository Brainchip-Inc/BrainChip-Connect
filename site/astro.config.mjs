// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// The site is served under the repository name on GitHub Pages, and pages are
// written as `name.html` files so that the Privacy Policy keeps the URL the
// store listing and the app already point at.
export default defineConfig({
  site: 'https://brainchip-inc.github.io',
  base: '/BrainChip-Connect',
  build: { format: 'file' },
  integrations: [
    starlight({
      title: 'BrainChip Connect',
      description:
        'How to use and build on BrainChip Connect, the companion app for AkidaTag.',
      logo: {
        src: './src/assets/brainchip-wordmark-white.svg',
        alt: 'BrainChip',
      },
      customCss: ['./src/styles/brainchip.css'],
      components: {
        Footer: './src/components/Footer.astro',
      },
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/Brainchip-Inc/BrainChip-Connect',
        },
      ],
      sidebar: [
        {
          label: 'User guide',
          items: [{ autogenerate: { directory: 'user-guide' } }],
        },
        {
          label: 'Developer guide',
          items: [{ autogenerate: { directory: 'developer-guide' } }],
        },
        { label: 'Privacy Policy', slug: 'privacy-policy' },
      ],
    }),
  ],
});
