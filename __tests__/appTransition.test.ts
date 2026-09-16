/**
 * Drives the BLE command store through starting and stopping an application,
 * and checks what it says about the board in between.
 *
 * On a BrainBoard1500 a start is a model swap that takes about two seconds,
 * and the store used to say nothing at all for that time. What it says now
 * comes from the gap between the command and the board's acknowledgement, so
 * these cases open that gap, close it each way the board can, and insist the
 * state follows.
 *
 * @format
 */

import { BleData } from '../src/types/bleData';

let notify: (data: BleData) => void = () => {};
const mockSendCommand = jest.fn(async () => {});

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

const BOARD = {
  id: 'AA:BB:CC:DD:EE:02',
  name: 'BrainBoard1500',
  rssi: null,
  deviceInfo: null,
  serviceUUIDs: null,
};

beforeEach(async () => {
  mockSendCommand.mockClear();
  useBleCommandStore.setState({ connectedDevice: BOARD, activeApp: 'vision' });
  await useBleCommandStore.getState().startNotifications(BOARD.id);
});

afterEach(() => {
  useBleCommandStore.getState().endDeviceSession();
});

describe('what the store says while the board changes application', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports the start as under way until the board confirms it', async () => {
    const started = useBleCommandStore.getState().deployApp('vision');
    await Promise.resolve();

    expect(useBleCommandStore.getState().appTransition).toEqual({
      appId: 'vision',
      kind: 'starting',
    });
    expect(useBleCommandStore.getState().activeApp).toBe('vision');

    notify({ type: 'DEPLOYSTART_ACK' });
    await started;

    expect(useBleCommandStore.getState().appTransition).toBeNull();
    expect(useBleCommandStore.getState().isInferenceRunning).toBe(true);
  });

  it('reports the stop as under way until the board confirms it', async () => {
    const stopped = useBleCommandStore.getState().stopApp('vision');
    await Promise.resolve();

    expect(useBleCommandStore.getState().appTransition).toEqual({
      appId: 'vision',
      kind: 'stopping',
    });

    notify({ type: 'DEPLOYSTOP_ACK' });
    await stopped;

    expect(useBleCommandStore.getState().appTransition).toBeNull();
    expect(useBleCommandStore.getState().activeApp).toBeNull();
  });

  it('gives up the wait, and says so, when the board never answers', async () => {
    useBleCommandStore.setState({ activeApp: null });
    const started = useBleCommandStore.getState().deployApp('keyword');
    await Promise.resolve();
    expect(useBleCommandStore.getState().appTransition).not.toBeNull();

    jest.advanceTimersByTime(3000);

    await expect(started).rejects.toThrow('DEPLOYSTART ACK timeout');
    expect(useBleCommandStore.getState().appTransition).toBeNull();
    expect(useBleCommandStore.getState().activeApp).toBeNull();
  });

  it('gives up the wait when the command itself cannot be sent', async () => {
    mockSendCommand.mockRejectedValueOnce(new Error('Device disconnected'));

    await expect(
      useBleCommandStore.getState().deployApp('keyword'),
    ).rejects.toThrow('Device disconnected');
    expect(useBleCommandStore.getState().appTransition).toBeNull();
  });
});
