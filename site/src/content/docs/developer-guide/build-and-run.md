---
title: Build and run a debug build
description: Set up the toolchain and run BrainChip Connect on a phone or an emulator.
sidebar:
  order: 2
---

This page takes a fresh clone of the repository to a debug build running on
a device. The app is offline by design: it needs no environment variables
and talks to no server, so nothing here asks you for a key or an account.

## Prerequisites

| Tool | Version | Used for |
| --- | --- | --- |
| Git | any recent | Cloning the repository |
| Node.js | 20 or later | Metro, the tests and the scripts |
| npm | the one bundled with Node.js | Installing the locked dependency tree |
| Ruby and Bundler | 3.2.2, as `.ruby-version` says | CocoaPods on iOS |
| Watchman | any recent | Faster file watching for Metro |
| Android Studio, with the SDK, the platform tools and a JDK 17 or later | | Android builds |
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
manager. `npm ci` installs exactly the locked tree, and its `postinstall`
step runs patch-package, which applies the repository's patches to
`react-native-ble-plx` and `react-native-screens`. Check the install log for
`react-native-ble-plx@3.5.0 ✔`: on a version mismatch patch-package reports
the failure but still exits successfully, so a drifted install silently
ships without the Android fix. Use `npm install` only when you mean to change
a dependency, and commit the updated lockfile with it.
:::

## Android

Set `ANDROID_HOME` and make sure `adb` is on your `PATH`. Start an emulator
from Android Studio, or connect a phone with USB debugging on, and check that
it is listed:

```sh
adb devices
```

Before your first development build, create
`android/app/src/debug/AndroidManifest.xml` by hand. It is local-only and
ignored by git, so a fresh checkout does not have it.

:::caution
Without that file the app cannot reach the Metro dev server and stops on a
red screen reading `Unable to load script`. The file only needs to declare
the `android.permission.INTERNET` permission and set `usesCleartextTraffic`
on its `<application>` element; a release build never includes it. "The app
is offline by design" in `AGENTS.md` says exactly what the file must contain.
:::

Start Metro in one terminal and the app in another:

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
turn on *Automatically manage signing* under *Signing & Capabilities* and
choose your team. Enable Developer Mode on the phone when it asks, and trust
the developer certificate if prompted.

## A debug APK that runs without Metro

A plain `./gradlew assembleDebug` produces
`android/app/build/outputs/apk/debug/app-debug.apk`, which still fetches its
JavaScript from Metro at run time and red-screens with `Unable to load
script` once the dev server is gone. To hand someone a debug build that runs
with no cable and no laptop, use the script that bundles the JavaScript in
first:

```sh
scripts/build-standalone-debug-apk.sh
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

The generated bundle and image assets are ignored by git, so running the
script leaves nothing to commit. "The custom recipe a sideloaded debug build
needs" in `AGENTS.md` explains why a plain build cannot do this on its own.

## When a build misbehaves

| Symptom | Fix |
| --- | --- |
| `EADDRINUSE: address already in use :::8081` | Another Metro is running. Find it with `lsof -nP -iTCP:8081 -sTCP:LISTEN`, stop it, and run `npm start` again. |
| Changes not showing up | Stop Metro and restart it with `npm start --reset-cache`. |
| `Signing for "BrainChipConnect" requires a development team` | Choose your team under *Signing & Capabilities* in Xcode. |
| `No Podfile found` | Run `bundle exec pod install` inside `ios/`, not the repository root. |
| iOS build breaks after pulling or changing dependencies | Run `bundle install`, then `bundle exec pod install` in `ios/`. If that is not enough, delete `~/Library/Developer/Xcode/DerivedData` and install the pods again. |
| Android build breaks after changes | `cd android && ./gradlew clean && cd ..`, then `npm run android`. |

A full clean, when nothing else helps:

```sh
rm -rf node_modules ios/Pods ios/Podfile.lock ~/Library/Developer/Xcode/DerivedData
npm ci
bundle install
cd ios && bundle exec pod install && cd ..
```

`scripts/clean_generated_files.sh` lists the generated files the repository
ignores, and deletes them with `--apply`.
