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

## BLE command opcodes are owned by the firmware enum

`src/services/ble/bleCommands.ts` must match `command_type_t` in the spark
firmware repo at `source/include/ble_services/ble_initialization.h`. Commands go
out as the bare number and notifications are matched on the numeric prefix, so a
drifted value invokes the wrong handler instead of failing: CURRENTSTART sitting
at 12 rather than 13 made "start current measurement" start the microphone
waveform stream.

Every value is therefore assigned explicitly, including `STREAMWAVE = 12`, which
the app never sends but which holds the firmware's slot.
`__tests__/bleCommandOpcodes.test.ts` pins all fifteen against a transcription of
that header. Verify a protocol bump against the header itself, never against the
trailing comments in the enum.

Firmware acks the stop commands with `ACK_DONE` (0xAA / 170) under the same
opcode: `8:170`, `10:170`, `11:170`, `14:170`. `CMD_CURRENT_START` is not acked
at all, and doubles as the opcode the sample stream arrives on, payload
`"<1v8>,<0v8>"` in mA at `CONFIG_CURRENT_DEFAULT_RATE_HZ` (10 Hz).

## A clean `npm ci` cannot build Android without patching react-native-screens

`react-native-screens` resolves to 4.27.0 under `^4.19.0`, and its codegen specs
under `src/fabric/` declare command refs as `React.ComponentRef<ComponentType>`.
The codegen shipped with react-native 0.83.10 accepts only `React.ElementRef<>`,
so `:react-native-screens:generateCodegenSchemaFromJavaScript` aborts and no
Android build completes:

    Error: The first argument of method showColumn must be of type React.ElementRef<>

Four spec files are affected (`SearchBarNativeComponent.ts`, and the `gamma`
split/stack header configs). A proper fix belongs in `patches/` via
patch-package, which this repo already uses, or in a version pin; see
`node_modules/@react-native/codegen/lib/parsers/typescript/components/commands.js`
for the constraint. Gradle also needs `ANDROID_HOME`, which a non-login shell
does not set.

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
