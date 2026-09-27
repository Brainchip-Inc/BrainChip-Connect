---
title: Load a model
description: Send an AI model package to the board over Bluetooth, and know when it is really running.
sidebar:
  order: 6
---

A board runs one model at a time in its Akida accelerator, and the app can
replace it over Bluetooth. Like a firmware update, the package has to be on
the phone first.

## The package

A model is one `.zip` holding three files, at the top level or inside a
single folder: `info.yaml`, which describes the model, and a matching pair
`<name>_program_info.bin` and `<name>_program_data.bin`. The app checks that
all three are present before it sends anything.

For an AkidaTag the name is `kws`, so the pair is `kws_program_info.bin` and
`kws_program_data.bin`. Every AkidaTag firmware release carries two
packages beside the firmware image: `akidatag-kws-model.zip`, the keyword
spotting model, and `akidatag-kws-edge-learning-model.zip`, the keyword
spotting model built for edge learning. Download the one you want from the
[latest release](https://github.com/Brainchip-Inc/AkidaTag/releases/latest)
to the phone.

An AkidaTag package will not load on a BrainBoard1500: the two boards carry
different Akida engine versions, and a model has to be built for the engine
on the board that runs it.

## Send it

1. Open **Settings** and tap **Model Update**.
2. Tap **Browse Local Model** and pick the `.zip`. The app shows its name
   and size.
3. Tap **Install Model**. The sheet shows:
   - **Sending model…** with a percentage over the model data. **Stop
     Update** abandons the transfer.
   - **Installing on your AkidaTag…** once the whole model is on the board.
     The board programs it into the Akida chip and runs a test inference,
     which takes a few seconds and can no longer be stopped.
4. Read the outcome and tap **Done**.

| The app says | What happened | What to do |
| --- | --- | --- |
| **Model installed** | The board programmed the model, ran a test inference with it, and is running it now. | Nothing. On an AkidaTag keyword spotting continues with the new model at once. |
| **Model delivered, but not running** | The board stored and checked the whole model but could not start it. | Restart the board so that it tries again; **Factory Reset** on the Settings screen restarts an AkidaTag. If it still will not run, this is not a model the board can run, and a different package is the way forward. |
| **Model update failed** | The transfer did not complete. The message says why. | Send the package again from the start. |

:::caution[A stopped or broken transfer leaves the board without a model]
From the moment the model data starts to arrive, the board has given up the
model it had. If the transfer is stopped, or the link drops, before it
completes, the board has no model to run until a transfer completes: on an
AkidaTag keyword spotting stops until then. Send the package again.
:::

## On the board

An AkidaTag shows the transfer on its LEDs: green on with red blinking fast
while the model is being received, both on while a block is being written,
both blinking three times when the model is running, and red on alone if the
transfer failed. A Nicla Vision with a BrainBoard1500 blinks its LED blue
quickly during a transfer.

