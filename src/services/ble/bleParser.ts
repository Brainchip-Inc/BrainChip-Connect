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
}
export type ParsedResponse =
  | { type: 'BATTERY'; data: string }
  | { type: 'DEVICE_INFO'; data: DeviceInfo }
  | { type: 'RAW'; cmd: BleCommand; data: string }
  | { type: 'DEPLOYSTART'; data: string }
  | { type: 'STREAMSTART'; data: string }
  | { type: 'DEPLOYSTOP'; data: string }
  | { type: 'STREAMSTOP'; data: string }
  | { type: 'APPS'; data: string };

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
  const seq = Number(parts[1]); // parsed for future use
  const length = Number(parts[2]); // payload length parsed for future use, need to validate with the actual payload data

  // Payload = everything after length
  const payload = parts.slice(3).join(',');
  const [cmdStr, data = ''] = payload.split(':');
  // const [cmdStr, ...rest] = payload.split(':');
  // const data = rest.join(':');

  const cmd = Number(cmdStr) as BleCommand;

  // ---------- SINGLE FRAME ----------
  if (frameType === 0) {
    return buildResponse(cmd, data);
  }

  // ---------- MULTI FRAME ----------
  if (!multiFrameBuffer[cmd]) {
    multiFrameBuffer[cmd] = [];
  }

  multiFrameBuffer[cmd].push(data);

  // END frame ? emit assembled response
  if (frameType === 3) {
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
      return {
        type: 'DEPLOYSTOP',
        data: `${data}`,
      };

    case BleCommand.STREAMSTOP:
      return {
        type: 'STREAMSTOP',
        data: `${data}`,
      };

    case BleCommand.APPS:
      return {
        type: 'APPS',
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
