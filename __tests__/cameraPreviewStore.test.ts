/**
 * Drives the BLE command store with the notifications a BrainBoard1500 sends
 * while human detection streams its preview, and checks what the store then
 * offers the screen.
 *
 * Detection results and preview chunks share one notify characteristic, so
 * these cases interleave them the way the board does and insist that a
 * detection lands the moment it arrives, whatever state the preview is in.
 *
 * @format
 */

import { Buffer } from 'buffer';
import { BleData } from '../src/types/bleData';

let notify: (data: BleData) => void = () => {};
const mockSendCommand = jest.fn(async () => {});

// A detection is also written to the event history file, which has no native
// module behind it here.
jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/documents',
  exists: jest.fn(async () => false),
  readFile: jest.fn(async () => '[]'),
  writeFile: jest.fn(async () => {}),
  unlink: jest.fn(async () => {}),
}));

jest.mock('../src/services/ble/bleManager', () => ({
  __esModule: true,
  default: {
    sendCommand: (...args: unknown[]) => mockSendCommand(...(args as [])),
    subscribeToNotifications: async (
      _deviceId: string,
      onData: (data: BleData) => void,
    ) => {
      notify = onData;
      return { remove: jest.fn() };
    },
  },
}));

const { useBleCommandStore } = require('../src/app/store/useBleCommandStore');
const { parseBinaryFrame } = require('../src/services/ble/bleParser');

const BOARD = {
  id: 'AA:BB:CC:DD:EE:02',
  name: 'BrainBoard1500',
  rssi: null,
  deviceInfo: null,
  serviceUUIDs: null,
};

const WIDTH = 96;
const HEIGHT = 96;
const CHUNK_PIXELS = 229;

/**
 * The preview chunks of one image, as the board's notifications arrive.
 *
 * @param sequence - Image number.
 * @param shade - The one value every pixel takes, so images tell apart.
 */
const previewChunks = (sequence: number, shade: number): BleData[] => {
  const pixels = new Uint8Array(WIDTH * HEIGHT).fill(shade);
  const chunks: BleData[] = [];
  for (let offset = 0; offset < pixels.length; offset += CHUNK_PIXELS) {
    const slice = pixels.subarray(offset, offset + CHUNK_PIXELS);
    const frame = Buffer.alloc(10 + slice.length);
    frame[0] = 0x42;
    frame[1] = 0x0d;
    frame.writeUInt16LE(sequence, 2);
    frame.writeUInt16LE(offset, 4);
    frame[6] = WIDTH;
    frame[7] = HEIGHT;
    frame.set(slice, 10);
    chunks.push(parseBinaryFrame(frame) as BleData);
  }
  return chunks;
};

/** A detection text frame, as the parser hands it to the store. */
const detection = (label: string, confidence: number): BleData => ({
  type: 'DEPLOYSTART',
  data: `${label},${confidence.toFixed(2)}`,
});

beforeEach(async () => {
  mockSendCommand.mockClear();
  useBleCommandStore.setState({ connectedDevice: BOARD, activeApp: 'vision' });
  await useBleCommandStore.getState().startNotifications(BOARD.id);
});

afterEach(() => {
  useBleCommandStore.getState().endDeviceSession();
});

describe('what the store offers the screen while the preview streams', () => {
  it('has no frame until a whole image has arrived', () => {
    const chunks = previewChunks(1, 40);

    chunks.slice(0, -1).forEach(notify);
    expect(useBleCommandStore.getState().cameraPreview).toBeNull();

    notify(chunks[chunks.length - 1]);
    expect(useBleCommandStore.getState().cameraPreview).toMatchObject({
      width: WIDTH,
      height: HEIGHT,
      sequence: 1,
    });
    expect(
      useBleCommandStore
        .getState()
        .cameraPreview?.uri.startsWith('data:image/png;base64,'),
    ).toBe(true);
  });

  it('keeps showing the last whole frame while the next is on its way', () => {
    previewChunks(1, 40).forEach(notify);
    const shown = useBleCommandStore.getState().cameraPreview;

    previewChunks(2, 200).slice(0, 20).forEach(notify);

    expect(useBleCommandStore.getState().cameraPreview).toBe(shown);
  });

  it('skips a frame that lost a chunk and shows the next whole one', () => {
    previewChunks(1, 40).forEach(notify);
    previewChunks(2, 90).slice(1).forEach(notify);
    previewChunks(3, 200).forEach(notify);

    expect(useBleCommandStore.getState().cameraPreview?.sequence).toBe(3);
  });

  it('lands a detection the instant it arrives, between preview chunks', () => {
    const chunks = previewChunks(1, 40);

    chunks.slice(0, 10).forEach(notify);
    notify(detection('person', 97.25));

    expect(useBleCommandStore.getState().latestDetection).toBe('person');
    expect(useBleCommandStore.getState().confidence).toBe(97.25);
    expect(useBleCommandStore.getState().cameraPreview).toBeNull();

    chunks.slice(10).forEach(notify);
    notify(detection('no_person', 88.5));

    expect(useBleCommandStore.getState().latestDetection).toBe('no_person');
    expect(useBleCommandStore.getState().cameraPreview?.sequence).toBe(1);
  });

  it('clears the frame when streaming starts and when it stops', async () => {
    previewChunks(1, 40).forEach(notify);
    expect(useBleCommandStore.getState().cameraPreview).not.toBeNull();

    await useBleCommandStore.getState().stopStreaming('vision');
    expect(useBleCommandStore.getState().cameraPreview).toBeNull();
    expect(mockSendCommand).toHaveBeenLastCalledWith(BOARD.id, '11:vision,0');

    previewChunks(2, 90).forEach(notify);
    await useBleCommandStore.getState().startStreaming('vision');
    expect(useBleCommandStore.getState().cameraPreview).toBeNull();
    expect(mockSendCommand).toHaveBeenLastCalledWith(BOARD.id, '9:vision,1');
  });

  it('does not finish an image across a stop with the chunks from before it', async () => {
    const before = previewChunks(1, 40);
    before.slice(0, 20).forEach(notify);

    await useBleCommandStore.getState().stopStreaming('vision');
    await useBleCommandStore.getState().startStreaming('vision');
    before.slice(20).forEach(notify);

    expect(useBleCommandStore.getState().cameraPreview).toBeNull();
  });
});
