import { BleCommand } from './bleCommands';

export const buildCommand = (cmd: BleCommand): string => {
  const payload = String(cmd); // enum → string
  const length = payload.length; // number of chars

  // FRAME_TYPE = 0 (Single Frame)
  // SEQ_NO     = 0
  return `0,0,${length},${payload}\r`;
};
