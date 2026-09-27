# Developing BrainChip Connect

BrainChip Connect is a React Native and TypeScript app that communicates with
compatible boards over Bluetooth Low Energy (BLE). This guide is for developers
and coding assistants changing the app. See [CONTRIBUTING.md](CONTRIBUTING.md) for
contribution conventions and [docs/run.md](docs/run.md) for troubleshooting.

## Set up the project

Use Node.js 20 or newer and npm. From the repository root, run:

```sh
npm ci
```

Keep `package-lock.json` committed. Installation applies the native dependency
fixes in `patches/`; check that patch-package reports success after changing a
dependency. Keep patched package versions aligned with their patch filenames.
The `lottie-react-native` version range is constrained by this project's React
Native version; check peer compatibility before upgrading either.

### Android

Install Android Studio, JDK 17, and the Android SDK. Use the SDK, build-tools and
NDK versions declared in `android/build.gradle`. Configure `ANDROID_HOME` and
put the SDK platform-tools on your path. The app requires Android 13 (API 33)
or newer.

Create the development manifest described below, then start Metro from the
repository root:

```sh
npm start
```

In a second terminal, with an emulator running or a phone connected with USB
debugging enabled:

```sh
npm run android
```

Use a physical phone and a compatible board to validate BLE behavior.

### iOS

On macOS, install Xcode and its command-line tools, Ruby as specified in
`Gemfile`, and Bundler. Install the native dependencies:

```sh
bundle install
cd ios
bundle exec pod install
cd ..
```

Start Metro with `npm start`, then run `npm run ios` in another terminal for
the simulator. For physical-device development, open
`ios/BrainChipConnect.xcworkspace` in Xcode and configure your own development
team locally. The simulator can exercise UI flows, but BLE testing needs a
physical device. Re-run the CocoaPods installation after native dependency
changes.

## The app is offline by design

The app uses BLE and local files. Firmware and model packages are selected with
the document picker, and terms and privacy content is bundled from
`src/app/content/`. Keep app functionality independent of a backend or runtime
network downloads.

Android development builds need Metro access. Create the gitignored file
`android/app/src/debug/AndroidManifest.xml` with:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET" />
    <application android:usesCleartextTraffic="true" />
</manifest>
```

Keep these development-only declarations out of the main manifest. When
changing Android permissions, inspect the merged manifest as well as the app's
source manifest because dependencies can contribute permissions.

## The custom recipe a sideloaded debug build needs

A normal debug APK loads its JavaScript from Metro. To build one that runs
without Metro, use:

```sh
scripts/build-standalone-debug-apk.sh
```

The script bundles JavaScript and image assets before building
`android/app/build/outputs/apk/debug/app-debug.apk`. Its generated assets are
ignored by git. Firmware for a board is built in that board's firmware project;
this command builds the phone app.

## Run checks

From the repository root:

```sh
npm run lint
npx tsc --noEmit
npm test -- --runInBand
```

Tests live in `__tests__/`. Use the existing fake BLE peripherals to test
protocol behavior, then validate hardware changes on a phone and board through
connect, run, stop, disconnect and reconnect. Native changes also need a build
on the affected platform. Do not edit `CHANGELOG.md` or generated files by hand.
If reviewed legal wording changes, update its source in `src/app/content/` and
run `npm run pages:render`; `__tests__/pages.test.ts` checks the generated pages.

## How the app talks to a board

- `src/services/ble/bleManager.ts` owns scanning, connections, GATT operations
  and file transfers. `akidaAcceleratorAdvertisement.ts` matches accelerator
  manufacturer data. Advertised names are display text, not discovery filters.
- `src/app/store/useBleStore.ts` owns the connected device. Use `nameForDevice`
  for user-facing device names. Read a board's serial from device information
  after connecting; a BLE connection identifier is not a permanent serial.
- `followConnection` in `src/app/store/useBleCommandStore.ts` starts and ends
  one notification session per connection. `App.tsx` installs it once. Screens
  read that session instead of creating their own notification monitors.
- `bleCommands.ts` and `buildCommand.tsx` define outgoing commands;
  `bleParser.ts` decodes text responses and binary frames into `ParsedResponse`.
  `useBleCommandStore.ts` handles those responses and updates shared state.
- Start and stop controls use `deployApp`, `stopApp` and `appTransition`, waiting
  for the board's acknowledgement before reporting success. Disconnect paths
  use `BleConnectionHelper.returnToDeviceList` to reset navigation.
- Model transfers use `modelTransferProtocol.ts` and `useModelUpdate`.
  Use the sizes reported by the board instead of duplicating firmware limits.
  `DONE` means stored and verified; `READY` means the model can run. Firmware
  updates use `useFirmwareUpdate` and the services under `src/services/firmware/`.

Keep wire formats aligned with the board firmware and pin changes with byte-level
fixtures. `bleModelTransfer.test.ts` exercises transfers against a fake board;
`deviceSession.test.ts` checks notification ownership across reconnects.

## Add support for a demo

1. Establish the board-side contract first: its application name, metadata,
   command acknowledgements, detection messages and optional sensor frames.
   Follow the implemented keyword and vision paths as examples. Adding app UI
   does not install a demo or add its protocol to the board firmware.
2. Add the app identifier to `AppType` in
   `src/app/store/useLiveSensorStore.ts` and the `appTypeMapping` in
   `useBleCommandStore.ts`. The application list comes from board responses;
   ensure the new metadata maps to the intended identifier.
3. Extend commands and `ParsedResponse` only when the protocol needs new data.
   Handle it in `useBleCommandStore.ts`, preserving notification ownership,
   acknowledgement handling and disconnect cleanup.
4. Add the icon and application presentation in
   `src/app/screens/Device/DeviceApplicationScreen.tsx`, then the appropriate
   output or sensor view in `src/app/screens/LiveSensorDataScreen.tsx`.
   `DetectionBanner` shows event detections and their age. For runtime controls,
   follow `AppControlsSection` and `src/types/appConfig.ts`, including validation
   and board acknowledgements.
5. Keep streamed data work bounded. Camera chunks are assembled by
   `cameraPreview.ts` and shown only when a frame is complete. Event history
   uses `useEventStore.ts`; preserve its write throttling during frequent reports.
6. Add parser, store and UI tests for the new messages, malformed input,
   transitions and reconnect behavior. Use `cameraPreview.test.ts`,
   `appTransition.test.ts` and `detectionFlood.test.ts` as focused examples.
   Verify the demo on hardware without changing behavior for existing demos.

Keep this guide focused on current contributor workflows and code contracts.
Update the relevant instructions when a change makes them inaccurate.
