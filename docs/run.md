# BrainChip Connect - Setup and Run Guide

## Overview

This guide is for a new developer setting up and running the app locally for the first time.

- iOS steps are listed first.
- Android steps are listed after iOS.

## Prerequisites

Install these first:

- Git
- Node.js `>= 20` (Node 20 LTS recommended)
- npm
- Ruby + Bundler
- Watchman (recommended for React Native)

Verify:

```bash
node -v
npm -v
ruby -v
bundle -v
```

## Clone and Install Dependencies

```bash
git clone <repository-url>
cd BrainChip-Connect
git checkout <branch-name>
npm install
```

The app is fully offline: it needs no environment variables and talks to no
server. Terms and privacy content is bundled at build time, and firmware and
model packages are picked from the phone's own storage.

## iOS (First)

### 1. Install Xcode Requirements (macOS only)

- Install Xcode from App Store.
- Open Xcode once and accept the license.
- Install Command Line Tools:

```bash
xcode-select --install
```

### 2. Install iOS Native Dependencies

From repo root:

```bash
cd ios
bundle install
bundle exec pod install
cd ..
```

Note:

- You may see a React Native deprecation notice about calling `pod install` directly.
- This is informational and does not block setup.
- Continue using `bundle exec pod install` for local native dependency install.

### 3. Start Metro

From repo root:

```bash
npm start
```

Keep this terminal open.

If you get `EADDRINUSE: address already in use :::8081`, free the port:

```bash
lsof -nP -iTCP:8081 -sTCP:LISTEN
kill <pid>
```

Then run `npm start` again.

### 4. Run iOS on Simulator

In a second terminal:

```bash
npm run ios
```

### 5. Run iOS on Physical iPhone

For real device builds, Xcode must be opened for signing setup.

```bash
open ios/BrainChipConnect.xcworkspace
```

In Xcode:

1. Select project `BrainChipConnect` in the navigator.
2. Select target `BrainChipConnect` -> `Signing & Capabilities`.
3. Turn on `Automatically manage signing`.
4. Choose your Apple Developer `Team`.
5. If needed, set a unique bundle identifier (for example `com.<name>.brainchipconnect`).
6. Connect your iPhone, select it as run destination, then click Run.

Device notes:

- Enable `Developer Mode` on iPhone when prompted.
- Trust the developer certificate/profile if prompted.

## Android

### 1. Install Android Tooling

- Android Studio
- Android SDK
- Android SDK Platform-Tools (`adb`)
- JDK 17+

Set `ANDROID_HOME` and ensure `adb` is in your PATH.

### 2. Start Emulator or Connect Device

- Start an Android emulator from Android Studio, or
- Connect a physical Android device with USB debugging enabled.

Verify:

```bash
adb devices
```

### 3. Run Android App

With Metro already running:

```bash
npm run android
```

If Metro is not running, start it first with `npm start`.

## Optional Cleanup of Generated Files

This repo includes a helper script:

```bash
bash scripts/clean_generated_files.sh
bash scripts/clean_generated_files.sh --apply
```

Use `--apply` to delete known generated files (safe to regenerate later).

## Troubleshooting

- iOS signing error:
  `Signing for "BrainChipConnect" requires a development team`
  Fix in Xcode `Signing & Capabilities` by selecting your team.

- Metro port conflict:
  `EADDRINUSE :::8081`
  Kill the existing process on port `8081` and restart Metro.

- iOS build issues after dependency changes:
  Re-run:

  ```bash
  cd ios && bundle exec pod install && cd ..
  ```

- iOS build issues not resolving:

  Clear Xcode DerivedData (this removes cached build data):

  ```bash
  rm -rf ~/Library/Developer/Xcode/DerivedData
  ```

  Then reinstall pods and rebuild:

  ```bash
  cd ios
  bundle install
  bundle exec pod install
  cd ..
  ```

- Error: `No Podfile found`
  Make sure you are inside the `ios` directory before running:

  ```bash
  cd ios
  bundle exec pod install
  ```

- Issues after pulling latest code:
  Always run:
  ```bash
  bundle install
  cd ios
  bundle exec pod install
  cd ..
  ```
- If build still fails (full clean setup):

  ```bash
  rm -rf node_modules
  rm -rf ios/Pods ios/Podfile.lock
  rm -rf ~/Library/Developer/Xcode/DerivedData

  npm install
  bundle install

  cd ios
  bundle exec pod install
  cd ..
  ```

## 🔄 Reset Cache and Rebuild

```bash
# 1. Stop Metro (Ctrl + C)

# 2. Reset Metro cache
npm start --reset-cache
```

Then rebuild the app:

### 🤖 Android

```bash
cd android
./gradlew clean
cd ..

npm run android
```

### 🍎 iOS

```bash
cd ios
xcodebuild clean
cd ..

npm run ios
```

## 🧹 Deep Clean (If changes still not reflecting)

### Android

```bash
cd android
./gradlew clean
cd ..
```

### iOS

```bash
rm -rf ios/build
rm -rf ~/Library/Developer/Xcode/DerivedData

cd ios
bundle exec pod install
cd ..
```

## 💡 Notes

- If issues persist, restart Metro + reinstall pods (iOS)

# 📦 Build Outputs

## 🤖 Android Builds

### 🔹 Debug APK

```bash
cd android
./gradlew assembleDebug
```

📍 Output:

```
android/app/build/outputs/apk/debug/app-debug.apk
```

Install:

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### 🔹 Release APK

#### Generate Keystore (one-time)

```bash
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
```

Move keystore to:

```
android/app/
```

#### Configure Signing

Edit `android/gradle.properties`:

```properties
MYAPP_UPLOAD_STORE_FILE=my-release-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
MYAPP_UPLOAD_STORE_PASSWORD=*****
MYAPP_UPLOAD_KEY_PASSWORD=*****
```

Edit `android/app/build.gradle`:

```gradle
signingConfigs {
    release {
        storeFile file(MYAPP_UPLOAD_STORE_FILE)
        storePassword MYAPP_UPLOAD_STORE_PASSWORD
        keyAlias MYAPP_UPLOAD_KEY_ALIAS
        keyPassword MYAPP_UPLOAD_KEY_PASSWORD
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        shrinkResources false
    }
}
```

#### Build Release APK

```bash
cd android
./gradlew assembleRelease
```

📍 Output:

```
android/app/build/outputs/apk/release/app-release.apk
```

### 🔹 Android App Bundle (Recommended)

```bash
cd android
./gradlew bundleRelease
```

📍 Output:

```
android/app/build/outputs/bundle/release/app-release.aab
```

## 🍎 iOS Builds

### 🔹 Debug Build

```bash
npm run ios
```

### 🔹 Archive Build (IPA)

```bash
open ios/BrainChipConnect.xcworkspace
```

### Steps:

1. Select **Any iOS Device**
2. Menu → **Product → Archive**

### 🔹 Export IPA

- Open **Organizer**
- Select archive
- Click **Distribute App**
- Choose:

  - Development
  - Ad Hoc
  - App Store

📍 Output:

```
.ipa file
```

# 🎯 Build outputs Notes

- Debug builds → testing
- Release builds → distribution
- AAB → Play Store (recommended)
- iOS requires Apple Developer account
