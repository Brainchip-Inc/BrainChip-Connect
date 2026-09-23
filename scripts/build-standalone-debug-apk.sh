#!/usr/bin/env bash
#
# Build a debug APK with its JavaScript bundled in, so it runs on a phone with
# no cable, no dev server and no laptop.
#
# The React Native Gradle plugin only registers a bundling task for a variant
# that is *not* listed in `debuggableVariants`, which for a stock
# `./gradlew assembleDebug` includes `debug` itself; that is why a sideloaded
# debug build otherwise red-screens the moment Metro is gone. Bundling here,
# before Gradle runs, works around that without touching `debuggableVariants`:
# the plugin skips its own bundling task for `debug`, but that task is the
# only thing that would have overwritten what this script places in
# `android/app/src/main/assets` first. A normal `npm run android` against a
# running Metro is unaffected, since nothing here changes what Gradle does.
#
# Usage:
#   scripts/build-standalone-debug-apk.sh
#
# Output:
#   android/app/build/outputs/apk/debug/app-debug.apk

set -euo pipefail

readonly BUNDLE_OUTPUT="android/app/src/main/assets/index.android.bundle"

# Remove a previous run's generated JS bundle and image assets, so building
# twice in a row never leaves behind an image current sources no longer draw.
clean_generated_assets() {
  local repo_root="$1"
  rm -rf "$repo_root/android/app/src/main/assets"
  find "$repo_root/android/app/src/main/res" -maxdepth 1 -type d -name 'drawable-*' -exec rm -rf {} +
  rm -rf "$repo_root/android/app/src/main/res/raw"
}

# Bundle the JavaScript and the image assets it requires into the debug
# variant's own asset folders, exactly as a release build would.
bundle_javascript() {
  local repo_root="$1"
  mkdir -p "$repo_root/android/app/src/main/assets"
  (
    cd "$repo_root"
    npx react-native bundle \
      --platform android \
      --dev false \
      --entry-file index.js \
      --bundle-output "$BUNDLE_OUTPUT" \
      --assets-dest android/app/src/main/res
  )
}

main() {
  local repo_root
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

  clean_generated_assets "$repo_root"
  bundle_javascript "$repo_root"

  (cd "$repo_root/android" && ./gradlew assembleDebug)

  echo "Standalone debug APK: $repo_root/android/app/build/outputs/apk/debug/app-debug.apk"
}

main "$@"
