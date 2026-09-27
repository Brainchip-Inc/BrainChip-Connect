<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/assets/brainchip-logo-dark.svg">
    <img src=".github/assets/brainchip-logo.svg" alt="BrainChip" width="260">
  </picture>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" alt="License: Apache 2.0"/>
  <img src="https://img.shields.io/badge/platform-Android%2013%2B-3DDC84.svg?logo=android&logoColor=white" alt="Platform: Android 13 or later"/>
  <img src="https://img.shields.io/badge/iOS-to%20follow-lightgrey.svg?logo=apple&logoColor=white" alt="iOS to follow"/>
  <img src="https://img.shields.io/badge/React%20Native-0.83-20232A.svg?logo=react&logoColor=61DAFB" alt="React Native 0.83"/>
  <img src="https://img.shields.io/badge/connects%20over-Bluetooth%20LE-0082FC.svg?logo=bluetooth&logoColor=white" alt="Connects over Bluetooth Low Energy"/>
  <img src="https://img.shields.io/badge/hardware-AKD1500%20boards-FF6A00.svg" alt="Hardware: AKD1500 boards"/>
</p>

<!-- TBD: the three link targets below wait on confirmation of the public
     Developer Hub page, the community link and the shop or preorder page. -->
<p align="center">
  <a href="TBD"><img src="https://img.shields.io/badge/BrainChip%20Developer%20Hub-TBD-0061ED.svg" alt="BrainChip Developer Hub"/></a>
  <a href="TBD"><img src="https://img.shields.io/badge/Community-TBD-5865F2.svg" alt="BrainChip community"/></a>
  <a href="TBD"><img src="https://img.shields.io/badge/Shop-TBD-FF6A00.svg" alt="BrainChip Shop"/></a>
</p>

# BrainChip Connect: the companion app for Akida edge AI devices

<p align="center">
  <a href="#what-the-app-does">Features</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#quickstart">Quickstart</a> ·
  <a href="#documentation">Documentation</a> ·
  <a href="#get-the-hardware">Hardware</a> ·
  <a href="#community-and-support">Community</a> ·
  <a href="#license">License</a>
</p>

BrainChip Connect is the phone app for BrainChip's edge AI devices built on the
**Akida AKD1500** neuromorphic processor. It finds a board over **Bluetooth Low
Energy**, shows what the board's AI application reports, switches the board
between applications, and sends firmware and AI model updates to it from a
package on the phone. It is the companion app for the
**[AkidaTag](https://github.com/Brainchip-Inc/AkidaTag)**, and it recognises any
board that advertises the AKD1500 accelerator.

> **The app is offline by design.** There is no account, no server and no
> download; released builds declare no internet permission and communicate
> only over Bluetooth. Firmware and model packages are picked from the phone's
> own storage.

The app ships on Android today. The iOS project is in the tree, and it is
released once there is an Apple developer account (see
[docs/releasing.md](docs/releasing.md)).

## What the app does

- **Discover and connect.** Boards are recognised by the AKD1500 accelerator
  id in their advertisement, never by name, so a renamed board is still found.
  The board's serial, firmware and other details arrive once connected.
- **Run the board's applications.** A board carries more than one AI
  application and one model fits in the Akida fabric at a time, so starting an
  application loads its model into the accelerator; the app shows that wait.
- **See what the board detects.** Keyword spotting and person detection
  reports are shown as they arrive and kept as a history, with a live camera
  preview for the vision demo.
- **Edge learning controls.** The keyword demo's on-device learning is driven
  from the phone with the same commands as the board's physical buttons.
- **Firmware updates.** A signed MCUboot firmware image is chosen from the
  phone's storage, checked, and sent to the board over Bluetooth.
- **AI model updates.** A model package is unpacked on the phone and streamed
  to the board with the transfer protocol the firmware specifies, and the app
  reports whether the board stored it and whether it runs.
- **Device settings and status.** Device details, power mode, sensor
  configuration, factory reset and unpairing, with the terms and privacy
  policy bundled in the app.

## How it works

The phone is a Bluetooth Low Energy central and the board is the peripheral.
Every protocol the app speaks is owned by the firmware: the model transfer is
specified in `docs/ble-model-transfer.md` in the
[AkidaTag repository](https://github.com/Brainchip-Inc/AkidaTag), the
advertisement layout and device-info frames in its BLE services, and the app's
tests under [`__tests__/`](__tests__/) pin the app to those layouts byte by
byte. When a wire format changes, it changes in the firmware first.

[AGENTS.md](AGENTS.md) records those contracts and the sharp edges around them:
how a board is recognised, why the model transfer carries no block size, how
the two update paths report their outcomes, and what the permissions really
are. Read the section for the area you are changing before changing it.

<details>
<summary><b>Repository layout</b></summary>

```
App.tsx           the navigation stack, and the one place a device session is followed
index.js          React Native entry point
src/
  app/            screens, the zustand stores, hooks, theme, bundled legal content and images
  components/     shared UI: cards, modals, the detection banner, the camera preview
  services/
    ble/          scanning, the device session, commands, and the model transfer protocol
    firmware/     MCUboot image parsing, signing-key checks, firmware update outcomes
    ota/          the update flows above the BLE layer
    image/        turning a preview frame into a PNG the Image component can show
    storage/      local persistence
  types/          shared types: BLE data, updates, edge learning, routes
__tests__/        jest tests, including the ones that pin the wire formats
android/, ios/    the native projects, begun from the React Native template
patches/          patch-package patches applied by npm ci (see below)
scripts/          release helpers, the standalone debug APK build, the pages renderer
fastlane/         the Android release lanes and the reviewed Play listing pack
docs/             setup, releasing, the store pack, and the published pages
```

</details>

<details>
<summary><b>What the app is built from</b></summary>

Everything is fetched by `npm ci` from `package-lock.json`; nothing third-party
is checked in. The packages the app imports directly:

| Package                                             | What it does in the app                                      |
| --------------------------------------------------- | ------------------------------------------------------------ |
| `react-native`, `react`                             | The framework                                                |
| `react-native-ble-plx`                              | Scanning, connecting, reading, writing and notifications     |
| `@react-navigation/native`, `native-stack`          | Navigation between screens                                   |
| `react-native-screens`, `safe-area-context`         | Native screen containers and safe-area insets for navigation |
| `react-native-paper`                                | Material Design 3 components and the app theme               |
| `lucide-react-native`                               | Icons                                                        |
| `react-native-svg`, `react-native-svg-transformer`  | SVG assets, imported as components                           |
| `zustand`                                           | State: the device session, events, updates                   |
| `@react-native-async-storage/async-storage`         | Local persistence of acceptance and trusted-key records      |
| `@react-native-documents/picker`, `react-native-fs` | Picking and reading firmware and model packages              |
| `react-native-zip-archive`, `js-yaml`               | Unpacking a model package and reading its `info.yaml`        |
| `crc-32`, `buffer`, `cbor-x`, `react-native-base64` | Byte handling: CRCs, framing and encoding for the wire       |
| `@react-native-community/slider`                    | The sensor configuration controls                            |

`NOTICE` lists every fetched component and its licence.

</details>

<details>
<summary><b>The two patches applied by npm ci</b></summary>

`package.json` runs `patch-package` after every install, applying the patches
committed under `patches/`. Both are changes to third-party packages and keep
those packages' licences; `NOTICE` records them.

- **`react-native-ble-plx+3.5.0.patch`, Android only.** With
  `react-native-ble-plx@3.5.0` on React Native 0.83, a BLE monitor that errors
  or is cancelled crashed natively with
  `NullPointerException: Parameter specified as non-null is null: method com.facebook.react.bridge.PromiseImpl.reject, parameter code`.
  On Android, `SafePromise` sometimes rejects with a null or empty `code`, which
  newer React Native does not allow. The patch defaults the code in every
  `reject` overload of `android/src/main/java/com/bleplx/utils/SafePromise.java`:

  ```java
  if (code == null || code.isEmpty()) {
    code = "E_BLE_ERROR";
  }
  ```

- **`react-native-screens+4.27.0.patch`, type-only.** React Native 0.83's
  codegen accepts `React.ElementRef` but not the `React.ComponentRef` that
  react-native-screens 4.27.0 uses in its native command signatures, so the
  Android build failed in `generateCodegenSchemaFromJavaScript`. The patch
  swaps the type under `src/fabric/`; it is erased at runtime. Drop it when
  react-native is upgraded.

The lockfile pins both packages to the versions the patches target. On a
version mismatch patch-package reports the failure but exits 0, so after any
dependency change check the install log for
`react-native-ble-plx@3.5.0 ✔` and `react-native-screens@4.27.0 ✔`. To
regenerate a patch after editing the file under `node_modules`:

```sh
npx patch-package react-native-ble-plx
```

</details>

## Quickstart

You need Node.js 20 or later and npm; Android Studio with the Android SDK and a
JDK 17 or later for Android; Ruby 3.2.2 with Bundler and Xcode for iOS; and a
phone running Android 13 or later with Bluetooth on. Watchman is recommended.

```sh
git clone https://github.com/Brainchip-Inc/BrainChip-Connect.git && cd BrainChip-Connect
npm ci                  # the locked tree, plus the two patches under patches/
npm start               # Metro, in its own terminal
npm run android         # builds and installs the debug app on the connected phone
```

Before the first Android debug build, create `android/app/src/debug/AndroidManifest.xml`
by hand. It is local-only and gitignored, and without it the debug app cannot
reach Metro and stops at `Unable to load script`:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <application android:usesCleartextTraffic="true" />
</manifest>
```

That permission exists in development builds only. The merged release manifest
declares none, which is what keeps the app offline.

For iOS, install the pods first and then run the app:

```sh
cd ios && bundle install && bundle exec pod install && cd ..
npm run ios
```

To hand someone a debug build that runs with no cable, no dev server and no
laptop, bundle the JavaScript in with
`scripts/build-standalone-debug-apk.sh`; a plain `assembleDebug` cannot.

The checks CI runs are the ones to run before pushing:

```sh
npx eslint .
npx tsc --noEmit
npx jest
```

`npm ci` is the supported install. `package-lock.json` is committed, npm is the
only supported package manager, and `npm install` is for when you intend to
change a dependency, committing the updated lockfile with it. Do not use yarn:
it resolves its own tree and silently diverges from what CI installs.
[docs/run.md](docs/run.md) is the full setup guide, including the iOS signing
steps and the troubleshooting list.

## Documentation

- **Documentation site:** <https://brainchip-inc.github.io/BrainChip-Connect/>
- [docs/run.md](docs/run.md): setting up and running the app for the first time
- [docs/releasing.md](docs/releasing.md): how a build reaches Google Play, the
  branch model and the tracks
- [docs/store/README.md](docs/store/README.md): the reviewed Play listing pack
- [AGENTS.md](AGENTS.md): the protocols the app is pinned to, the permissions,
  and the sharp edges
- [CHANGELOG.md](CHANGELOG.md): what shipped in each release
- [CONTRIBUTING.md](CONTRIBUTING.md): pull requests, reporting a problem, and
  the commit format CI enforces

Android releases are automated: merging a pull request from `main` into
`release` builds the app bundle, uploads it to Google Play and writes the
GitHub release. The version comes from the root `VERSION` file alone.

## Get the hardware

- **AkidaTag**, the board this app ships for: firmware and documentation in
  the [AkidaTag repository](https://github.com/Brainchip-Inc/AkidaTag).
  TBD: preorder page.
- **AKD1500**, the accelerator every supported board carries. TBD: shop link.

## Community and support

Hit a problem connecting to a board, or anything else in this repository?
**[Open an issue](https://github.com/Brainchip-Inc/BrainChip-Connect/issues)**
and say what you did, what happened, and which phone and board you used.

- TBD: Developer Hub link, for tools, the model zoo and Akida Cloud
- TBD: community link, for discussion and community help
- TBD: Google Play listing
- [brainchip.com](https://brainchip.com) for the company, the products and how
  to get in touch

## License

This repository is licensed under the **Apache License 2.0**. See
[LICENSE](LICENSE).

It checks in no third-party library. `npm ci`, Gradle and CocoaPods fetch what
the app is built from, and each component keeps its own terms. The two patches
under `patches/` are changes to third-party packages and are offered under
those packages' licences. [NOTICE](NOTICE) carries the consolidated
attributions: the patched packages, the files that came from the React Native
template, the icons that came from Lucide, and every component the build
fetches.

## Contributing

Pull requests that add value to the app are welcome, and the maintainers review
each one. Bug reports are the most useful thing you can send. See
[CONTRIBUTING.md](CONTRIBUTING.md).
