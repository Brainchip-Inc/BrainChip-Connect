---
title: Add a screen or a demo
description: What a new screen needs from the navigator, and what a new application on the board needs from the app.
sidebar:
  order: 4
---

## Add a screen

The app has one native stack navigator, in `App.tsx`, with headers hidden:
every screen draws its own title, and the connected screens share the
`DeviceHeader` and the `BottomNavigationBar` components from
`src/components/custom/`.

1. Create the screen under `src/app/screens/`. Look at
   `SettingsScreen.tsx` for the shape of a connected screen: the header with
   the board's name, the content, and the tab bar.
2. Add the route to `RootParamList` in `App.tsx`, with its parameters or
   `undefined`, and register it with a `Stack.Screen` in the navigator.
3. Navigate to it from an existing screen with `navigation.navigate`.

Two rules from the project notes apply to every screen:

- **A screen never starts a device session.** `followConnection` in
  `useBleCommandStore.ts` is the only thing that starts or ends one, and
  screens only read the session. A screen effect used to do this, and every
  reconnect then added one more listener to the board.
- **Leaving the connected board goes through
  `BleConnectionHelper.returnToDeviceList`**, a navigation reset, never a
  `navigate` to the device list.

`__tests__/App.test.tsx` and the other `.test.tsx` files render screens and
components with `react-test-renderer`, and `__tests__/deviceNaming.test.tsx`
is the model for a test that drives a screen through two boards, which
matters because no screen may name a fixed board: the name comes from
`nameForDevice` in `useBleStore.ts`, which falls back to the plain noun
`device`.

## Add a demo

The app does not decide which demos a board has. It shows whatever
applications the board reports, and every screen and update path is offered
for any board. So a new demo is first a board that reports it, and then the
app being taught what to show for it.

### What the board reports

The application list reply is one message per application,
`<name>,<description>,<size in KB>`. The app takes the first word of the
name, lower-cased, as the application's id and maps it through
`appTypeMapping` in `useBleCommandStore.ts`: `keyword`, `anomaly`, `imu` and
`vision` are known, and any other first word becomes `keyword`. That id is
what the app sends back in every start, stop and stream command for the
application, and it is what the board must answer to. The details reply,
opcode 5, fills in the model name, input shape, class count and keywords
shown under More Information.

A detection is `8:<label>,<confidence>` on the notify characteristic. The
app shows the latest one on the active card and the dashboard, and appends
every one to the history the Notifications tab shows.

### What the app needs

| Where | What to add |
| --- | --- |
| `AppType` in `src/app/store/useLiveSensorStore.ts` and `appTypeMapping` in `useBleCommandStore.ts` | The new id. |
| `APP_ICON_MAP` in `src/app/screens/Device/DeviceApplicationScreen.tsx` | The icon for the card. |
| `src/app/screens/LiveSensorDataScreen.tsx` | The dashboard sections for the new id. The screen switches on the application type for the icon beside the name, the detection area, the sensor section and whether App Controls appear, so each of those needs a branch. |
| `src/components/common/DetectionBanner.tsx` | The wording before the first detection, and any label that should read as a sentence rather than as `"<label>" detected`. |
| `src/services/ble/bleParser.ts` | A parser for any new frame the board sends, told apart from the existing ones by its opcode or, for binary frames, its command byte. |

Two things the current code does that a new demo inherits:

- The Edge Learning section is rendered on every dashboard, whatever the
  application type. It only means anything to an AkidaTag keyword spotting
  model built for edge learning.
- The app tracks one active application. Running a second one sends only the
  new start; the board decides what happens to the first.

Pin what the board sends with a test. `__tests__/appTransitionCards.test.tsx`
drives the application cards through a start and its acknowledgement, and
`__tests__/detectionFlood.test.ts` is the guard against a board that reports
every frame: the history file is written at most once a second, and a demo
that reports state rather than events will run into it.
