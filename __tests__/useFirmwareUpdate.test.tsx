/**
 * Drives `useFirmwareUpdate` as the two firmware screens drive it.
 *
 * What the app says about an update is decided here rather than on a board, so
 * these cases cover the ways it has told people something untrue: a second tap
 * reporting a running update as failed, the Bluetooth stack's own words shown
 * as a customer explanation, and the pre-flight fingerprint warning being
 * forgotten by the refusal that proved it right.
 *
 * @format
 */

import React from 'react';
import { Alert } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { FirmwareUpdateError } from '../src/services/firmware/firmwareUpdateError';
import { FirmwareUpdateOutcome } from '../src/types/firmwareUpdate';

const BOARD_KEY = 'a9'.repeat(32);
const OTHER_KEY = 'c4'.repeat(32);

const mockPerformFota = jest.fn();
const mockPick = jest.fn();
const mockReadFirmwareImage = jest.fn();
const mockGetTrustedKeyHash = jest.fn();

jest.mock('@react-native-documents/picker', () => ({
  pick: (...args: unknown[]) => mockPick(...args),
}));

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/caches',
  exists: jest.fn(async () => false),
  unlink: jest.fn(async () => {}),
  copyFile: jest.fn(async () => {}),
  stat: jest.fn(async () => ({ size: 2048 })),
}));

jest.mock('../src/services/firmware/trustedKeyStorage', () => ({
  getTrustedKeyHash: (...args: unknown[]) => mockGetTrustedKeyHash(...args),
  rememberTrustedKeyHash: jest.fn(async () => {}),
}));

jest.mock('../src/services/ble/bleManager', () => ({
  __esModule: true,
  default: {
    isDeviceConnected: jest.fn(async () => true),
    readFirmwareImage: (...args: unknown[]) => mockReadFirmwareImage(...args),
    performFota: (...args: unknown[]) => mockPerformFota(...args),
  },
}));

const { useFirmwareUpdate } = require('../src/app/hooks/useFirmwareUpdate');
const { useBleStore } = require('../src/app/store/useBleStore');
const { useBleCommandStore } = require('../src/app/store/useBleCommandStore');

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

/** Hand the hook a board it can update, as a connected session would. */
const connectBoard = () => {
  useBleStore.getState().setConnectedDevice({
    id: 'AA:BB:CC:DD:EE:FF',
    name: 'AkidaTag',
    rssi: null,
    deviceInfo: null,
    serviceUUIDs: null,
  });
};

beforeEach(() => {
  mockPerformFota.mockReset();
  mockPick.mockResolvedValue([
    { name: 'akidatag-1.2.0.signed.bin', uri: 'file:///picked.bin' },
  ]);
  mockReadFirmwareImage.mockResolvedValue({ version: '1.2.0', keyHash: null });
  mockGetTrustedKeyHash.mockResolvedValue(null);
});

afterEach(() => {
  useBleStore.getState().setConnectedDevice(null);
});

describe('warning that a file is signed with a key the board does not trust', () => {
  beforeEach(() => {
    connectBoard();
    useBleCommandStore.setState({ deviceSerial: '0011223344556677' });
    mockGetTrustedKeyHash.mockResolvedValue(BOARD_KEY);
    mockReadFirmwareImage.mockResolvedValue({
      version: '1.2.0',
      keyHash: OTHER_KEY,
    });
  });

  afterEach(() => {
    useBleCommandStore.setState({ deviceSerial: null });
  });

  it('keeps the warning after the board refuses the file it warned about', async () => {
    // The refusal is the one thing that proves the warning right, and the
    // wording on the outcome card deliberately does not name a key, so this
    // card is the only explanation the user is left with.
    mockPerformFota.mockResolvedValue({
      status: 'rejected',
      runningVersion: '1.1.1',
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<Harness />);
    });
    await ReactTestRenderer.act(async () => {
      await api.browseForFirmware();
    });

    expect(api.keyWarning).toEqual({
      fileKeyHash: OTHER_KEY,
      boardKeyHash: BOARD_KEY,
    });

    await ReactTestRenderer.act(async () => {
      await api.startUpdate();
    });

    expect(api.stage).toEqual({
      kind: 'done',
      ending: { status: 'rejected', runningVersion: '1.1.1' },
    });
    expect(api.keyWarning).toEqual({
      fileKeyHash: OTHER_KEY,
      boardKeyHash: BOARD_KEY,
    });

    await ReactTestRenderer.act(() => {
      renderer.unmount();
    });
  });

  it("drops the warning once a file signed with the board's own key is picked", async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<Harness />);
    });
    await ReactTestRenderer.act(async () => {
      await api.browseForFirmware();
    });
    expect(api.keyWarning).not.toBeNull();

    mockReadFirmwareImage.mockResolvedValue({
      version: '1.3.0',
      keyHash: BOARD_KEY,
    });
    await ReactTestRenderer.act(async () => {
      await api.browseForFirmware();
    });

    expect(api.selected?.version).toBe('1.3.0');
    expect(api.keyWarning).toBeNull();

    await ReactTestRenderer.act(() => {
      renderer.unmount();
    });
  });
});

describe('turning down a file that cannot be read as firmware', () => {
  beforeEach(connectBoard);

  /** Pick one file and return what the user was told about it. */
  const browseAndReadTheDialog = async (failure: Error) => {
    mockReadFirmwareImage.mockRejectedValue(failure);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    let renderer: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<Harness />);
    });
    await ReactTestRenderer.act(async () => {
      await api.browseForFirmware();
    });

    const said = alert.mock.calls[0];
    alert.mockRestore();
    await ReactTestRenderer.act(() => {
      renderer.unmount();
    });

    return said;
  };

  it('says what is wrong with a file it read and did not like', async () => {
    const [title, body] = await browseAndReadTheDialog(
      new FirmwareUpdateError('This file is not AkidaTag firmware.'),
    );

    expect(title).toBe('Invalid File');
    expect(body).toBe('This file is not AkidaTag firmware.');
  });

  it("keeps the archive library's own words off the dialog", async () => {
    // A truncated or renamed zip fails inside react-native-zip-archive, whose
    // message names paths and native error codes. It belongs in a log.
    const [title, body] = await browseAndReadTheDialog(
      new Error(
        'Failed to extract file /data/user/0/com.brainchip.connect/cache/x.zip: archive is not a ZIP archive',
      ),
    );

    expect(title).toBe('Invalid File');
    expect(body).toBe('This file could not be read as firmware.');
  });
});

describe('reporting a failed firmware update', () => {
  beforeEach(connectBoard);

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
  beforeEach(connectBoard);

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
