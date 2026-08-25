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

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
