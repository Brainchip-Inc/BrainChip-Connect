/**
 * Drives `sendEdgeCommand` against a board that takes the write and never
 * answers it.
 *
 * That is what an AkidaTag does when an edge learning command hangs its
 * firmware: the ATT write response never comes, the board's watchdog resets
 * it about eight seconds later, and the phone only learns of the loss when
 * the link's supervision timeout fires four seconds after that. Left to the
 * link alone, the app sat silent for twelve seconds and then blamed the
 * connection, so the service has to give up on its own and say that the
 * board did not acknowledge.
 *
 * @format
 */

import { EdgeCommand } from '../src/types/edgeLearning';

/** How the fake board answers the next characteristic write. */
let mockWrite: () => Promise<void> = async () => {};
let mockConnected = true;
const mockWriteCharacteristic = jest.fn(() => mockWrite());

jest.mock('react-native-ble-plx', () => ({
  State: { PoweredOn: 'PoweredOn' },
  BleManager: jest.fn().mockImplementation(() => ({
    isDeviceConnected: jest.fn(async () => mockConnected),
    writeCharacteristicWithResponseForDevice: mockWriteCharacteristic,
  })),
}));

const BleService = require('../src/services/ble/bleManager').default;

const DEVICE_ID = 'AA:BB:CC:DD:EE:01';

/**
 * Track whether a promise has settled yet, without awaiting it.
 *
 * @param promise - The promise to watch.
 * @returns A getter for whether it has resolved or rejected so far.
 */
const settlementOf = (promise: Promise<unknown>): (() => boolean) => {
  let settled = false;
  promise.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  return () => settled;
};

beforeEach(() => {
  jest.useFakeTimers();
  mockConnected = true;
  mockWrite = async () => {};
  mockWriteCharacteristic.mockClear();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('an edge learning command the board never acknowledges', () => {
  it('is reported as unanswered after five seconds rather than left hanging', async () => {
    mockWrite = () => new Promise<void>(() => {});

    const attempt = BleService.sendEdgeCommand(
      DEVICE_ID,
      EdgeCommand.ToggleLearningMode,
    );
    const hasSettled = settlementOf(attempt);

    await jest.advanceTimersByTimeAsync(4999);
    expect(hasSettled()).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    await expect(attempt).rejects.toThrow(
      'It did not acknowledge the command within 5 seconds.',
    );
    expect(mockWriteCharacteristic).toHaveBeenCalledTimes(1);
  });

  it('resolves as soon as the board acknowledges and leaves no timer behind', async () => {
    await expect(
      BleService.sendEdgeCommand(DEVICE_ID, EdgeCommand.NextClass),
    ).resolves.toBeUndefined();

    expect(jest.getTimerCount()).toBe(0);
  });

  it('carries the board being gone as the reason and writes nothing', async () => {
    mockConnected = false;

    await expect(
      BleService.sendEdgeCommand(DEVICE_ID, EdgeCommand.ToggleLearningMode),
    ).rejects.toThrow('The board is not connected.');
    expect(mockWriteCharacteristic).not.toHaveBeenCalled();
  });
});
