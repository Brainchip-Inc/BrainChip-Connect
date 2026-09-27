---
title: Install the app and grant its permissions
description: Get BrainChip Connect onto a phone, accept the terms, and give it the Bluetooth access it needs.
sidebar:
  order: 1
---

## Get the app

BrainChip Connect is on Google Play for Android and is coming soon to the
iOS App Store.

:::note[Pre-registration]
The Google Play listing is open for pre-registration. Register at
[play.google.com/store/apps/details?id=com.brainchip.connect](https://play.google.com/store/apps/details?id=com.brainchip.connect)
and Google Play installs the app on your phone when it is released.
:::

The app needs Android 13 or later. It uses Bluetooth Low Energy and nothing
else: it has no internet permission, talks to no server, and everything it
keeps stays on the phone. The [Privacy Policy](/BrainChip-Connect/privacy-policy.html)
says exactly what that covers.

## First run

1. The app opens on a splash screen and moves on to **Get Started** by
   itself.
2. Tap **Get Started**.
3. On **Permissions Required**, tick **I accept the Privacy Policy** and
   **I accept the Terms and Conditions**. Tapping either title opens the
   document, and its **Accept** button ticks the box for you. **Grant
   Permissions** stays grey until both are ticked.
4. Tap **Grant Permissions**. Android asks for the permissions in the table
   below, one after the other.
5. The app checks that Bluetooth is switched on and opens **Discover
   Devices**.

Once both documents are accepted the two checkboxes do not appear again.
Both documents can be read at any time from the **Profile** tab.

## The permissions

| Permission | Why the app asks | If you decline |
| --- | --- | --- |
| Bluetooth, to scan for and connect to nearby devices | To find the AkidaTag and talk to it. The app never asks for your location: it tells Android that its scans are not used to work out where you are. | The app shows **Bluetooth Permission Required** and stays on the permissions screen. Tap **Grant Permissions** again, or allow Bluetooth for the app in the phone's settings if Android has stopped asking. |
| Notifications | Reserved for alerts in a future version. Nothing in this version posts a notification. | No effect. |

If Bluetooth is switched off, the app shows **Bluetooth Not Enabled**. Turn
Bluetooth on and tap **Grant Permissions** again.

## Coming back later

On later launches **Get Started** goes straight to **Discover Devices** when
the documents are accepted, the Bluetooth permission is granted and Bluetooth
is on. If any of those is missing it shows **Permissions Required** again.
