/**
 * A firmware update failure carrying wording the app wrote itself.
 *
 * Most of what can go wrong during an update surfaces as a `BleError` from the
 * Bluetooth stack, whose message is native text like `GATT exception from MAC
 * address ...`. That is worth having in a log and worth nothing to the person
 * holding the board, so the screen shows a failure's own message only when it
 * came from here.
 */
export class FirmwareUpdateError extends Error {}
