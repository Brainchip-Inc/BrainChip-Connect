/**
 * Pins the hosted legal pages to the text the app ships.
 *
 * Google Play's listing points at `docs/legal/privacy-policy.html`, so that
 * page is a published promise while the app screen reads
 * `src/app/content/privacyPolicy.ts`. Two copies of a legal document drift
 * silently and nothing else in the build would notice, so this test is the
 * thing that notices: edit the content and the pages have to be regenerated
 * with `npm run legal:render` in the same change.
 *
 * @format
 */

import { readFileSync } from 'fs';
import { join } from 'path';

/** One bundled legal document, rendered to the page committed under `docs/legal/`. */
interface RenderedLegalPage {
  pageName: string;
  html: string;
}

const {
  renderLegalPages,
  OUTPUT_DIRECTORY,
} = require('../scripts/render-legal-pages') as {
  renderLegalPages: () => RenderedLegalPage[];
  OUTPUT_DIRECTORY: string;
};

describe('hosted legal pages', () => {
  for (const { pageName, html } of renderLegalPages()) {
    it(`${OUTPUT_DIRECTORY}/${pageName} matches the text bundled in the app`, () => {
      const committed = readFileSync(
        join(__dirname, '..', OUTPUT_DIRECTORY, pageName),
        'utf8',
      );
      expect(committed).toBe(html);
    });
  }

  it('publishes the wording of the policy rather than a summary of it', () => {
    const [privacyPolicy] = renderLegalPages();
    expect(privacyPolicy.html).toContain(
      'We do not collect, store, or transmit your personal data to external servers.',
    );
    expect(privacyPolicy.html).toContain('We do not share, sell, or transmit');
  });
});
