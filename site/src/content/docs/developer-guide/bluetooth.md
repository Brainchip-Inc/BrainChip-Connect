---
title: How the app talks to the board
description: Discovery, the command channel, detections, and the firmware and model transfers, with pointers to the specifications the boards own.
sidebar:
  order: 3
---

Everything the app does with a board goes over Bluetooth Low Energy through
`src/services/ble/bleManager.ts`. This chapter is the map: what travels on
which characteristic, where the format is specified, and which test pins the
app to it. The formats themselves are owned by the firmware repositories, so
this page points at them rather than repeating them.

:::note[The AkidaTag side]
The AkidaTag firmware is at
[github.com/Brainchip-Inc/AkidaTag](https://github.com/Brainchip-Inc/AkidaTag)
and its documentation at
[brainchip-inc.github.io/AkidaTag](https://brainchip-inc.github.io/AkidaTag/).
The files named below are the authoritative counterparts, read-only from
this repository.
:::

## How a board is recognised

The firmware advertises no service UUID. The only thing in the advertisement
that identifies the hardware is the AKD1500 accelerator id in the twelve
ASCII bytes of manufacturer data: two characters of Bluetooth protocol
version, three of firmware version, then `AKD1500`. A board is offered to the
device list when that id appears anywhere in its manufacturer data and the
board has a name; the name itself is never matched, because it differs
between boards. `akidaAcceleratorAdvertisement.ts` is the matcher, pinned by
`__tests__/akidaAcceleratorAdvertisement.test.ts` for the bytes and
`__tests__/deviceDiscovery.test.ts` for what the scan then offers.

The board's permanent serial is not advertised. It arrives as the last frame
of the device information burst once connected, and nothing before that can
identify a board: the address the phone sees rotates every fifteen minutes.

## The connection and the session

Connecting requests an MTU of 247, discovers all services and registers the
disconnect handler. Then one device session is started, in one place:
`followConnection` in `useBleCommandStore.ts` follows the connected device
in `useBleStore` and is subscribed once from `App.tsx`. Screens read the
session and never start one. The session subscribes to the board's notify
characteristic and sends, in order, the device information, battery and
application list requests, then asks for each application's details as its
entry arrives. `__tests__/deviceSession.test.ts` pins one notification
monitor across connect, disconnect and reconnect, because a second monitor
once repeated every notification.

Anything that leaves the connected board goes through
`BleConnectionHelper.returnToDeviceList`, a navigation reset, never a
`navigate` to the device list.

## The command channel

Commands and replies use a Nordic UART style service.

| Purpose | Service | Characteristic |
| --- | --- | --- |
| Commands from the phone, written without response | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` | `6e400002-…` |
| Replies, detections, audio and camera frames, by notification | same | `6e400003-…` |

Every command is one text frame, `0,0,<length>,<opcode>[:<payload>]\r`,
built by `buildCommand.tsx` from the opcodes in `bleCommands.ts`. Replies are
`<frameType>,<sequence>,<length>,<opcode>:<data>`, where frame type 0 is a
single frame and 1, 2 and 3 are the start, middle and end of a multi-frame
message whose data parts are joined. An acknowledgement is the opcode with
the data `170`. `bleParser.ts` turns all of this into typed responses.

| Opcode | Sent when | Reply |
| --- | --- | --- |
| 0, battery | at session start | `<percent>,<state>` |
| 1, device information | at session start, and by the firmware update to re-identify the board | vendor, model, firmware, hardware and serial, one frame each |
| 2, application list | at session start | one message per application: `<name>,<description>,<size in KB>` |
| 4, configuration | from the keyword spotting App Controls | `GET`, `<id>:<value>` and `RESET` forms |
| 5, application details | after each application list entry, and on More Information | model name, input shape, class count and keywords |
| 7, reset | from Factory Reset | acknowledgement, then the board restarts |
| 8, start | Run Application and Start Inference, with the application id | acknowledgement |
| 9, stream start | Start Streaming | audio or camera frames follow |
| 10, stop | Stop Application and Stop Inference | acknowledgement |
| 11, stream stop | Stop Streaming | acknowledgement |

A detection is a message with the start opcode whose data is not an
acknowledgement: `8:<label>,<confidence>`. Binary frames start with the byte
`0x42` and carry either microphone samples, command `0x0C`, or a camera
preview chunk, command `0x0D`. The AkidaTag side of all this is
`src/core/interface/ble_services/ble_initialization.c` in the AkidaTag
repository: `adv_manufacturer_data[]` for the advertisement and
`send_device_info_response()` for the frame order.

## The camera preview

Human detection preview frames arrive in chunks on the same notify
characteristic. The layout is specified under "The camera preview frame" in
`examples/bb15_nicla_vision_connect/README.md` of the
[brainboard1500_arduino_library](https://github.com/Brainchip-Inc/brainboard1500_arduino_library)
repository. `cameraPreview.ts` is the app's half of the chunk layout and
reassembly, and `src/services/image/grayscalePng.ts` turns a whole image
into a PNG data URI, because React Native cannot draw raw pixels.
`__tests__/cameraPreview.test.ts` pins the layout byte by byte and
`__tests__/grayscalePng.test.ts` checks the PNG against Node's own zlib.

Frames are skipped on purpose: the board sends its newest frame and drops
chunks in flight rather than stall the detector, so an image overtaken before
it is whole is discarded. Detections share the characteristic with the
chunks, so the chunk handler does one small copy per notification and
encodes only once per whole image; anything heavier there shows up as a
lagging detection.

## The firmware update

Firmware goes over MCUmgr's SMP protocol to the board's MCUboot bootloader,
on service `8d53dc1d-1db7-4cd3-868b-8a527460aa84`, characteristic
`da2e7828-fbce-4e01-ae9e-261174997c48`, with messages encoded by `cbor-x`.
The app requests an MTU of 498, uploads the image in chunks, marks the new
image for installation, resets the board and then looks for it again,
identifying it by the serial reported before the update and comparing the
running image's hash with the one it staged. `mcubootImage.ts` reads the
image header for its version and signing key fingerprint before anything is
sent, pinned by `__tests__/mcubootImage.test.ts`, and
`firmwareUpdateAnnouncement.ts` is the one place each ending is put into
words, pinned by `__tests__/firmwareUpdateAnnouncement.test.ts` and
`__tests__/firmwareUpdateOutcome.test.ts`.

## The model transfer

The transfer is specified in `docs/ble-model-transfer.md` in the AkidaTag
repository, and that page is the contract: both sides are built from it and
neither may change shape without it. The app's half is
`modelTransferProtocol.ts` for the wire format and `sendModelZip` in
`bleManager.ts` for the session, on service
`f000aa00-0451-4000-b000-000000000000`.

Three things about it are deliberate:

- **No block size, buffer size or file size is written down in this
  repository.** The board names the size it takes bytes in, in every status
  notification, and the app paces itself by that.
- **The board reports twice, and the two mean different things.** `DONE` is
  the file stored and verified; `READY`, seconds later, is the model
  programmed into the Akida chip and proven to infer. Only `READY` is an
  update that worked, and `ERR_PROGRAM` is a stored model this board will not
  run. `ModelUpdateOutcome` keeps the three apart and
  `describeModelUpdateEnding` is the only place they are put into words.
- **The metadata characteristics and the CRC header move together.** When
  the board's model description gains a field, the app must both extend the
  CRC header in `computeCombinedCRC32` and write the new characteristic
  before the transfer starts; getting only one half right fails the
  integrity check on the board or loads a model with zeroed metadata.

Three tests pin the app to the firmware: `__tests__/bleModelInfoCrc.test.ts`
fixes the header layout to an exact CRC, `__tests__/modelTransferProtocol.test.ts`
fixes the frame layouts, and `__tests__/bleModelTransfer.test.ts` replays
whole transfers against a fake peripheral that enforces the offset, block
boundary and block size rules. A protocol bump on the firmware side means
updating all three deliberately. The working reference sender is
`source/utils/send_model_via_ble.py` in the AkidaTag repository, and the
receiver is `source/core/interface/ble_services/file_transfer.c`.

## Edge learning

The four command codes in `src/types/edgeLearning.ts` are single bytes
written with response to characteristic
`f000bb10-0111-9000-c000-000000000000` on service `f000bb11-…`. They are not
instructions: the AkidaTag firmware feeds each one into the same state
machine as a press of a button, so code 0 toggles between inference and
class selection and codes 1 to 3 mean nothing outside class selection. The
app cannot read that state back, so the only proof the board took a command
is the write response, bounded by `EDGE_COMMAND_TIMEOUT_MS`, and the board
notifies `0xA6` on `f000bb12-…` when learning starts and `0xA7` when it
completes. `__tests__/edgeCommandTimeout.test.ts` and
`__tests__/edgeLearningControls.test.tsx` pin the controls to that.

## Two things that bite

Both cost a working transfer rather than failing loudly.

- **The MTU asked for while connecting does not stick.** A link left at the
  23-byte minimum still works and is fifteen times slower, which reads as a
  slow board rather than a bug. Both update paths call `requestLargeMtu` of
  their own accord immediately before sending.
- **A slice of a `Buffer` is not a `Buffer`.** React Native's polyfill
  returns a bare `Uint8Array` from `subarray`, so `copy`, `readUInt32LE` and
  the rest are undefined on it, while Node's Buffer in Jest returns a real
  Buffer and notices nothing. Anything handling chunks takes `Uint8Array` and
  sticks to methods both have.
