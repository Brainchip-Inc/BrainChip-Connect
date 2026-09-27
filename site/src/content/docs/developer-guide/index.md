---
title: Developer guide
description: How to build on the BrainChip Connect source, from a first debug build to a demo of your own.
sidebar:
  order: 0
  label: Overview
---

This guide is for someone building the app from source, forking it, or
extending it with a screen or a demo of their own. The app is a React Native
project in TypeScript, one codebase for Android and iOS, and its source is at
[github.com/Brainchip-Inc/BrainChip-Connect](https://github.com/Brainchip-Inc/BrainChip-Connect).

## The chapters

1. [Repository layout](/BrainChip-Connect/developer-guide/repository-layout.html):
   where things live and which libraries do what.
2. [Build and run a debug build](/BrainChip-Connect/developer-guide/build-and-run.html):
   the toolchain, a first build on a phone or an emulator, and a debug APK
   that runs on its own.
3. [How the app talks to the board](/BrainChip-Connect/developer-guide/bluetooth.html):
   discovery, the command channel, detections, and the firmware and model
   transfers.
4. [Add a screen or a demo](/BrainChip-Connect/developer-guide/add-a-screen-or-demo.html):
   what a new screen needs, and what a new application on the board needs
   from the app.
5. [Tests and the checks a pull request must pass](/BrainChip-Connect/developer-guide/tests-and-checks.html):
   what runs locally and in CI, and what to change when publishing a fork.

## Before you start

- [CONTRIBUTING.md](https://github.com/Brainchip-Inc/BrainChip-Connect/blob/main/CONTRIBUTING.md)
  is the commit convention and the merge rules, enforced in CI.
- [AGENTS.md](https://github.com/Brainchip-Inc/BrainChip-Connect/blob/main/AGENTS.md)
  in the repository root holds the project's sharp edges: the things that
  are easy to get wrong and cost a working transfer rather than failing
  loudly. Read it before touching the Bluetooth layer.
- The [user guide](/BrainChip-Connect/user-guide.html) describes what
  every screen does from the user's side.
