// bleParser.ts

import { AppType } from '../../app/store/useLiveSensorStore';
import { BleCommand } from './bleCommands';

export interface DeviceInfo {
  vendor: string;
  model: string;
  firmware: string;
  hardware: string;
  protocol: string;
}
export interface AppsList {
  id: AppType;
  name: string;
  description: string;
  size: string;
  processor: string;
  modelName: string;
  modelVersion: string;
  modelSize: string;
  inputShape: string;
  noOfClasses: string;
  nodes: string;
  powerConsumption: string;
  keywords: string[];
}
export interface WavePayload {
  cmd: number;
  seq: number;
  mode: 'envelope' | 'decimation';
  samples: Int16Array;
}

// One current-monitor reading, one value per supply rail. The board samples
// both rails together and sends them in a single frame.
export interface CurrentSample {
  rail08: number; // 0.8 V rail, mA
  rail18: number; // 1.8 V rail, mA
}

export type ConfigSetReason = 'ID' | 'RANGE' | 'PARSE' | 'NVS' | string;

// Firmware ACK_DONE payload for single-token "done" responses (0xAA = 170).
export const ACK_DONE_TOKEN = '170';

export type ParsedResponse =
  | { type: 'BATTERY'; data: string }
  | { type: 'DEVICE_INFO'; data: DeviceInfo }
  | { type: 'RAW'; cmd: BleCommand; data: string }
  | { type: 'DEPLOYSTART'; data: string }
  | { type: 'DEPLOYSTART_ACK' }
  | { type: 'STREAMSTART'; data: string }
  | { type: 'DEPLOYSTOP'; data: string }
  | { type: 'DEPLOYSTOP_ACK' }
  | { type: 'STREAMSTOP'; data: string }
  | { type: 'APPS'; data: string }
  | { type: 'APPS_INFO'; data: string }
  | { type: 'WAVE'; data: WavePayload }
  | { type: 'CONFIG_VALUE'; paramId: number; rawValue: string }
  | { type: 'CONFIG_SET_ACK'; paramId: number; ok: true }
  | {
      type: 'CONFIG_SET_ACK';
      paramId: number;
      ok: false;
      reason: ConfigSetReason;
    }
  | { type: 'CONFIG_RESET_ACK' }
  // Current-monitor samples arrive under CMD_CURRENT_START (13); the board
  // has no separate opcode for the stream itself.
  | { type: 'CURRENT'; data: CurrentSample }
  | { type: 'CURRENTSTOP'; data: string }
  | { type: 'CURRENTSTOP_ACK' }
  | { type: 'STREAMSTOP_ACK' };

// Binary mic-stream frame (first byte 0x42 'B', cmd 0x0C CMD_STREAM_WAVE).
// Envelope mode: 134 bytes, n_samples=64 (32 min/max pairs).
// Fallback mode: 70 bytes,  n_samples=32 (raw int16 samples).
const WAVE_MAGIC = 0x42;
const WAVE_CMD = 0x0c;

export const parseBinaryFrame = (buf: Buffer): ParsedResponse | null => {
  if (buf.length < 6 || buf[0] !== WAVE_MAGIC) return null;
  const cmd = buf[1];
  if (cmd !== WAVE_CMD) return null;

  const seq = buf.readUInt16LE(2);
  const nSamples = buf.readUInt16LE(4);
  const expectedBytes = 6 + nSamples * 2;
  if (buf.length < expectedBytes) return null;

  const mode: 'envelope' | 'decimation' =
    nSamples === 64 ? 'envelope' : 'decimation';

  const samples = new Int16Array(nSamples);
  for (let i = 0; i < nSamples; i++) {
    samples[i] = buf.readInt16LE(6 + i * 2);
  }

  return { type: 'WAVE', data: { cmd, seq, mode, samples } };
};

// Multi-frame buffer (keyed by command enum)
const multiFrameBuffer: Record<number, string[]> = {};

export const parseBleMessage = (raw: string): ParsedResponse | null => {
  if (__DEV__) console.log('buildResponse', raw);
  // Remove CR
  const cleaned = raw.replace('\r', '');

  // Split frame
  const parts = cleaned.split(',');
  if (parts.length < 4) return null;

  const frameType = Number(parts[0]); // 0=SF, 1=START, 2=MID, 3=END

  // Payload = everything after length.
  // Preserve every colon after the first one — CONFIG responses (opcode 4)
  // carry a second colon in their data (e.g. "4:0:550", "4:0:OK", "4:RESET:OK").
  const payload = parts.slice(3).join(',');
  const [cmdStr, ...rest] = payload.split(':');
  const data = rest.join(':');

  const cmd = Number(cmdStr) as BleCommand;

  // CONFIG (opcode 4) frames are self-contained — each frame is one of:
  //   "<id>:<value>"           (value from GET/RESET burst)
  //   "<id>:OK"                (SET ack, success)
  //   "<id>:ERR:<reason>"      (SET ack, failure)
  //   "RESET:OK"               (reset ack)
  // The 6-frame GET/RESET burst uses MF_START/MID/LAST for ordering, but the
  // payloads don't need concatenation — ignore the multi-frame machinery and
  // hand each frame to the builder directly.
  if (cmd === BleCommand.CONFIG) {
    return buildResponse(cmd, data);
  }

  // ---------- SINGLE FRAME ----------
  if (frameType === 0) {
    return buildResponse(cmd, data);
  }

  // ---------- MULTI FRAME ----------=

  // START → begin new message
  if (frameType === 1) {
    multiFrameBuffer[cmd] = [data];
    return null;
  }

  // MID → continue only if started
  if (frameType === 2) {
    if (multiFrameBuffer[cmd]) {
      multiFrameBuffer[cmd].push(data);
    }
    return null;
  }

  // END → finish only if started
  if (frameType === 3) {
    if (!multiFrameBuffer[cmd]) {
      // ❌ END without START → ignore
      return null;
    }

    multiFrameBuffer[cmd].push(data);

    const fullData = multiFrameBuffer[cmd].join('');
    delete multiFrameBuffer[cmd];

    return buildResponse(cmd, fullData);
  }

  // START or MID ? wait for more frames
  return null;
};

// ----------------------------------
// Command-specific response builder
// ----------------------------------
const buildResponse = (cmd: BleCommand, data: string): ParsedResponse => {
  switch (cmd) {
    case BleCommand.BATTERY:
      return {
        type: 'BATTERY',
        data: `${data}`,
      };

    case BleCommand.DEVICE_INFO: {
      const [vendor, model, firmware, hardware, protocol] = data.split(',');

      return {
        type: 'DEVICE_INFO',
        data: {
          vendor,
          model,
          firmware,
          hardware,
          protocol,
        },
      };
    }
    case BleCommand.DEPLOYSTART:
      // Firmware ≥ new build: "8:170" is the Start-inference ACK (ACK_DONE).
      // Anything else under opcode 8 is a legacy detection payload.
      if (data.trim() === ACK_DONE_TOKEN) {
        return { type: 'DEPLOYSTART_ACK' };
      }
      return {
        type: 'DEPLOYSTART',
        data: `${data}`,
      };

    case BleCommand.STREAMSTART:
      return {
        type: 'STREAMSTART',
        data: `${data}`,
      };

    case BleCommand.DEPLOYSTOP:
      if (data.trim() === ACK_DONE_TOKEN) {
        return { type: 'DEPLOYSTOP_ACK' };
      }
      return {
        type: 'DEPLOYSTOP',
        data: `${data}`,
      };

    case BleCommand.STREAMSTOP:
      if (data.trim() === ACK_DONE_TOKEN) {
        return { type: 'STREAMSTOP_ACK' };
      }
      return {
        type: 'STREAMSTOP',
        data: `${data}`,
      };

    case BleCommand.APPS:
      return {
        type: 'APPS',
        data: `${data}`,
      };

    case BleCommand.APPS_INFO:
      return {
        type: 'APPS_INFO',
        data: `${data}`,
      };

    case BleCommand.CONFIG: {
      if (data === 'RESET:OK') {
        return { type: 'CONFIG_RESET_ACK' };
      }
      const [head, mid, ...tail] = data.split(':');
      const paramId = Number(head);
      if (mid === 'OK') {
        return { type: 'CONFIG_SET_ACK', paramId, ok: true };
      }
      if (mid === 'ERR') {
        return {
          type: 'CONFIG_SET_ACK',
          paramId,
          ok: false,
          reason: tail.join(':'),
        };
      }
      return { type: 'CONFIG_VALUE', paramId, rawValue: mid ?? '' };
    }

    case BleCommand.CURRENTSTART: {
      // Opcode 13 carries the sample stream, not a start ack: the firmware
      // never acks CMD_CURRENT_START. Payload is "<rail_1_8>,<rail_0_8>"
      // (send_current_value() in ble_initialization.c), 1.8 V rail first.
      const [rail18, rail08] = data.split(',');
      return {
        type: 'CURRENT',
        data: {
          rail08: Number.parseFloat(rail08) || 0,
          rail18: Number.parseFloat(rail18) || 0,
        },
      };
    }

    case BleCommand.CURRENTSTOP:
      if (data.trim() === ACK_DONE_TOKEN) {
        return { type: 'CURRENTSTOP_ACK' };
      }
      return {
        type: 'CURRENTSTOP',
        data: `${data}`,
      };

    default:
      return {
        type: 'RAW',
        cmd,
        data,
      };
  }
};
