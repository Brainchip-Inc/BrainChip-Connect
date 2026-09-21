# Play Console Data Safety answers

What to enter in **App content → Data safety** for BrainChip Connect, and the
evidence for each answer. Transcribe these into the Console by hand: nothing in
this repository is allowed to write the listing, by the rule in
`docs/releasing.md`.

Re-check this page whenever a dependency is added, because a dependency can
bring back a permission or an SDK on its own. The merged manifest, not
`android/app/src/main/AndroidManifest.xml`, is what ships.

## The answers

### Data collection and sharing

| Question | Answer |
| --- | --- |
| Does your app collect or share any of the required user data types? | **No** |
| Is all of the user data collected by your app encrypted in transit? | Not shown once the answer above is No |
| Do you provide a way for users to request that their data be deleted? | Not shown once the answer above is No |

Answering **No** ends the questionnaire. Every data-type page (Location,
Personal info, Financial info, Health, Messages, Photos and videos, Audio
files, Files and docs, Calendar, Contacts, App activity, Web browsing, App
info and performance, Device or other IDs) is then left untouched.

### Security practices, if the Console asks

| Question | Answer |
| --- | --- |
| Data is encrypted in transit | Not applicable: the app makes no network connection |
| Independent security review | No |

## Why each answer is right

### The app cannot send anything anywhere

A released build declares no `INTERNET` permission, so Android refuses it a
socket. Verified on this branch, not quoted from a previous audit:

```
./gradlew :app:processReleaseManifest
grep -c INTERNET android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml
```

The count is `0`. The whole permission set of the merged release manifest is:

```xml
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"
                 android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="com.brainchip.connect.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION" />
```

The fourth is a signature-level permission AGP defines for the app's own
process so an internal broadcast receiver is not exported. It is not a
user-facing permission, it grants nothing to anyone else, and it is not
declarable in Data safety.

Note that the debug variant does add `INTERNET`, purely so the Metro dev server
stays reachable. That file is `android/app/src/debug/AndroidManifest.xml`, it is
excluded by `.gitignore`, and it never reaches a release build.

### There is no backend and no analytics

The app was cut over from a VPN-only internal server before launch and nothing
replaced it. There is no analytics, crash-reporting, advertising or telemetry
SDK in the dependency tree. The three features that used to call the server now
work locally: Terms and Privacy Policy are bundled in `src/app/content/`,
firmware and model packages come from the phone's own document picker, and a
device is authorised simply by being visible over Bluetooth.

### Nothing the app stores leaves the phone

Device pairing information, acceptance of the legal documents, event history
and profile preferences are written to the app's own private storage. None of
it is uploaded, because there is nowhere to upload it to.

### The data the board sends is not collected data

Detection results, the microphone waveform and camera preview frames arrive
over Bluetooth from hardware the user owns, are drawn on screen, and are either
discarded or written to the app's private event history. Play counts data as
collected when it leaves the device, which none of this does.

## Two things this page does not answer

The content rating questionnaire, target audience and content, ads declaration,
app access and government apps declarations are separate Console sections and
are the captain's to answer. They are out of scope here.

## Standing evidence

- `android/app/src/main/AndroidManifest.xml` for what the app asks for.
- The merged manifest under `android/app/build/intermediates/merged_manifests/`
  for what actually ships, and the merger report beside it for who contributed
  each line.
- `AGENTS.md`, sections "The app is offline by design" and "The only truth
  about permissions is the merged manifest".
