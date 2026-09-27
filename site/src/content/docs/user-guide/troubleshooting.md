---
title: Troubleshooting
description: What each message from BrainChip Connect means, what the board's LEDs say, and what to do.
sidebar:
  order: 7
---

## Finding and connecting

| What you see | What it means | What to do |
| --- | --- | --- |
| **No devices found** | Ten seconds of scanning found no board announcing an AKD1500. | Check that the board is powered and its green LED is blinking, move closer, and tap **Scan again**. |
| **Bluetooth Not Enabled** | The phone's Bluetooth is off. | Turn it on and try again. |
| **Bluetooth Permission Required** | Bluetooth access was declined. | Tap **Grant Permissions** again, or allow it for the app in the phone's settings. |
| **Connection Failed**, "Connection timed out" | The board did not answer within twenty seconds. | Check that it is powered and in range, then select it again. |
| **Device Disconnected** | The link dropped: the board restarted, went out of range or was powered off. | Tap **Reconnect** to return to the device list, and select the board again. |
| **Device Restarting** | You asked the board to restart with **Factory Reset**. | Tap **Reconnect** and select the board again once its green LED is blinking. |

## Running a demo

| What you see | What it means | What to do |
| --- | --- | --- |
| **Failed to deploy application** or **Failed to stop application** | The board did not confirm the command within three seconds. | Try again. If it keeps happening, disconnect and reconnect. |
| **No keyword detected yet** stays, and the board's red LED never flashes | The board is not hearing the keyword. | Speak clearly and close to the microphone. Lower the RMS threshold or the score threshold in App Controls. |
| The red LED flashes but the app shows nothing | The board hears keywords but is not reporting them to the phone. | Tap **Run Application** on the Keyword Spotting card; the board reports keywords only after that. |
| **Battery request failed** | The board did not answer the battery request. | Disconnect and reconnect. |
| **No answer from AkidaTag** after an Edge Learning control | The board did not confirm the command within five seconds. With a model that is not built for edge learning the board ignores every learning command. | Check that the edge learning model, `akidatag-kws-edge-learning-model.zip`, is loaded, then try again; if the board has gone, reconnect. |
| **Nothing has arrived yet. The firmware on this board may not send a preview.** | Five seconds of streaming brought no camera frame. | Only the Nicla Vision human detection demo sends a preview; an AkidaTag has no camera. |
| A BrainBoard1500 disappears from the list after **Device Disconnected** | The board is still connected to the phone and so has stopped advertising. | Close and reopen the app. The board needs nothing done to it. |

## Updates

| What you see | What it means | What to do |
| --- | --- | --- |
| **Please select a .bin or .zip firmware file** or **This file is not a firmware image the app can send** | The file is not an MCUboot image. | Use `akidatag-<version>.signed.bin` from the AkidaTag releases. |
| **This file may not install** | The file is signed with a different key from the last firmware this app installed on this board. | Send it anyway only if it is the release meant for this board. |
| **Update did not install** | The board rejected the image and restarted on its previous firmware. | See [the firmware chapter](/BrainChip-Connect/user-guide/firmware-update.html#send-it). |
| **This package is missing one of the three files a model is made of** | The `.zip` lacks `info.yaml` or one of the two `.bin` files. | Use a complete package. |
| **The board refused this model: it is not one this board can take** | The board rejected the package before the data was sent, for example an AkidaTag package sent to a BrainBoard1500. | Use the package built for this board. |
| **Model delivered, but not running** | The board stored the model but could not run it. | Restart the board, then try a different package. |
| **The board stopped answering partway through the transfer** | The link stalled. | Move closer and send the package again. |

## What the AkidaTag LEDs mean

| Green | Red | Meaning |
| --- | --- | --- |
| Slow blink | Off | Powered, waiting for a phone |
| On | Off | A phone is connected |
| Any | Flash of about half a second | A keyword was heard |
| On | Blinking fast | A model is being received |
| On | On | A block of the model is being written |
| Blinking three times | Blinking three times | The model was installed and is running |
| Off | On | A model transfer failed, or the board is in the bootloader's update mode |
| On or slow blink | On | Edge learning is listening: say the keyword |

## What the BrainBoard1500 LED means

| Colour | Meaning |
| --- | --- |
| Blue, one short flash every two seconds | Advertising, no phone connected |
| Green, steady | A phone is connected |
| Blue, fast blink | A model transfer is running |
| Red, one short flash | A keyword was heard, or a person is in view |
| Red, slow blink | Setup failed |
