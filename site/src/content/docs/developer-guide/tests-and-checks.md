---
title: Tests and the checks a pull request must pass
description: What runs locally and in CI, which tests pin the app to the boards, and what to change when publishing a fork.
sidebar:
  order: 5
---

## Run the checks locally

The three commands CI runs work as they are:

```sh
npx eslint .
npx tsc --noEmit
npx jest
```

Nothing enforces code formatting: the eslint config only switches off the
rules that would conflict with prettier, so run `npx prettier --write` on
what you touch.

Commit subjects and pull request titles follow one format,
`type(scope): concise message`, and the validator that CI runs is in the
repository:

```sh
.github/ci-gates/check-subject.sh "feat(ble): add the thing"
```

[CONTRIBUTING.md](https://github.com/Brainchip-Inc/BrainChip-Connect/blob/main/CONTRIBUTING.md)
has the allowed types, the wording rules and the merge rules.

## What runs on a pull request

| Check | What it does |
| --- | --- |
| Lint, typecheck and test | `eslint`, `tsc --noEmit` and `jest` over the whole project, on Node 20. Each of the three runs and reports independently. |
| format | The pull request title, and every commit subject on a pull request into `main`, through `check-subject.sh`. |
| lint | shellcheck over the shell scripts the pull request changed, and the matching linter for any other scripting language that appears. |

Pull requests squash into `main`, so the title is the commit that lands.
Merging is the maintainers' call.

Pushing to `main` also publishes this site when the push touches it: the
workflow renders the Privacy Policy page from the in-app text, fails if the
committed page differs from the render, builds `site/` and deploys it to
GitHub Pages. Run `npm run pages:render` from the repository root after any
change to the legal text, and commit the result.

## The tests that pin the app to the boards

Several tests exist because a format is shared with a board and both sides
must move together. Changing one of these deliberately means changing the
test with it.

| Test | What it pins |
| --- | --- |
| `akidaAcceleratorAdvertisement.test.ts`, `deviceDiscovery.test.ts` | The manufacturer data bytes a board is recognised by, and what the scan then offers to the list. |
| `deviceSession.test.ts` | One notification monitor across connect, disconnect and reconnect. |
| `bleModelInfoCrc.test.ts`, `modelTransferProtocol.test.ts`, `bleModelTransfer.test.ts` | The model transfer: the CRC header layout, the frame layouts, and whole transfers replayed against a fake peripheral that enforces the board's rules. |
| `mcubootImage.test.ts`, `trustedKeyStorage.test.ts`, `useFirmwareUpdate.test.tsx`, `firmwareUpdateOutcome.test.ts`, `firmwareUpdateAnnouncement.test.ts`, `signingKeyWarningCard.test.tsx` | The firmware update, from reading an image to every ending's wording. |
| `modelUpdateAnnouncement.test.ts` | The wording of the three model update endings. |
| `cameraPreview.test.ts`, `cameraPreviewStore.test.ts`, `cameraPreviewCard.test.tsx`, `grayscalePng.test.ts` | The preview chunk layout, reassembly, and the PNG the app draws. |
| `edgeCommandTimeout.test.ts`, `edgeLearningControls.test.tsx` | That an edge learning control changes only once the board has answered. |
| `detectionBanner.test.tsx`, `detectionFlood.test.ts` | The banner's wording and age, and the once-a-second cap on writing the history file. |
| `deviceNaming.test.tsx` | That every update ending names the connected board rather than a fixed one. |
| `acceptanceStorage.test.ts` | The keys the accepted-terms flags are stored under. |
| `pages.test.ts` | That the committed Privacy Policy page matches the render of the in-app text. |

`__tests__/fixtures/` holds the sample images and packages the tests replay.

## Publishing a fork

A fork that is built and published as its own app has to be told apart from
BrainChip Connect. The identifiers below are what the repository carries;
two of them are duplicated across files that no build step keeps in sync,
and a mismatch there builds fine and fails at launch with no view mounted.

| Identifier | Where |
| --- | --- |
| `com.brainchip.connect` | The Android `applicationId` and `namespace` in `android/app/build.gradle`, and the iOS `PRODUCT_BUNDLE_IDENTIFIER`. The two platforms deliberately share one string. |
| `BrainChipConnect` | The npm package name, the Gradle root project, the Xcode project, target and `PRODUCT_NAME`, and the React Native component registered from `app.json`, repeated as a literal in `MainActivity.kt` and `AppDelegate.swift`. |
| The name, the icon and the logos | `app.json`, the native projects' icon sets, and `src/app/assets/images/`. |
| The Privacy Policy and the terms | `src/app/content/`, shown on first run and hosted from this site. Legal text under BrainChip's review; a fork carries its own. |
| The store listing | `fastlane/metadata/android/`. |

A fork published as its own app must use its own application ID and bundle
identifier, its own name and icon, and its own Privacy Policy and Terms. It
must not use the BrainChip or Akida names or the BrainChip logo in its name,
icon or store listing. It may say that it is based on BrainChip Connect and
link to this repository.
