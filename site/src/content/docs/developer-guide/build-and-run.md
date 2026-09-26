---
title: Build and run a debug build
description: Set up the toolchain and run BrainChip Connect on a phone or an emulator.
sidebar:
  order: 1
---

This page takes a fresh clone of the repository to a debug build running on a
device. The app is offline by design: it needs no environment variables and
talks to no server, so nothing here asks you for a key or an account.

## Prerequisites

| Tool | Version | Used for |
| --- | --- | --- |
| Git | any recent | Cloning the repository |
| Node.js | 20 or later | Metro, the tests and the scripts |
| npm | the one bundled with Node.js | Installing the locked dependency tree |
| Ruby and Bundler | see `.ruby-version` | CocoaPods on iOS and fastlane |
| Watchman | any recent | Faster file watching for Metro |
| Android Studio with the SDK, platform tools and a JDK 17 or later | | Android builds |
| Xcode with its command line tools | | iOS builds, macOS only |

Check what you have:

```sh
node -v
npm -v
ruby -v
bundle -v
```

## Clone and install

```sh
git clone https://github.com/Brainchip-Inc/BrainChip-Connect.git
cd BrainChip-Connect
npm ci
```

:::note
`package-lock.json` is committed and npm is the only supported package
manager. `npm ci` installs exactly the locked tree, and its `postinstall` step
runs patch-package, which applies the repository's patch to
`react-native-ble-plx`. Check the install log for `react-native-ble-plx@3.5.0 ✔`.
:::

## Android

Before your first development build, create
`android/app/src/debug/AndroidManifest.xml` by hand. It is local-only and
ignored by git, so a fresh checkout does not have it.

:::caution
Without that file the app cannot reach the Metro dev server and stops on a
red screen reading `Unable to load script`. The file only needs to declare the
`android.permission.INTERNET` permission and set `usesCleartextTraffic` on its
`<application>` element; a release build never includes it.
:::

With an emulator running, or a phone connected with USB debugging on, start
Metro in one terminal and the app in another:

```sh
npm start
```

```sh
npm run android
```

![The device list of a debug build, listing one AkidaTag](../../../assets/screenshots/discover-devices.png)

## iOS

Install the native dependencies once, then run on the simulator:

```sh
cd ios
bundle install
bundle exec pod install
cd ..
npm run ios
```

A physical iPhone needs signing set up in Xcode: open
`ios/BrainChipConnect.xcworkspace`, select the `BrainChipConnect` target,
turn on *Automatically manage signing* and choose your team.

## A debug APK that runs without Metro

A plain `./gradlew assembleDebug` produces an APK that still fetches its
JavaScript from Metro at run time. To hand someone a debug build that runs
with no cable and no laptop, use the script that bundles the JavaScript in
first:

```sh
scripts/build-standalone-debug-apk.sh
```
