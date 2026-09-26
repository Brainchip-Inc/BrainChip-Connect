# Contributing

Thank you for your interest in BrainChip Connect.

## Pull requests

Pull requests are welcome when they add value to the app: a capability for a board
the app already serves, support for another BrainChip board, a fix for something
that is broken, or a clearer piece of documentation. The maintainers review every
pull request and close the ones that are not a fit, so for anything larger than a
fix, open an issue first and say what you have in mind. That saves you building
something the app will not take.

A few things make a pull request easy to accept:

- **One change per pull request**, with the title and every commit subject in the
  format below. CI rejects a pull request that does not follow it.
- **The three required checks pass.** They are the same commands you can run
  locally; see [What runs on a pull request](#what-runs-on-a-pull-request).
- **Anything touching Bluetooth was tried on a real board.** The board owns every
  protocol the app speaks, and the specifications live with the firmware in the
  [AkidaTag repository](https://github.com/Brainchip-Inc/AkidaTag). A change to
  the wire format is made there first, and the tests under `__tests__/` that pin
  the app to it are updated with it. `AGENTS.md` records those contracts and the
  sharp edges around them; read the section for the area you are changing.
- **Nothing reaches out to a network.** The app is offline by design: no `fetch`,
  no environment variables, no download URLs. Released builds declare no internet
  permission.
- **New third-party files are declared.** If you add a font, icon set, image or
  script you did not make, name its source and licence in the pull request so
  `NOTICE` can be kept accurate.

## Reporting a problem

If the app does not work with your board, or anything else in this repository
is wrong, please
[open an issue](https://github.com/Brainchip-Inc/BrainChip-Connect/issues). That
is the most useful thing you can send us, and we read every one.

Please search the existing issues first, then include:

- what you did, and what happened instead of what you expected
- your phone's model and Android version
- the app version and build, from the About screen inside the app
- which board you were connected to, and its firmware version if you know it
- the smallest `adb logcat` excerpt that shows the failure

You do not need to diagnose the cause or propose a fix. A clear description of
what broke is enough for us to work from.

## Questions and ideas

TBD: Developer Hub link. The BrainChip Developer Hub has the tools, model zoo and
documentation for the wider Akida platform.

TBD: community link. The BrainChip community is the place for questions, ideas,
and showing us what you have built.

## Building on this work

Please do. This repository is Apache 2.0 licensed precisely so you can fork it and
take it in your own direction without asking us first. See [LICENSE](LICENSE) and
[NOTICE](NOTICE) for the terms, including those of the third-party packages the
build fetches and the two patches under `patches/`, which keep their packages'
own licences.

---

## The commit format

This project uses one commit message convention, and it is enforced in CI rather
than suggested. A pull request whose title or commits do not follow it cannot be
merged.

Every commit subject, and every pull request title, reads:

> _type(scope): concise message_

**Rules:**

- **type** &rarr; required, lowercase, one of the types in the table below.
- **scope** &rarr; optional but recommended, lowercase, one word where possible:
  `feat(ble):`, `fix(theme):`. Omit the parentheses entirely when no scope is
  meaningful. Append `!` for a breaking change: `feat(ble)!: ...`.
- **message** &rarr; says what the change does, in the imperative. It starts
  lowercase, or with an all-capital acronym such as BLE or CRC. A capitalized word
  such as `Added` is rejected.
- No trailing period. 100 characters maximum, though under 72 stays the habit.

Describe the effect, not the file touched. `fix(ble): stop dropping the last INFO
frame` beats `fix(ble): update bleManager.ts`.

Good:

```
feat(ble): show the device serial once the info burst lands
fix(theme): pair fontWeight with the family so headings render bold
docs(agents): record why the font families are not bundled
```

Rejected:

```
Update files                     no type, no scope, says nothing
feat: Added new feature.         past tense, capitalized, trailing period
refact(ble): tidy logging        refact is not a type, refactor is
```

The gate cannot catch a subject that is well formed and still says nothing.
`fix(app): fix bug` passes it and is still a bad subject.

### Allowed types

| Type         | When to Use                                                                       |
| ------------ | --------------------------------------------------------------------------------- |
| **feat**     | Adding a new feature or enhancement.                                              |
| **fix**      | Fixing a bug.                                                                     |
| **docs**     | Documentation-only changes (README, comments, docs folder).                       |
| **style**    | Code style or formatting changes that do **not** affect functionality.            |
| **refactor** | Restructuring code without changing behavior; **use this for most file renames**. |
| **perf**     | Performance improvements.                                                         |
| **test**     | Adding or updating tests.                                                         |
| **build**    | Build system or tooling changes (Gradle, Podfile, Metro, scripts).                |
| **ci**       | Changes to CI/CD configuration (GitHub Actions, pipelines).                       |
| **chore**    | Routine maintenance tasks (dependency updates, cleanup).                          |
| **config**   | Configuration and tooling settings.                                               |
| **revert**   | Reverting a previous commit.                                                      |

## What runs on a pull request

Three checks are required before a pull request can merge into `main`:

- **format** checks the pull request title, and on pull requests into `main` every
  commit subject you wrote. Merge commits are skipped.
- **Lint, typecheck and test** runs `eslint`, `tsc --noEmit` and `jest` over the
  whole project. It does not check JavaScript or TypeScript formatting: the
  `@react-native` eslint config only extends `eslint-config-prettier`, which
  switches off the rules that would conflict with prettier rather than running it,
  and no `prettier/prettier` rule is enabled anywhere. Nothing in CI enforces code
  formatting today, so run `npx prettier --write` on what you touch.
- **lint** runs shellcheck over the shell scripts a pull request changed, and ruff
  if a Python file ever appears.

`.github/ci-gates/check-subject.sh` is the validator the format check runs, and it
is the authority on what is accepted. Run it on a subject before you push:

```sh
.github/ci-gates/check-subject.sh "feat(ble): add the thing"
```

The other three are the same commands CI runs, so they work locally too:

```sh
npx eslint .
npx tsc --noEmit
npx jest
```

---

## For maintainers

### Merging

Pull requests squash into `main`. GitHub builds the squash subject from the pull
request title and appends the number, so the title _is_ the commit that lands.
The squash body is blank unless whoever merges writes one.

**A release pull request, from `main` into `release`, is the one exception: it is
merged with a real merge commit and must never be squashed.** A squash invents a
commit that `main` does not have, so the two branches diverge permanently and
every later release pull request conflicts. Pick _Create a merge commit_ from the
merge button's dropdown. The release pipeline checks this and fails the release
when the merge has a single parent. See [docs/releasing.md](docs/releasing.md).

### Upgrading from the old local hook

This repo used to ship a `commit-msg` hook installed by
`scripts/install_git_hooks.sh`. Both scripts are gone: the CI gate enforces the
same idea, on everyone, without needing to be installed. The hook also disagreed
with the gate in both directions, so keeping it would only mislead.

If you ran the installer at any point, that copy is still sitting in your clone
and will keep enforcing the old rules. Remove it once:

```sh
rm -f .git/hooks/commit-msg
```
