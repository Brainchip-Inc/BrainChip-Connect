import { BleCommand, BleCommandMap } from '../src/services/ble/bleCommands';
import { parseBleMessage } from '../src/services/ble/bleParser';

/**
 * The opcodes are the BLE wire protocol. They are owned by the spark firmware
 * repo's `command_type_t`, in
 * `source/include/ble_services/ble_initialization.h`, and a drifted value does
 * not fail loudly: it invokes a different firmware handler. CURRENTSTART and
 * CURRENTSTOP were written at 12 and 13 before the firmware claimed 12 for the
 * waveform stream, which made "start current measurement" start the microphone
 * stream and "stop" start current streaming.
 *
 * This table is transcribed from that header. Compare it against the header
 * itself when the firmware protocol moves, not against the trailing comments in
 * bleCommands.ts, which drifted from the values they annotated.
 */
const FIRMWARE_COMMAND_TYPE_T: Record<string, number> = {
  CMD_BATTERY: 0,
  CMD_DEVICE_INFO: 1,
  CMD_APPS: 2,
  CMD_NOTIFY: 3,
  CMD_CONFIG: 4,
  CMD_APP_INFO: 5,
  CMD_UNINSTALL: 6,
  CMD_RESET: 7,
  CMD_DEPLOY_START: 8,
  CMD_STREAM_START: 9,
  CMD_DEPLOY_STOP: 10,
  CMD_STREAM_STOP: 11,
  CMD_STREAM_WAVE: 12,
  CMD_CURRENT_START: 13,
  CMD_CURRENT_STOP: 14,
};

// App enum member -> firmware enumerator it has to equal.
const APP_TO_FIRMWARE: Array<[BleCommand, string]> = [
  [BleCommand.BATTERY, 'CMD_BATTERY'],
  [BleCommand.DEVICE_INFO, 'CMD_DEVICE_INFO'],
  [BleCommand.APPS, 'CMD_APPS'],
  [BleCommand.NOTIFY, 'CMD_NOTIFY'],
  [BleCommand.CONFIG, 'CMD_CONFIG'],
  [BleCommand.APPS_INFO, 'CMD_APP_INFO'],
  [BleCommand.UNINSTALL, 'CMD_UNINSTALL'],
  [BleCommand.RESET, 'CMD_RESET'],
  [BleCommand.DEPLOYSTART, 'CMD_DEPLOY_START'],
  [BleCommand.STREAMSTART, 'CMD_STREAM_START'],
  [BleCommand.DEPLOYSTOP, 'CMD_DEPLOY_STOP'],
  [BleCommand.STREAMSTOP, 'CMD_STREAM_STOP'],
  [BleCommand.STREAMWAVE, 'CMD_STREAM_WAVE'],
  [BleCommand.CURRENTSTART, 'CMD_CURRENT_START'],
  [BleCommand.CURRENTSTOP, 'CMD_CURRENT_STOP'],
];

describe('BleCommand opcodes', () => {
  it.each(APP_TO_FIRMWARE)(
    'opcode %i matches firmware %s',
    (opcode, firmwareName) => {
      expect(opcode).toBe(FIRMWARE_COMMAND_TYPE_T[firmwareName]);
    },
  );

  it('covers every firmware opcode exactly once', () => {
    const appValues = Object.values(BleCommand).filter(
      (v): v is number => typeof v === 'number',
    );
    expect([...appValues].sort((a, b) => a - b)).toEqual(
      Object.values(FIRMWARE_COMMAND_TYPE_T).sort((a, b) => a - b),
    );
  });

  it('keeps BleCommandMap exhaustive', () => {
    const appValues = Object.values(BleCommand).filter(
      (v): v is number => typeof v === 'number',
    );
    for (const value of appValues) {
      expect(BleCommandMap[value as BleCommand]).toBeDefined();
    }
  });
});

describe('current-measurement frames route by opcode', () => {
  // send_current_value() emits "<FRAME_SINGLE>,0,<len>,13:<1v8>,<0v8>\r".
  it('parses a current sample off opcode 13, 1.8 V rail first', () => {
    const parsed = parseBleMessage('0,0,14,13:12.34,5.67\r');
    expect(parsed).toEqual({
      type: 'CURRENT',
      data: { rail18: 12.34, rail08: 5.67 },
    });
  });

  it('parses negative rail readings', () => {
    const parsed = parseBleMessage('0,0,14,13:-1.50,-0.25\r');
    expect(parsed).toEqual({
      type: 'CURRENT',
      data: { rail18: -1.5, rail08: -0.25 },
    });
  });

  // send_ack(ACK_DONE, CMD_CURRENT_STOP) emits "14:170".
  it('recognises the CURRENT_STOP ack on opcode 14', () => {
    expect(parseBleMessage('0,0,7,14:170\r')).toEqual({
      type: 'CURRENTSTOP_ACK',
    });
  });

  it('does not treat a non-ack payload on opcode 14 as an ack', () => {
    expect(parseBleMessage('0,0,5,14:0\r')).toEqual({
      type: 'CURRENTSTOP',
      data: '0',
    });
  });

  // send_ack(ACK_DONE, CMD_STREAM_STOP) emits "11:170".
  it('recognises the STREAM_STOP ack on opcode 11', () => {
    expect(parseBleMessage('0,0,7,11:170\r')).toEqual({
      type: 'STREAMSTOP_ACK',
    });
  });

  // The bug this pins: opcode 12 is the waveform stream, not current start.
  it('leaves opcode 12 to the waveform stream', () => {
    expect(BleCommand.STREAMWAVE).toBe(12);
    expect(BleCommand.CURRENTSTART).not.toBe(12);
  });
});
