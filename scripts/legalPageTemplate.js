/**
 * Turns one of the app's bundled legal documents into a standalone HTML page.
 *
 * The hosted page and the in-app screen have to say the same thing, so both are
 * rendered from `src/app/content/`. Nothing here adds wording of its own: the
 * page is the document, laid out. The markup is self-contained, because the
 * app is offline by design and a legal page that reaches out for a font or a
 * stylesheet would be the only part of the product that does.
 *
 * @format
 */

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * Escape text for use in HTML element content or a quoted attribute.
 *
 * @param {string} text - Text taken from the document.
 * @returns {string} The same text, safe to place in the markup.
 */
const escapeHtml = text =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Spell out an ISO date the way the page shows it.
 *
 * @param {string} isoDate - Date as `YYYY-MM-DD`, from the document.
 * @returns {string} The date as `25 August 2026`, or the input unchanged when
 *   it is not in that form.
 */
const formatDate = isoDate => {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!parts) return isoDate;
  const [, year, month, day] = parts;
  return `${Number(day)} ${MONTH_NAMES[Number(month) - 1]} ${year}`;
};

/**
 * Render the highlighted note a document opens with.
 *
 * @param {{title: string, content: string}} banner - One banner of the document.
 * @returns {string} Its markup.
 */
const renderBanner = banner => `      <aside class="banner">
        <h2>${escapeHtml(banner.title)}</h2>
        <p>${escapeHtml(banner.content)}</p>
      </aside>`;

/**
 * Render one point within a section.
 *
 * @param {{title: string, description?: string|null}} item - One item of a section.
 * @returns {string} Its markup.
 */
const renderItem = item => {
  const description = item.description
    ? `\n            <p>${escapeHtml(item.description)}</p>`
    : '';
  return `          <li>
            <h3>${escapeHtml(item.title)}</h3>${description}
          </li>`;
};

/**
 * Render one section of a document, with its points.
 *
 * @param {{title: string, description?: string|null, items: Array<object>}} section
 *   One section of the document.
 * @returns {string} Its markup.
 */
const renderSection = section => {
  const description = section.description
    ? `\n        <p>${escapeHtml(section.description)}</p>`
    : '';
  const items = section.items.length
    ? `\n        <ul>\n${section.items.map(renderItem).join('\n')}\n        </ul>`
    : '';
  return `      <section>
        <h2>${escapeHtml(section.title)}</h2>${description}${items}
      </section>`;
};

const STYLES = `      :root {
        color-scheme: light dark;
        --page: #f8f8f9;
        --surface: #ffffff;
        --ink: #14181b;
        --ink-soft: #4c565e;
        --brand: #0061ed;
        --edge: #e2e6ea;
        --banner: #eef4ff;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --page: #0e1216;
          --surface: #161b21;
          --ink: #eef1f4;
          --ink-soft: #a7b1ba;
          --brand: #5fa0ff;
          --edge: #262e36;
          --banner: #15233a;
        }
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        padding: 48px 16px 96px;
        background: var(--page);
        color: var(--ink);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
          'Helvetica Neue', Arial, sans-serif;
        font-size: 17px;
        line-height: 1.6;
      }

      main {
        max-width: 720px;
        margin: 0 auto;
      }

      .eyebrow {
        margin: 0;
        color: var(--brand);
        font-size: 15px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      h1 {
        margin: 8px 0 4px;
        font-size: 38px;
        line-height: 1.15;
        letter-spacing: -0.02em;
      }

      .updated {
        margin: 0 0 40px;
        color: var(--ink-soft);
        font-size: 15px;
      }

      .banner {
        margin: 0 0 40px;
        padding: 24px;
        border: 1px solid var(--edge);
        border-left: 4px solid var(--brand);
        border-radius: 12px;
        background: var(--banner);
      }

      .banner h2 {
        margin: 0 0 8px;
        font-size: 19px;
      }

      .banner p {
        margin: 0;
      }

      section {
        margin: 0 0 20px;
        padding: 28px;
        border: 1px solid var(--edge);
        border-radius: 12px;
        background: var(--surface);
      }

      section h2 {
        margin: 0;
        font-size: 23px;
        letter-spacing: -0.01em;
      }

      section > p {
        margin: 12px 0 0;
        color: var(--ink-soft);
      }

      ul {
        margin: 20px 0 0;
        padding: 0;
        list-style: none;
      }

      li + li {
        margin-top: 18px;
        padding-top: 18px;
        border-top: 1px solid var(--edge);
      }

      li h3 {
        margin: 0;
        font-size: 17px;
        font-weight: 600;
      }

      li p {
        margin: 6px 0 0;
        color: var(--ink-soft);
      }

      footer {
        margin-top: 40px;
        color: var(--ink-soft);
        font-size: 15px;
        text-align: center;
      }

      @media (max-width: 540px) {
        body {
          padding: 32px 16px 64px;
        }

        h1 {
          font-size: 30px;
        }

        section {
          padding: 20px;
        }
      }`;

/**
 * Render a bundled legal document as a complete HTML page.
 *
 * @param {{title: string, last_updated: string, banners: Array<object>, sections: Array<object>}} document
 *   A document from `src/app/content/`.
 * @param {string} productName - The app the document belongs to, shown above the title.
 * @returns {string} The whole page, ending in a newline.
 */
const renderLegalPage = (document, productName) => {
  const updated = formatDate(document.last_updated);
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(document.title)} | ${escapeHtml(productName)}</title>
    <meta
      name="description"
      content="The ${escapeHtml(
        document.title,
      )} for ${escapeHtml(productName)}, last updated ${escapeHtml(updated)}."
    />
    <style>
${STYLES}
    </style>
  </head>
  <body>
    <main>
      <header>
        <p class="eyebrow">${escapeHtml(productName)}</p>
        <h1>${escapeHtml(document.title)}</h1>
        <p class="updated">
          Last updated
          <time datetime="${escapeHtml(document.last_updated)}"
            >${escapeHtml(updated)}</time
          >
        </p>
      </header>
${document.banners.map(renderBanner).join('\n')}
${document.sections.map(renderSection).join('\n')}
      <footer>
        <p>
          This page carries the same text as the ${escapeHtml(
            document.title,
          )} screen inside ${escapeHtml(productName)}.
        </p>
      </footer>
    </main>
  </body>
</html>
`;
};

// The root page carries no document of its own, so it adds the card and link
// rules the document pages have no use for.
const INDEX_STYLES = `
      .documents {
        display: grid;
        gap: 16px;
      }

      .documents a {
        display: block;
        padding: 28px;
        border: 1px solid var(--edge);
        border-radius: 12px;
        background: var(--surface);
        color: inherit;
        text-decoration: none;
      }

      .documents a:hover,
      .documents a:focus-visible {
        border-color: var(--brand);
      }

      .document-title {
        display: block;
        font-size: 23px;
        font-weight: 600;
        letter-spacing: -0.01em;
      }

      .document-updated {
        display: block;
        margin-top: 6px;
        color: var(--ink-soft);
        font-size: 15px;
      }

      @media (max-width: 540px) {
        .documents a {
          padding: 20px;
        }
      }`;

/**
 * Render the link to one published document.
 *
 * @param {{pageName: string, title: string, lastUpdated: string}} document
 *   A document published beside the root page.
 * @returns {string} Its markup.
 */
const renderDocumentLink = document => `        <a href="${escapeHtml(
  document.pageName,
)}">
          <span class="document-title">${escapeHtml(document.title)}</span>
          <span class="document-updated"
            >Last updated ${escapeHtml(formatDate(document.lastUpdated))}</span
          >
        </a>`;

/**
 * Render the root page of the published legal site.
 *
 * Anyone who trims the policy URL back to the site root lands here, a Play
 * reviewer included, so the root is a page rather than a 404.
 *
 * @param {Array<{pageName: string, title: string, lastUpdated: string}>} documents
 *   Every document published beside this page.
 * @param {string} productName - The app the documents belong to.
 * @returns {string} The whole page, ending in a newline.
 */
const renderLegalIndexPage = (documents, productName) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Legal | ${escapeHtml(productName)}</title>
    <meta
      name="description"
      content="The published legal documents for ${escapeHtml(productName)}."
    />
    <style>
${STYLES}
${INDEX_STYLES}
    </style>
  </head>
  <body>
    <main>
      <header>
        <p class="eyebrow">${escapeHtml(productName)}</p>
        <h1>Legal</h1>
        <p class="updated">
          The documents below carry the same text as the matching screens inside
          ${escapeHtml(productName)}.
        </p>
      </header>
      <nav class="documents">
${documents.map(renderDocumentLink).join('\n')}
      </nav>
    </main>
  </body>
</html>
`;

module.exports = { renderLegalPage, renderLegalIndexPage };
