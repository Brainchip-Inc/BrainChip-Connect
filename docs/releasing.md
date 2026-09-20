# Releasing BrainChip Connect

How a build of this app reaches Google Play: the branch model, how to cut a
release, how versions work, and which track a release goes to.

The pipeline itself is `.github/workflows/release.yml`. It matches the shape the
AkidaTag firmware repository already uses, so the two products are released the
same way.

Operational matters that are not covered here live in
`BrainChip-Connect-release-operations.md`, which is held outside this
repository. Ask the release owner for it.

---

## The branch model

Two long-lived branches:

- **`main`** is development. Feature pull requests target it and are **squash
  merged**, exactly as they are today. Nothing about that changes.
- **`release`** is what has been published. It only ever receives `main`.

A release is a pull request from `main` into `release`. Merging it runs the
pipeline, which builds the app, uploads it to Play, tags the commit and writes a
GitHub release.

### A release pull request is merged with a merge commit, never squashed

This is the one rule that is expensive to get wrong.

A squash merge invents a brand new commit holding the same tree. `release` would
then contain a commit that `main` does not have, and `main` would contain the
originals that `release` does not have. The two histories never converge again,
so every later release pull request shows the same conflicts, forever, and there
is no clean way back other than rebuilding `release`.

A merge commit keeps both parents, so `release` is always an ancestor-complete
view of `main` and the next release pull request contains only what is new.

GitHub cannot be told to prefer a different merge method per target branch, so
squash stays the default for `main` and whoever merges a release pull request
picks _Create a merge commit_ from the merge button's dropdown by hand.

The pipeline enforces it anyway: its first step reads the merge commit and fails
the whole release when that commit has fewer than two parents, naming the
mistake. Catching it in the minute it happens is the difference between
resetting `release` and living with permanent divergence.

---

## Which track a release goes to

The track is chosen by labelling the release pull request, so it is a visible
decision somebody makes and reviews, not a default buried in a workflow file.

| Label         | Play track   | What happens                                    |
| ------------- | ------------ | ----------------------------------------------- |
| `pre-release` | `internal`   | Live for the named testers on the internal list |
| `release`     | `production` | Uploaded as a **draft**; a human rolls it out   |

Exactly one of the two. Without a label the run fails, because there is no track
to publish to and guessing one is not a thing a release pipeline should do.

### Today, every release is a `pre-release`

The app is internal-only for this phase, so a release is labelled
**`pre-release`**. That sends the build to the Play **internal testing** track,
where it goes live for the named testers immediately. This is the designed path
for the current phase, not a workaround or a staging step on the way to
something else.

`release` is for the public launch, later. It goes to the **production** track
and is deliberately left as a **draft** for a person to roll out from the Play
Console at the chosen moment. Do not use it before the app is meant to be
public.

The same pipeline therefore serves both phases with no edit under time pressure:
only the label changes.

### Uploading is not rolling out

The two tracks want different answers, which is why they differ:

- **Internal** uploads are **completed** immediately. The track is a list of
  named testers, the point of it is fast feedback, and there is no rollout
  percentage to stage.
- **Production** uploads are left as a **draft**. The artifact is in place and
  verified, and a person starts the rollout in the Play Console. This is what
  makes a timed launch possible, lets the rollout be staged at whatever
  percentage is wanted, and means the pipeline is structurally incapable of
  publishing to the public by accident.

Store listing text, screenshots and release notes are **not** touched by the
pipeline. They are written and reviewed in the Play Console, and a build must not
overwrite them with whatever happens to be in this repository.

Adding another track later, for example Google's open testing track, is one lane
in `fastlane/Fastfile`, one label, and one row in the `prepare` job's track
choice.

---

## Cutting a release

1. **Update `CHANGELOG.md`.** Rename the `## [Unreleased]` heading to
   `## [<version>] - <YYYY-MM-DD>` and add a fresh empty `[Unreleased]` above
   it. Check it locally:

   ```sh
   scripts/release-notes.sh 1.0.0+0
   ```

2. **Set `VERSION`.** One line, `major.minor.patch+build`:

   - bump `major.minor.patch` for a change users see, and reset the build
     counter to `0`;
   - bump only `+build` when the same user-visible version has to be uploaded
     again, for instance because a first upload was rejected.

   Check it locally:

   ```sh
   scripts/release-version.sh
   ```

3. **Open a pull request from `main` into `release`.** Title it in the format
   the `format` check enforces, naming the release:
   `chore(release): v1.0.0+0`. Then label it `pre-release` (see above; that is
   the right label for this phase).

4. **Merge it with a merge commit.** Pick _Create a merge commit_ from the merge
   button's dropdown.

5. **Watch the run.** The `prepare` job summary states the version, the version
   code, the tag and the track before anything is built.

6. **For a production release, roll it out.** Play Console → Production → the
   draft release → **Review release** → **Start rollout**. Nothing reaches the
   public until someone does this.

### Re-running a failed release

Use **Re-run jobs** on the failed run in the Actions tab; it replays the same
merge event with the same version.

The jobs are ordered so that this is safe. Nothing is tagged until the upload has
succeeded, so a run that failed before or during the upload can simply be re-run.
If a run instead fails _after_ the upload, Play has already consumed that version
code and will refuse it again: bump `+build` in `VERSION`, and open a fresh
release pull request.

---

## Versions

`VERSION` is the only place a version is written down. `package.json`'s `version`
field is unused and is not kept in step with it.

`scripts/release-version.sh` turns `major.minor.patch+build` into the three
things a release needs:

|                                            | `1.4.2+3` becomes |
| ------------------------------------------ | ----------------- |
| Version name, which people read            | `1.4.2`           |
| Version code, which Play orders uploads by | `1040203`         |
| Git tag                                    | `v1.4.2+3`        |

The version code is the base-100 positional encoding of the four components:

```
code = major x 1000000 + minor x 10000 + patch x 100 + build
```

Play requires a strictly higher version code on every upload and refuses one it
has already accepted. Two things together make offering the same code twice
impossible:

- The encoding is **injective and order preserving**. Every component is held
  below the base of 100 (and `major` below 2100, which also keeps the result
  under Play's own 2100000000 ceiling), so distinct versions always encode to
  distinct codes, and a higher version always encodes to a higher code. The
  script rejects a version that would break either property.
- The pipeline **refuses a version that does not beat every release so far**. It
  recomputes the code for every `v*` tag in the repository and requires this one
  to be strictly greater, which closes the only remaining hole: going backwards.

Neither the version name nor the version code is written in
`android/app/build.gradle`. It reads `APP_VERSION_NAME` and `APP_VERSION_CODE`
from the environment and falls back to `0.0.0-dev` / `1`, so a build made outside
the pipeline is labelled as the development build it is.

---

## What the release build does

`android/app/build.gradle` reads the signing keystore and its passwords from the
environment. Nothing of the sort is committed, and `.gitignore` refuses
`*.keystore` and `*.jks`. `debug.keystore` is the single exception: it is the
public key every Android toolchain ships with.

The release build type does not fall back to the debug key. When the environment
does not carry a keystore, the release signing config does not exist at all, and
Gradle refuses any `assembleRelease`, `bundleRelease` or `packageRelease` with a
message naming the variables that are missing. That guard exists because Play
ties an app to the key of its first upload, so a bundle it accepted signed with
the wrong key could never be replaced. It also means `./gradlew build` fails
without a keystore, which is intended.

### Building a release locally

Rarely needed, but it works. Point the values at a keystore of your own:

```sh
export UPLOAD_KEYSTORE_PATH=/absolute/path/to/some-throwaway.jks
export UPLOAD_KEYSTORE_PASSWORD=...
export UPLOAD_KEY_PASSWORD=...
export UPLOAD_KEY_ALIAS=upload          # only if the alias is not `upload`
export APP_VERSION_NAME=1.0.0
export APP_VERSION_CODE=1000000
(cd android && ./gradlew :app:bundleRelease)
```

Use a throwaway keystore, and never upload a locally built bundle by hand.
Play's version codes are global, and a hand upload burns one.

---

## fastlane

`fastlane/Fastfile` holds the lanes and `fastlane/Appfile` names the app. Two
Android lanes:

| Lane                                      | Track        | Release status |
| ----------------------------------------- | ------------ | -------------- |
| `bundle exec fastlane android internal`   | `internal`   | `completed`    |
| `bundle exec fastlane android production` | `production` | `draft`        |

Both build the app bundle with Gradle and upload it with `upload_to_play_store`.
They take the version and the credentials from the environment, so the workflow
is the normal way to run them.

fastlane is in the repository's `Gemfile`, and `Gemfile.lock` is **committed**,
unlike in a stock React Native project. A release pipeline has to install the
exact fastlane it was tested with; a floating version would mean the tool that
publishes the app could change without anyone deciding to change it.

An iOS platform block goes beside the Android one when there is an Apple
developer account: `match` for certificates, `gym` to build, `pilot` for
TestFlight and `deliver` for the App Store. The `prepare` and `publish` jobs in
the workflow are already platform-agnostic, so an `ios` job slots in beside
`android` and the version, changelog, tag and GitHub release logic is reused as
it stands.
