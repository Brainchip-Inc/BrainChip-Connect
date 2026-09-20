# Changelog

All notable changes to the BrainChip Connect app are documented in this file.

The format is based on [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/).

Versions are `major.minor.patch+build`, the same shape the AkidaTag firmware
uses. The `major.minor.patch` part is the version name a user sees; the `+build`
counter separates two uploads of the same user-visible version and resets to `0`
whenever `major.minor.patch` changes. `VERSION` at the repository root holds the
version being released, and `scripts/release-version.sh` turns it into the
Google Play version code.

`[Unreleased]` collects what has landed on `main` and not yet been published.
Cutting a release renames that heading to `## [<version>] - <YYYY-MM-DD>` and
adds a fresh empty `[Unreleased]` above it. The headings are parsed by
`scripts/release-notes.sh`, which `.github/workflows/release.yml` uses to build
the GitHub release body, so keep their form exact. `docs/releasing.md` is the
full procedure.

## [Unreleased]

### Added

- **Devices:** discovery of BrainChip boards over BLE by the AKD1500
  accelerator id in their manufacturer data, connection, and a device screen
  showing the serial, firmware version and battery state read over the link.
- **Applications:** the list of applications a board carries, the details of
  each, and Run Application, which loads the chosen model into the Akida
  accelerator and shows the wait while the board swaps it in.
- **Results:** live keyword-spotting results with the microphone waveform, live
  human detection with the camera preview streamed from the board, and an event
  history of what each board reported.
- **Updates:** firmware update and AI model update over BLE from a package
  picked out of the phone's own storage, each reporting what the board actually
  did with it rather than only that the transfer finished.
- **Legal:** Terms of Use and Privacy Policy bundled into the app, with
  acceptance recorded per device.

### Security

- The app is offline by design: no backend, no network permission in a released
  build, and no credentials of any kind. It communicates only over Bluetooth.
