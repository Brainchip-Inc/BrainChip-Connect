/**
 * Pins the hosted pages to the text the app ships.
 *
 * Google Play's listing points at `docs/pages/privacy-policy.html`, so that
 * page is a published promise while the app screen reads
 * `src/app/content/privacyPolicy.ts`. Two copies of a legal document drift
 * silently and nothing else in the build would notice, so this test is the
 * thing that notices: edit the content and the pages have to be regenerated
 * with `npm run pages:render` in the same change.
 *
 * @format
 */

import { readFileSync } from 'fs';
import { join } from 'path';

/** One bundled legal document, rendered to the page committed under `docs/pages/`. */
interface RenderedPage {
  pageName: string;
  html: string;
}

const {
  renderPages,
  OUTPUT_DIRECTORY,
} = require('../scripts/render-pages') as {
  renderPages: () => RenderedPage[];
  OUTPUT_DIRECTORY: string;
};

describe('hosted pages', () => {
  for (const { pageName, html } of renderPages()) {
    it(`${OUTPUT_DIRECTORY}/${pageName} matches the text bundled in the app`, () => {
      const committed = readFileSync(
        join(__dirname, '..', OUTPUT_DIRECTORY, pageName),
        'utf8',
      );
      expect(committed).toBe(html);
    });
  }

  it('publishes the wording of the policy rather than a summary of it', () => {
    const [privacyPolicy] = renderPages();
    expect(privacyPolicy.html).toContain(
      'We do not collect, store, or transmit your personal data to external servers.',
    );
    expect(privacyPolicy.html).toContain('We do not share, sell, or transmit');
  });
});
