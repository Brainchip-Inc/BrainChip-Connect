# Google Play store listing pack

The reviewed source of truth for what the Play Console shows. A person puts it
into the Console; no build ever does. This pack exists because Play holds every
track, internal testing included, until the "Set up your app" tasks are
complete, so the listing is what unblocks testers rather than a launch chore.

## Where each piece lives

| Piece | Path |
| --- | --- |
| App name, 30 characters | `fastlane/metadata/android/en-US/title.txt` |
| Short description, 80 characters | `fastlane/metadata/android/en-US/short_description.txt` |
| Full description, 4000 characters | `fastlane/metadata/android/en-US/full_description.txt` |
| Store icon, 512x512, 32-bit PNG | `fastlane/metadata/android/en-US/images/icon.png` |
| Feature graphic, 1024x500 | `fastlane/metadata/android/en-US/images/featureGraphic.png` |
| Phone screenshots, 1080x1920 | `fastlane/metadata/android/en-US/images/phoneScreenshots/` |
| Privacy policy page | `site/src/content/docs/privacy-policy.md`, published as `privacy-policy.html` |
| Data safety answers | `docs/store/data-safety.md` |
| Pre-registration QR code | `docs/store/pre-registration-qr.svg`, `.png` |

The layout under `fastlane/metadata/android/en-US/` is fastlane supply's
standard one, so the files are where any Android release tool expects them.

## Nothing here is uploaded automatically, on purpose

`fastlane/Fastfile` sets `skip_upload_metadata`, `skip_upload_images`,
`skip_upload_screenshots` and `skip_upload_changelogs`, and `docs/releasing.md`
says why: a build must never overwrite the Console's listing with whatever
happens to be on a branch. Adding this pack does not change that, and it should
stay that way. Treat these files as the reviewed copy a human transcribes, not
as an upload source.

## How each asset was made

**Icon.** Resampled from the app's own 1024x1024 master,
`ios/BrainChipConnect/Images.xcassets/AppIcon.appiconset/Icon-1024.png`, with
nothing redrawn, so the store icon is the icon on the home screen:

```sh
magick ios/BrainChipConnect/Images.xcassets/AppIcon.appiconset/Icon-1024.png \
  -colorspace sRGB -filter Lanczos -resize 512x512 -depth 8 -alpha set \
  -strip PNG32:fastlane/metadata/android/en-US/images/icon.png
```

**Feature graphic.** The official `_BrainChip_LOGO - Light.png` lockup on a
BrainChip blue gradient. The logo file is a brand asset held outside this
repository, so regenerating it means getting that file from the brand owner.

**Screenshots.** Real captures from a Samsung SM-S711U over
`adb exec-out screencap -p`, with an AkidaTag board connected over Bluetooth
throughout. Device chrome is cropped off (the status bar, the navigation bar
and the Samsung edge-panel handle) and the result is matted onto a 1080x1920
canvas, because Play wants 9:16 and the phone's own screen is 9:19.5. No app
pixel is redrawn, retouched or staged.

**Pages.** The policy page is generated, never hand-written. See below.

## The privacy policy page regenerates, it is not edited

`site/src/content/docs/privacy-policy.md` is rendered from `src/app/content/`
by `npm run pages:render`, so the hosted page and the in-app screen cannot
disagree. `__tests__/pages.test.ts` fails if the committed page drifts
from the content, which makes regenerating part of any change to the wording.
Never edit the Markdown by hand.

Only the policy is published. Play requires a privacy policy URL and asks for
no terms, and the app already shows its own terms on first run, so hosting a
second page would only be another copy to keep in step. `DOCUMENTS` in
`scripts/render-pages.js` is where the terms would go back if that
changes.

The text itself is legal copy under separate review. Regenerating publishes it;
it does not author it.

Hosting is GitHub Pages, published by `.github/workflows/pages.yml`, which
builds the documentation site in `site/` and puts the policy at
`https://brainchip-inc.github.io/BrainChip-Connect/privacy-policy.html`. The
Console needs that URL in two places, App content → Privacy policy and the
store listing.

The published site is `site/` and nothing else: the guides, the policy and
the landing page that links them. Pointing Pages at `docs/` instead would put
this pack, the release procedure and the rest of the folder on the open
internet while the repository is not public, so the workflow builds the one
directory. Adding a page under `site/src/content/docs/` publishes it.

## Open before public release

The Privacy Policy wording is going to legal review before the app is released
publicly, and it is expected to change there. Two things are already known to
need correcting in `src/app/content/privacyPolicy.ts`, and both are held for
that review rather than being edited piecemeal:

- The "Sensor Data" item lists environmental sensor readings. The app reads
  none: there is no environmental sensor code in `src/` and no characteristic
  delivers one. That reference goes.
- The same item lists IMU readings. The accelerometer and gyroscope charts on
  the live screen are filled by `simulateData` in `useLiveSensorStore`, not
  read from the board, so the claim is ahead of the build.

The same list appears on the in-app About screen via `useAboutStore.ts`, so a
change to one has to be made in the other or the app will contradict its own
policy.

Neither affects the Data Safety answers. Play counts data as collected when it
leaves the device, the policy states plainly that nothing does, and a release
build has no `INTERNET` permission to make it possible.

## The pre-registration QR code

Encodes `https://play.google.com/store/apps/details?id=com.brainchip.connect`,
which is fixed by the package name and needs no Console setting. Error
correction level H, so a logo can be dropped into the middle later without
breaking it. The SVG is the one to send to print.

It will not resolve until the listing is live. Until then it returns a Play
"item not found" page, so it must not go on anything printed or published yet.
