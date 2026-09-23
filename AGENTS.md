# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## No screen names a board; it names the board that is connected

The app serves more than one board. The AkidaTag and the BrainBoard1500 both
carry the AKD1500 chip, both pass the discovery filter, and both walk the same
update screens, so a fixed model name in anything the user reads is wrong for
whoever is holding the other one. The name comes from the connected device
record through `nameForDevice` in `src/app/store/useBleStore.ts`, which falls
back to the plain noun `device` so a sentence still reads when no name has
arrived. `__tests__/deviceNaming.test.tsx` pins this by driving every update
ending through two boards.

An update is announced after the board may already be gone, so
`useFirmwareUpdate` and `useModelUpdate` take the name when the update starts
and hold it until the user closes the outcome. Reading the store at render
time instead would name the board `device` in exactly the endings that are
about a board that vanished.

Comments and identifiers keep the AkidaTag name only where they really are
about that board, such as the model transfer protocol notes and the firmware
repository they point at. Discovery is not one of those places: see the
manufacturer-data section below.

## One name per thing: BrainChip Connect, AkidaTag, `com.brainchip.connect`

BrainChip Connect is the app, `Brainchip-Inc/AkidaTag` is the firmware repo for
the AkidaTag board. The repo carries no compatibility aliases for the
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

## BLE model transfer is pinned to a specification the firmware owns

The transfer is specified in `docs/ble-model-transfer.md` in the AkidaTag
firmware repo, and that page is the contract: both sides are built from it, and
neither may change shape without it. The app's half is
`src/services/ble/modelTransferProtocol.ts` for the wire format and
`sendModelZip` in `src/services/ble/bleManager.ts` for the session.

**No block size, buffer size or file size belongs in this repository.** The
board names the size it takes bytes in, in every status notification, and the
app paces itself by that. The protocol exists because a 102,236-byte constant
was mirrored in both repositories where it could silently disagree; writing one
down again anywhere here reintroduces exactly that.

The board reports twice for a data transfer and the two mean different things.
`DONE` is the file stored and verified; `READY`, seconds later, is the model
programmed into the Akida chip and proven to infer. Only `READY` is an update
that worked, and `ERR_PROGRAM` is a stored model this board will not run, which
is neither a success nor a failed transfer. `ModelUpdateOutcome` keeps the
three apart, and `describeModelUpdateEnding` is the only place they are put into
words.

When `model_meta_t` gains a field, the app must both extend the CRC header in
`computeCombinedCRC32` and write the new characteristic before `START(INFO)`;
getting only one half right produces either an `ERR_INTEGRITY` on the board or a
model that loads with zeroed metadata.

The authoritative counterparts, read-only from this repo, are
`source/utils/send_model_via_ble.py` (working reference sender) and
`source/core/interface/ble_services/file_transfer.c` in the AkidaTag firmware
repo. Three tests pin the app to them: `__tests__/bleModelInfoCrc.test.ts`
fixes the header layout to an exact CRC,
`__tests__/modelTransferProtocol.test.ts` fixes the frame layouts, and
`__tests__/bleModelTransfer.test.ts` replays whole transfers against a fake
peripheral that enforces the offset, block-boundary and block-size rules and
rebuilds `model_meta_t` from the characteristics it actually received. A
firmware protocol bump means updating all three deliberately.

Two things about this stack bite any code that sends a file over BLE, and both
cost a working transfer rather than failing loudly:

- **The MTU asked for while connecting does not stick.** A link left at the
  23-byte minimum still works and is fifteen times slower, which reads as a slow
  board rather than a bug. Both update paths call `requestLargeMtu` of their own
  accord immediately before sending; the model transfer logs the MTU it ended up
  with under `__DEV__`.
- **A slice of a `Buffer` is not a `Buffer`.** React Native's polyfill returns a
  bare `Uint8Array` from `subarray`, so `copy`, `readUInt32LE` and the rest are
  undefined on it, while Node's Buffer in Jest returns a real Buffer and notices
  nothing. Anything handling chunks takes `Uint8Array` and sticks to methods
  both have.

The two sides also disagree on where `model_name` comes from: the app packs the
CRC header's name from `info.yaml`'s `app`, while the firmware derives it from
the basename of the `fs_name` path, which the app builds from the info-bin
filename prefix (`kws_program_info.bin` -> `/model_meta/kws`). Every current
package agrees on both, but a package whose `app` differs from its info-bin
prefix fails the INFO CRC with no diagnostic naming the cause.

## A board is recognised by its manufacturer data, never by name or UUID

The firmware advertises no service UUID at all: the 128-bit value it used to
put in its scan response was the permanent factory serial, and a value that
never changes defeats the rotating private address. So the only thing in the
advertisement that identifies the hardware is the AKD1500 accelerator id in the
12 ASCII bytes of manufacturer data, which is what `advertisesAkidaAccelerator`
in `src/services/ble/akidaAcceleratorAdvertisement.ts` matches on, pinned by
`__tests__/akidaAcceleratorAdvertisement.test.ts` for the bytes and
`__tests__/deviceDiscovery.test.ts` for what the scan then offers to the list.
Names are cosmetic and differ between boards, so they must not become a filter.

AKD1500 is the AI accelerator, not the board. Every board the app serves
carries one, so nothing about it says which board is being held: it is
labelled "AI Accelerator" on the preview screen and is called `aiAccelerator`
in `DeviceInfo`. Anything that reads it as a device type is wrong, and that is
how the preview screen used to read it.

The serial now arrives instead as the last frame of the `CMD_DEVICE_INFO`
burst. Two consequences follow for the UI: nothing before connecting can show
the device's identity, and anything that does show it has to survive the moment
before the burst lands. `deviceId` is not a substitute; on Android it is the
resolvable private address and rotates every fifteen minutes.

The authoritative counterpart, read-only from this repo, is
`source/core/interface/ble_services/ble_initialization.c` in the AkidaTag
firmware repo: `adv_manufacturer_data[]` for the advertisement layout and
`send_device_info_response()` for the frame order.

## The camera preview is drawn from a wire format the Arduino library owns

Human detection preview frames arrive in chunks on the notify characteristic
the microphone waveform uses, told apart by the command byte. The layout is
specified under "The camera preview frame" in
`examples/bb15_nicla_vision_connect/README.md` of the
`brainboard1500_arduino_library` repository, and `sendPreview` in that
example's `ble_protocol.cpp` is the sender. The app's half is
`src/services/ble/cameraPreview.ts` for the chunk layout and reassembly and
`src/services/image/grayscalePng.ts` for turning a whole image into a PNG data
URI, because React Native cannot draw raw pixels. `__tests__/cameraPreview.test.ts`
pins the layout byte by byte and `__tests__/grayscalePng.test.ts` checks the
PNG against Node's own zlib; a change on either side means updating both
deliberately.

Two things about the preview are deliberate and look like bugs:

- **Frames are skipped on purpose.** The board sends its newest frame, never
  queues, and drops chunks in flight rather than stall the detector. An image
  overtaken before it is whole is discarded, never shown late, and a gap is
  not an error.
- **Detections must never wait on the preview.** Results share the
  characteristic with the chunks, so the chunk handler in `useBleCommandStore`
  does one small copy per notification and encodes only once per whole image.
  Anything heavier there shows up as a lagging detection, not as a slow
  preview.
- **Both demos report events, not state.** "What the board reports" in that
  README is the contract: a keyword when one is heard, `person` once when
  someone arrives, and nothing while they stay or after they leave. The
  shipped firmware never sends `no_person`, so a banner that shows only the
  label reads as frozen from the first detection on, which is why
  `DetectionBanner` shows how long ago the report arrived and why every
  report is a history entry. An earlier build of the board reported every
  frame, eleven times a second, and rewriting the history file per report
  left the app deaf to touches within a minute; `useEventStore` still writes
  the file at most once a second, and `__tests__/detectionFlood.test.ts` pins
  both rules.

## One device session per connection, started in one place

`followConnection` in `useBleCommandStore.ts` is the only thing that starts or
ends a device session: it follows `connectedDevice` in `useBleStore`, and
`App.tsx` calls it once. Screens read the session and never start one. A
screen effect used to do this, and disconnecting from the Profile screen pushed
the device list over the old dashboard instead of resetting to it, so every
reconnect had one more mounted dashboard starting a session; and because
`startNotifications` checked for an existing monitor before an await and
recorded the new one after it, each of those starts opened its own monitor.
Every notification was then parsed, stored and rendered once per monitor,
which repeated history entries, garbled the application list, and slowed the
app a little more with each cycle until the detection banner looked frozen.
`__tests__/deviceSession.test.ts` pins one monitor across connect, disconnect
and reconnect. Anything that leaves the connected board goes through
`BleConnectionHelper.returnToDeviceList`, a navigation reset, never a `navigate`
to the device list.

## Starting an application is a model swap, and the app shows the wait

Only one model fits in the Akida fabric, so Run Application on a
BrainBoard1500 loads the model into the accelerator before the board
acknowledges: measured at about 1.8 s for the keyword model and 1.9 s for the
vision model. `appTransition` in `useBleCommandStore` is the gap between the
command and that acknowledgement, and it is the only thing the two screens
show the wait from; nothing is timed on the phone. `DEPLOY_ACK_TIMEOUT_MS`
there is what the load has to fit inside, so shortening it breaks the
BrainBoard1500 before it breaks anything else.

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
builds alone, purely so the Metro dev server stays reachable. That file is
local-only and has never been tracked: `.gitignore` excludes
`android/app/src/debug/`, so it is absent from a fresh checkout and each
developer writes it by hand before a development build can reach Metro. All it
needs to be is a debug-variant manifest for the Android manifest merger to
overlay on the main one, declaring
`<uses-permission android:name="android.permission.INTERNET" />` and setting
`android:usesCleartextTraffic="true"` on its `<application>` element; the main
manifest sets neither, so no `tools:replace`, and therefore no `tools`
namespace, is required.

## The custom recipe a sideloaded debug build needs

A debug APK built with a plain `./gradlew assembleDebug` still needs Metro
reachable at install time: the React Native Gradle plugin only registers a
JavaScript-bundling task for a variant that is *not* listed in the `react`
block's `debuggableVariants` in `android/app/build.gradle`, which by default
is just `["debug"]`. Handing someone that APK with no dev server running
reproduces exactly the failure "The app is offline by design" describes for a
missing debug manifest: a red screen, except this one reads
`Unable to load script` for the opposite reason, no JavaScript is bundled in
at all rather than no permission to fetch it.

`scripts/build-standalone-debug-apk.sh` is how to hand someone a debug build
that runs with no cable, no dev server and no laptop. It runs
`react-native bundle` into `android/app/src/main/assets` and
`android/app/src/main/res` itself before calling `assembleDebug`. That works
without touching `debuggableVariants`, because the Gradle plugin's own
bundling task is the only thing that would otherwise remove what the script
just placed there, and that task does not exist for a debuggable variant. A
normal `npm run android` against a running Metro is unaffected: nothing here
changes what Gradle does, only what is already sitting in those two folders
before it runs. The generated bundle and image assets are gitignored, so
running the script leaves nothing to commit.

## The only truth about permissions is the merged manifest

The app ships exactly three user-facing permissions, `BLUETOOTH_SCAN` with
`neverForLocation`, `BLUETOOTH_CONNECT` and `POST_NOTIFICATIONS`, on a floor of
`minSdkVersion 33` (`android/build.gradle`). It asks for no location on either
platform: from Android 12 a `neverForLocation` scan needs none, and iOS has
never required one for a Bluetooth central. The flag is declared in the app's
own manifest rather than inherited from the BLE stack, because the stack reads
it back out of the installed package at runtime and it decides whether the
system Location toggle must be on before a scan will run.

What this repository declares is not what ships. Read
`android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml`
after `./gradlew :app:processReleaseManifest`, and
`android/app/build/outputs/logs/manifest-merger-release-report.txt` for who
contributed what. Three traps each cost a permission that looks removed:

- A dependency's permission goes only when it is overridden with
  `tools:node="remove"`. Deleting the line from this manifest achieves nothing.
- `<uses-permission-sdk-23>` is a distinct element and needs its own marker.
  The `rxandroidble` AAR behind `react-native-ble-plx` declares the location
  pair that way.
- The merger implies `READ_EXTERNAL_STORAGE` from `react-native-fs`'s
  `WRITE_EXTERNAL_STORAGE`, and goes on implying it after the write is removed,
  so both need a marker.

`react-native-ble-plx`'s own module manifest contributes nothing: its Gradle
build points `manifest.srcFile` at `AndroidManifestNew.xml`, which is empty, so
every BLE permission arrives from the `rxandroidble` AAR instead.

`POST_NOTIFICATIONS` is declared and requested although nothing can post a
notification yet: there is no notification library anywhere in the tree, no
native notification code, and `useNotificationStore` holds placeholder data. It
is held deliberately for the feature it is meant for, so a reader hunting for
its caller will not find one. iOS needs no counterpart key, because a local
notification prompt belongs to the notification framework rather than the
Info.plist, and `UIBackgroundModes` stays absent until something in `src/`
genuinely runs while backgrounded.

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

## Releases go through `release`, and that merge is never squashed

`docs/releasing.md` is the procedure and `.github/workflows/release.yml` is the
pipeline. Four things about it will not be obvious from reading either:

- **Feature pull requests still squash into `main`. A release pull request,
  `main` into `release`, must be merged with a real merge commit.** A squash
  invents a commit `main` does not have, the branches then diverge for good, and
  every later release pull request conflicts. The pipeline's first step fails
  the release when the merge commit has one parent, which is the only cheap
  moment to catch it.
- **`VERSION` at the root is the only place a version is written.** Nothing in
  `android/app/build.gradle` carries one: it reads `APP_VERSION_NAME` and
  `APP_VERSION_CODE` from the environment and falls back to `0.0.0-dev` / `1`,
  and `scripts/release-version.sh` is what turns `VERSION` into both plus the
  tag. `package.json`'s `version` is unused and is not kept in step.
- **The release build type has no debug-key fallback any more.** With no upload
  keystore in the environment the release signing config does not exist and
  Gradle refuses `assembleRelease`, `bundleRelease` and `packageRelease`, so
  `./gradlew build` now fails too. That is deliberate: Play ties an app to the
  key of its first upload, so a debug-signed bundle it accepted could never be
  replaced.
- **`Gemfile.lock` is committed**, unlike in a stock React Native project,
  because the pipeline has to install the exact fastlane it was tested with.
  `scripts/clean_generated_files.sh` therefore does not delete it.

The track is chosen by labelling the release pull request. While the app is
internal-only, every release is labelled `pre-release`, which publishes to the
Play internal testing track and goes live for the named testers at once; that is
the designed path for this phase, not a workaround. `release` goes to the
production track as a draft for a human to roll out, and is for the public
launch later.

Key handling and the one-time account setup are deliberately not in this
repository, because it is expected to become public and git history cannot be
redacted afterwards. They are in `BrainChip-Connect-release-operations.md`, held
outside version control. Keep it that way: nothing about how keys are created,
rotated or recovered belongs in a file here.

## The store listing is committed but never uploaded by a build

`docs/store/README.md` is the index of the Play listing pack: the copy and
images under `fastlane/metadata/android/en-US/`, the Data safety answers, and
the pre-registration QR code. It is the reviewed text a person transcribes into
the Console, which is why `fastlane/Fastfile` keeps `skip_upload_metadata`,
`skip_upload_images`, `skip_upload_screenshots` and `skip_upload_changelogs`.
Putting the files in supply's standard layout did not wire them to a release,
and wiring them up would let any branch overwrite the live listing.

`docs/pages/` is the hosted policy, generated by `npm run pages:render` from
`src/app/content/` and never edited by hand. Play demands a public policy URL,
so that page is a published promise while the app screen is a second copy of the
same words; `__tests__/pages.test.ts` fails when the two drift, which makes
regenerating part of any change to the wording. The terms are deliberately not
published: Play does not ask for them and the app shows its own on first run.
`DOCUMENTS` in `scripts/render-pages.js` is the one list that decides
what is published, and `index.html` is generated from it too.

**That directory is the whole of the public web site and the rest of `docs/` is
not public.** `.github/workflows/pages.yml` uploads `docs/pages` as the site
root, so the policy is at
`https://brainchip-inc.github.io/BrainChip-Connect/privacy-policy.html` while
the repository stays private. Pointing Pages at `docs/` would publish the store
pack and the release procedure with it. The workflow re-renders rather than
copying the committed HTML and fails when the two disagree, so a content change
that skips `npm run pages:render` stops the deployment instead of serving stale
text. Anything dropped into `docs/pages/` is published by the next run.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
