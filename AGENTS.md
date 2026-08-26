# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

- Add durable project-specific notes here as they are discovered through real work.

## BLE model transfer is pinned to firmware `model_meta_t`

`src/services/ble/bleManager.ts` mirrors a wire protocol owned by the spark
firmware repo. When `model_meta_t` gains a field, the app must both extend the
CRC header in `computeCombinedCRC32` and write the new characteristic during the
INFO phase; getting only one half right produces either an `INFO CRC FAIL` on
the board or a model that loads with zeroed metadata.

The authoritative counterparts, read-only from this repo, are
`utils/send_model_via_ble.py` (working reference sender) and
`core/interface/ble_services/file_transfer.c` in the spark firmware repo.
Two tests pin the app to them, one per half of the contract:
`__tests__/bleModelInfoCrc.test.ts` fixes the header layout to an exact CRC, and
`__tests__/bleModelInfoTransfer.test.ts` replays a whole `sendModelZip` against
a fake peripheral that rebuilds `model_meta_t` from the characteristics it
actually received. A firmware protocol bump means updating both deliberately.

The two sides also disagree on where `model_name` comes from: the app packs the
CRC header's name from `info.yaml`'s `app`, while the firmware derives it from
the basename of the `fs_name` path, which the app builds from the info-bin
filename prefix (`kws_program_info.bin` -> `/model_meta/kws`). Every current
package agrees on both, but a package whose `app` differs from its info-bin
prefix fails the INFO CRC with no diagnostic naming the cause.

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

Android keeps `android.permission.INTERNET` deliberately, because removing it
would change the Play Store data-safety declaration; that is a product
decision, not an oversight.

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

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
