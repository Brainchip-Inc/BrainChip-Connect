# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## One name per thing: BrainChip Connect, AkidaTAG, `com.brainchip.connect`

The app is BrainChip Connect, the board is AkidaTAG, and its firmware lives in
`Brainchip-Inc/AkidaTAG`. The repo carries no compatibility aliases for the
earlier "Spark" naming: no re-export of the old module path, and no fallback
read of the old `@spark_*` acceptance keys, which
`__tests__/acceptanceStorage.test.ts` pins by asserting that a device carrying
only those keys is asked to accept again. Apart from that test and this
paragraph, a "Spark" reference anywhere is a leftover.

Two identifiers are duplicated across files that no build step keeps in sync:

- `com.brainchip.connect` is the Android `applicationId`, the Android
  `namespace` and the iOS `PRODUCT_BUNDLE_IDENTIFIER`. The two platforms
  deliberately share one string.
- `BrainChipConnect` is the npm package name, the Gradle root project, the
  Xcode project, target and `PRODUCT_NAME`, and the React Native component
  registered from `app.json`. `getMainComponentName()` in `MainActivity.kt` and
  `startReactNative(withModuleName:)` in `AppDelegate.swift` repeat that last
  one as a literal; a mismatch there builds fine and fails at launch with no
  view mounted.

## BLE model transfer is pinned to firmware `model_meta_t`

`src/services/ble/bleManager.ts` mirrors a wire protocol owned by the AkidaTAG
firmware repo. When `model_meta_t` gains a field, the app must both extend the
CRC header in `computeCombinedCRC32` and write the new characteristic during the
INFO phase; getting only one half right produces either an `INFO CRC FAIL` on
the board or a model that loads with zeroed metadata.

The authoritative counterparts, read-only from this repo, are
`utils/send_model_via_ble.py` (working reference sender) and
`core/interface/ble_services/file_transfer.c` in the AkidaTAG firmware repo.
Two tests pin the app to them, one per half of the contract:
`__tests__/bleModelInfoCrc.test.ts` fixes the header layout to an exact CRC, and
`__tests__/bleModelInfoTransfer.test.ts` replays a whole `sendModelZip` against
a fake peripheral that rebuilds `model_meta_t` from the characteristics it
actually received. A firmware protocol bump means updating both deliberately.

The two sides also disagree on where `model_name` comes from: the app packs the
CRC header's name from `info.yaml`'s `app`, while the firmware derives it from
the basename of the `fs_name` path, which the app builds from the info-bin
filename prefix (`kws_program_info.bin` -> `/model_meta/kws`). Every current
package agrees on both, but a package whose `app` differs from its info-bin
prefix fails the INFO CRC with no diagnostic naming the cause.

## An AkidaTAG board is recognised by its manufacturer data, never by name or UUID

The firmware advertises no service UUID at all: the 128-bit value it used to
put in its scan response was the permanent factory serial, and a value that
never changes defeats the rotating private address. So the only thing in the
advertisement that identifies the hardware is the chip ID in the 12 ASCII
bytes of manufacturer data, which is what `isAkidaTagManufacturerData` in
`src/services/ble/akidaTagAdvertisement.ts` matches on, pinned by
`__tests__/akidaTagAdvertisement.test.ts`. Names are cosmetic and differ between
the tag and the DK, so they must not become a filter.

The serial now arrives instead as the last frame of the `CMD_DEVICE_INFO`
burst. Two consequences follow for the UI: nothing before connecting can show
the device's identity, and anything that does show it has to survive the moment
before the burst lands. `deviceId` is not a substitute; on Android it is the
resolvable private address and rotates every fifteen minutes.

The authoritative counterpart, read-only from this repo, is
`source/core/interface/ble_services/ble_initialization.c` in the AkidaTAG
firmware repo: `adv_manufacturer_data[]` for the advertisement layout and
`send_device_info_response()` for the frame order.

## The app is offline by design

There is no backend. The app was cut over from an internal VPN-only server
before public launch, and nothing in `src/` may reintroduce network access:
no `fetch`, no `process.env`, no download URLs. The three features that used
the server now work locally instead:

- Terms and Privacy content is bundled at build time in `src/app/content/`,
  typed by `src/types/legalContent.ts`. It is legal text under separate
  review, so change it only when the reviewed wording changes.
- Firmware and AI model packages come only from the device's own storage via
  the document picker; there is no "Download From Server" path.
- A device is authorized by being visible over BLE. The firmware has no
  network stack and no authentication handshake, so there is nothing to
  authenticate against.

Released builds declare no internet permission and communicate only over
Bluetooth. `android/app/src/debug/AndroidManifest.xml` adds
`android.permission.INTERNET` and `usesCleartextTraffic` back for development
builds alone, purely so the Metro dev server stays reachable.

## Dependencies are locked, and two pins are load-bearing

`package-lock.json` is committed and npm is the only supported package manager;
CI installs with an unflagged `npm ci` (`.github/workflows/ci.yml`). Two
constraints exist to keep that install working and must not be loosened casually:

- `lottie-react-native` is `~7.3.5`. From 7.4.0 its react-native peer is
  `>=0.84`, which this project does not meet, so a caret range breaks a clean
  install with `ERESOLVE`. Taking newer lottie requires upgrading react-native
  first.
- The lockfile pins `react-native-ble-plx` to 3.5.0, the version
  `patches/react-native-ble-plx+3.5.0.patch` targets. On a version mismatch
  patch-package reports the failure but **exits 0**, so a drifted install
  silently ships without the Android `SafePromise` patch. After any dependency
  change, check the install log for `react-native-ble-plx@3.5.0 ✔`.

Note that `npm ci` re-checks peer satisfiability, so a lockfile built with
`--legacy-peer-deps` will not install. Peer conflicts have to be resolved in
`package.json`, not hidden in the lockfile.

## The custom font families are not bundled

`src/app/theme/theme.tsx` and eleven screens ask for `Inter-Regular`,
`Inter-SemiBold`, `Sora-Bold` and friends, but no font file ships in the
repo: there is no `react-native.config.js`, no `UIAppFonts` entry, and no
font asset under `android/` or `ios/`. Every one of those families falls
back to the platform default at the requested size. So a `fontFamily` on
its own carries no weight, and pairing `fontWeight` with one of these
names is what actually makes text bold. Two elements that look like they
should match can therefore render at different weights.

Matching an existing control means copying how it expresses weight, not
just its family name. Bundling the real faces would change the look of
every screen at once and is its own piece of work.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
