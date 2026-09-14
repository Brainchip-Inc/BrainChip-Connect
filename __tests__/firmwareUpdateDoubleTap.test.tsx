/**
 * Drives `useFirmwareUpdate` through a double tap on Install.
 *
 * The stage that disables the button is not set until after an await, so for
 * that window the button is still live. A second tap used to reach
 * `performFota`, be turned away because an update was already running, and
 * report that refusal as a failed update while the first tap's upload was in
 * flight. Telling someone their update failed while it is succeeding is the
 * same false statement this change exists to remove.
 *
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { FirmwareUpdateError } from '../src/services/firmware/firmwareUpdateError';
import { FirmwareUpdateOutcome } from '../src/types/firmwareUpdate';

const mockPerformFota = jest.fn();

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(async () => [
    { name: 'akidatag-1.2.0.signed.bin', uri: 'file:///picked.bin' },
  ]),
}));

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/caches',
  exists: jest.fn(async () => false),
  unlink: jest.fn(async () => {}),
  copyFile: jest.fn(async () => {}),
  stat: jest.fn(async () => ({ size: 2048 })),
}));

jest.mock('../src/services/firmware/trustedKeyStorage', () => ({
  getTrustedKeyHash: jest.fn(async () => null),
  rememberTrustedKeyHash: jest.fn(async () => {}),
}));

jest.mock('../src/services/ble/bleManager', () => ({
  __esModule: true,
  default: {
    isDeviceConnected: jest.fn(async () => true),
    readFirmwareImage: jest.fn(async () => ({
      version: '1.2.0',
      keyHash: null,
    })),
    performFota: (...args: unknown[]) => mockPerformFota(...args),
  },
}));

const { useFirmwareUpdate } = require('../src/app/hooks/useFirmwareUpdate');
const { useBleStore } = require('../src/app/store/useBleStore');

type FirmwareUpdateApi = ReturnType<typeof useFirmwareUpdate>;

let api: FirmwareUpdateApi;

/** Renders nothing; it exists to hand the hook's own surface to the test. */
const Harness = () => {
  api = useFirmwareUpdate();
  return null;
};

/**
 * Stand in for `performFota`'s own guard against a second update.
 *
 * The service refuses to start one while another is running, which is exactly
 * what the second tap used to trip.
 *
 * @returns A resolver for the one update it does let through.
 */
const singleUpdateAtATime = () => {
  let running = false;
  let finish: (outcome: FirmwareUpdateOutcome) => void = () => {};

  mockPerformFota.mockImplementation(() => {
    if (running) {
      return Promise.reject(
        new Error(
          'Cannot start firmware update: a firmware update is already in progress.',
        ),
      );
    }
    running = true;

    return new Promise<FirmwareUpdateOutcome>(resolve => {
      finish = outcome => {
        running = false;
        resolve(outcome);
      };
    });
  });

  return (outcome: FirmwareUpdateOutcome) => finish(outcome);
};

/** Render the hook and run one update that fails the given way. */
const runFailingUpdate = async (failure: Error) => {
  mockPerformFota.mockRejectedValue(failure);

  let renderer: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(<Harness />);
  });
  await ReactTestRenderer.act(async () => {
    await api.browseForFirmware();
  });
  await ReactTestRenderer.act(async () => {
    await api.startUpdate();
  });

  const { stage } = api;
  await ReactTestRenderer.act(() => {
    renderer.unmount();
  });

  return stage;
};

describe('reporting a failed firmware update', () => {
  beforeEach(() => {
    mockPerformFota.mockReset();
    useBleStore.getState().setConnectedDevice({
      id: 'AA:BB:CC:DD:EE:FF',
      name: 'AkidaTag',
      rssi: null,
      deviceInfo: null,
      serviceUUIDs: null,
    });
  });

  afterEach(() => {
    useBleStore.getState().setConnectedDevice(null);
  });

  it('shows the wording the app wrote for the person holding the board', async () => {
    const stage = await runFailingUpdate(
      new FirmwareUpdateError(
        'The board stopped accepting the firmware partway through.',
      ),
    );

    expect(stage).toEqual({
      kind: 'done',
      ending: {
        status: 'failed',
        detail: 'The board stopped accepting the firmware partway through.',
      },
    });
  });

  it("keeps the Bluetooth stack's own words off the screen", async () => {
    // Walking out of range mid-upload rejects the characteristic write with
    // native text naming the MAC address and the GATT operation. It belongs
    // in a log, not in front of a customer.
    const stage = await runFailingUpdate(
      new Error(
        "GATT exception from MAC address AA:BB:CC:DD:EE:FF, with type BleGattOperation{description='CHARACTERISTIC_WRITE'}",
      ),
    );

    expect(stage).toEqual({ kind: 'done', ending: { status: 'failed' } });
  });
});

describe('starting a firmware update twice', () => {
  beforeEach(() => {
    mockPerformFota.mockReset();
    useBleStore.getState().setConnectedDevice({
      id: 'AA:BB:CC:DD:EE:FF',
      name: 'AkidaTag',
      rssi: null,
      deviceInfo: null,
      serviceUUIDs: null,
    });
  });

  afterEach(() => {
    useBleStore.getState().setConnectedDevice(null);
  });

  it('ignores the second tap instead of reporting the first as failed', async () => {
    const finishUpdate = singleUpdateAtATime();

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<Harness />);
    });
    await ReactTestRenderer.act(async () => {
      await api.browseForFirmware();
    });
    expect(api.selected?.version).toBe('1.2.0');

    await ReactTestRenderer.act(async () => {
      api.startUpdate();
      api.startUpdate();
    });

    expect(mockPerformFota).toHaveBeenCalledTimes(1);
    expect(api.stage.kind).toBe('sending');

    await ReactTestRenderer.act(async () => {
      finishUpdate({ status: 'installed', version: '1.2.0' });
    });

    expect(api.stage).toEqual({
      kind: 'done',
      ending: { status: 'installed', version: '1.2.0' },
    });

    await ReactTestRenderer.act(() => {
      renderer.unmount();
    });
  });
});
