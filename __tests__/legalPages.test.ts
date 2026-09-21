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

const {
  renderLegalPages,
  OUTPUT_DIRECTORY,
} = require('../scripts/render-legal-pages');

describe('hosted legal pages', () => {
  it.each(renderLegalPages())(
    'docs/legal/$pageName matches the text bundled in the app',
    ({ pageName, html }: { pageName: string; html: string }) => {
      const committed = readFileSync(
        join(__dirname, '..', OUTPUT_DIRECTORY, pageName),
        'utf8',
      );
      expect(committed).toBe(html);
    },
  );

  it('publishes the wording of the policy rather than a summary of it', () => {
    const [privacyPolicy] = renderLegalPages();
    expect(privacyPolicy.html).toContain(
      'We do not collect, store, or transmit your personal data to external servers.',
    );
    expect(privacyPolicy.html).toContain('We do not share, sell, or transmit');
  });
});
