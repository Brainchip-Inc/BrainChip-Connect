---
title: Update the AkidaTag firmware
description: Send a signed firmware image to the AkidaTag over Bluetooth and confirm what it came back running.
sidebar:
  order: 5
---

The app updates an AkidaTag's firmware over Bluetooth through the board's
MCUboot bootloader. The file has to be on the phone first: the app downloads
nothing.

## Get the firmware file

AkidaTag firmware is published as releases of the
[Brainchip-Inc/AkidaTag](https://github.com/Brainchip-Inc/AkidaTag/releases)
repository. Download `akidatag-<version>.signed.bin`, the asset described
there as the signed firmware for update over Bluetooth, to the phone. The app
also accepts a `.zip` that contains a single `.bin` image. The same release
carries the model packages described in [Load a model](/BrainChip-Connect/user-guide/model-update.html).
This guide describes the firmware on that repository's `main` branch; TBD:
the version of the release that carries it.

:::caution[The image must be signed for your board]
A board accepts only firmware signed with the key its bootloader trusts. A
board flashed from an official release takes official releases, and a board
flashed with a development build takes development builds. An image the board
does not trust is discarded quietly when it restarts, and the board carries
on with its previous firmware. Nothing is bricked.
:::

There is no version check on the board: any correctly signed image installs,
newer or older.

## Check the version first

The **Firmware** row on
[Device Preview](/BrainChip-Connect/user-guide/connect.html#device-preview)
shows the version a board is running, before connecting. Note it, so the
result of the update can be checked the same way.

## Send it

1. Open **Settings** and tap **Firmware Update**.
2. Tap **Browse Local Firmware** and pick the file. The app reads the image
   header and shows the file's name, version and size.
3. If this app has already installed firmware on this board, and the new file
   is signed with a different key from that one, the app warns **This file
   may not install**. **Send it anyway** goes ahead.
4. Tap **Install This Build**. Keep the app open and stay near the board.
   The sheet walks through:
   - **Sending firmware…** with a percentage.
   - **Restarting your AkidaTag…** once the image is on the board and it has
     been asked to restart.
   - **Waiting for your AkidaTag…** while the board installs the firmware,
     which can take up to two minutes. The app looks for the board, tells it
     apart from any other by its serial number, and reads which firmware it
     came back running. Do not power the board off.
5. Read the outcome and tap **Done**.

| The app says | What happened | What to do |
| --- | --- | --- |
| **Update installed** | The board came back running the firmware you sent, confirmed after its restart. | Nothing. The app is connected to it again. |
| **Update did not install** | The board came back on its previous firmware. It did not accept the image: the bootloader installs only an image signed with the key it trusts. | Check that the file is the release built for this board. |
| **Your AkidaTag did not restart** | The image was sent but the board did not restart, so it is still on its previous firmware. The image is staged on the board and may install the next time it is powered off and on. | Power the board off and on, then check the Firmware row on Device Preview. |
| **Update failed** | The transfer did not complete. The board is still running its previous firmware. | The message says why; most often the board stopped answering. Move closer and send it again. |
| **Could not confirm the update** | The image was sent, but afterwards the app could not find the board again, or the board would not say what it is running. | Select the board in the device list and check the Firmware row. |

## What survives an update

The model and any learned keywords stay on the board. The keyword spotting
settings under App Controls return to their defaults whenever the firmware
version changes.

:::note[Screenshots to come]
TBD: screenshots of the Firmware Update sheet, the sending step and an
outcome.
:::
