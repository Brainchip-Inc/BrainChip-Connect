# The BrainChip Connect documentation site

The public documentation at https://brainchip-inc.github.io/BrainChip-Connect/:
the user guide, the developer guide and the Privacy Policy. It is a
[Starlight](https://starlight.astro.build) site, written in Markdown under
`src/content/docs/`, and `.github/workflows/pages.yml` builds and publishes it
on every push to `main` that touches it.

## Working on it

The site is its own npm project, separate from the app's, and needs Node.js 22
or later:

```sh
cd site
npm ci
npm run dev
```

`npm run build` writes the site to `dist/`, and `npm run preview` serves that
build at the same path GitHub Pages uses.

## What must not be edited by hand

`src/content/docs/privacy-policy.md` is generated from
`src/app/content/privacyPolicy.ts` by `npm run pages:render`, run from the
repository root, so the hosted policy and the screen inside the app cannot
disagree. `__tests__/pages.test.ts` fails when the two drift.

## The look

`src/styles/brainchip.css` is the whole of the BrainChip look, derived from the
BrainChip presentation template: the colours, the fonts and the header and
footer bands. It is self-contained with `src/fonts/` and the logo files in
`src/assets/`, so the set can be copied into another BrainChip documentation
site as it is. The fonts are Inter and Sora, both under the SIL Open Font
License; their licences sit beside them.
