/**
 * Write the hostable copies of the app's Terms and Privacy Policy.
 *
 * Google Play needs a privacy policy at a public URL, and that page must not be
 * allowed to drift from the one the app shows. Run `npm run legal:render` after
 * changing anything in `src/app/content/`; `__tests__/legalPages.test.ts` fails
 * when the committed pages no longer match it.
 *
 * @format
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ts = require('typescript');
const { renderLegalPage } = require('./legalPageTemplate');

const PRODUCT_NAME = 'BrainChip Connect';
const OUTPUT_DIRECTORY = 'docs/legal';

// Only the Privacy Policy is published. Play requires it at a public URL; it
// asks for no terms, and the app already shows its own on first run. Adding
// `termsAndConditions.ts` here is all it would take if that changes.
const DOCUMENTS = [
  {
    modulePath: 'src/app/content/privacyPolicy.ts',
    exportName: 'PRIVACY_POLICY',
    pageName: 'privacy-policy.html',
  },
];

const repositoryRoot = path.join(__dirname, '..');

/**
 * Read one value exported by a TypeScript module, with no build step.
 *
 * @param {string} modulePath - Path to the module, relative to the repository root.
 * @param {string} exportName - Name of the exported binding to return.
 * @returns {object} The exported value.
 */
const loadTypeScriptExport = (modulePath, exportName) => {
  const source = fs.readFileSync(path.join(repositoryRoot, modulePath), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const sandbox = { exports: {} };
  sandbox.module = sandbox;
  // The content modules import their types and nothing else, and the transpile
  // drops a type-only import, so the stub is never actually called.
  sandbox.require = () => ({});
  vm.runInNewContext(outputText, sandbox, { filename: modulePath });
  return sandbox.exports[exportName];
};

/**
 * Render every legal document to its page.
 *
 * @returns {Array<{pageName: string, html: string}>} Each page and its markup.
 */
const renderLegalPages = () =>
  DOCUMENTS.map(({ modulePath, exportName, pageName }) => ({
    pageName,
    html: renderLegalPage(
      loadTypeScriptExport(modulePath, exportName),
      PRODUCT_NAME,
    ),
  }));

/**
 * Write every rendered page into `docs/legal/`, reporting each one written.
 */
const main = () => {
  const directory = path.join(repositoryRoot, OUTPUT_DIRECTORY);
  fs.mkdirSync(directory, { recursive: true });
  for (const { pageName, html } of renderLegalPages()) {
    fs.writeFileSync(path.join(directory, pageName), html, 'utf8');
    console.log(`wrote ${OUTPUT_DIRECTORY}/${pageName}`);
  }
};

if (require.main === module) main();

module.exports = { renderLegalPages, OUTPUT_DIRECTORY };
