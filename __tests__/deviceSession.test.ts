/**
 * Drives the BLE command store through connecting, disconnecting and
 * reconnecting a board, and checks that the board is listened to exactly once
 * at every point.
 *
 * Every screen showing the board used to start a session of its own when the
 * connected board changed, and every start opened another notification
 * monitor, because the check for an existing one came before an await and the
 * record of the new one after it. Disconnecting from the profile screen left
 * the old dashboard mounted under the device list, so each reconnect added a
 * monitor, and each notification was then parsed, stored and drawn once per
 * monitor: history entries repeated, application lists garbled, and the app
 * slowed with every cycle until its detection banner looked frozen. The fake
 * board here delivers each notification to every monitor left open, so a
 * second monitor shows up as a second event.
 *
 * @format
 */

import { BleData } from '../src/types/bleData';

/** The callbacks of every monitor currently open on the board. */
const monitors = new Set<(data: BleData) => void>();

const mockSubscribe = jest.fn(
  (_deviceId: string, onData: (data: BleData) => void) => {
    monitors.add(onData);
    return { remove: () => monitors.delete(onData) };
  },
);

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
    sendCommand: jest.fn(async () => {}),
    subscribeToNotifications: (
      deviceId: string,
      onData: (data: BleData) => void,
    ) => mockSubscribe(deviceId, onData),
    removeSubscription: (subscription: { remove: () => void }) =>
      subscription.remove(),
  },
}));

const {
  useBleCommandStore,
  followConnection,
} = require('../src/app/store/useBleCommandStore');
const { useBleStore } = require('../src/app/store/useBleStore');
const { useEventsStore } = require('../src/app/store/useEventStore');

const BOARD = {
  id: 'AA:BB:CC:DD:EE:02',
  name: 'BrainBoard1500',
  rssi: null,
  deviceInfo: null,
  serviceUUIDs: null,
};

/** The board sends one detection, which every open monitor receives. */
const boardReports = (label: string) =>
  monitors.forEach(onData =>
    onData({ type: 'DEPLOYSTART', data: `${label},97.25` }),
  );

/** Every event in the history, newest first. */
const recorded = () =>
  useEventsStore
    .getState()
    .events.flatMap((section: { items: unknown[] }) => section.items);

beforeEach(() => {
  jest.useFakeTimers();
  monitors.clear();
  mockSubscribe.mockClear();
  useEventsStore.setState({ events: [], todayEvents: [] });
});

afterEach(async () => {
  useBleStore.getState().setConnectedDevice(null);
  useBleCommandStore.getState().endDeviceSession();
  await useEventsStore.getState().clearEvents();
  jest.useRealTimers();
});

describe('starting a session', () => {
  it('opens one monitor however many starts land in the same tick', () => {
    const session = useBleCommandStore.getState();
    session.startDeviceSession(BOARD);
    session.startDeviceSession(BOARD);
    session.startNotifications(BOARD.id);

    expect(monitors.size).toBe(1);

    useBleCommandStore.setState({ activeApp: 'keyword' });
    boardReports('yes');

    expect(recorded()).toHaveLength(1);
    expect(useBleCommandStore.getState().latestDetection).toBe('yes');
  });
});

describe('following the connection', () => {
  let stopFollowing: () => void = () => {};

  beforeEach(() => {
    stopFollowing = followConnection();
  });

  afterEach(() => {
    stopFollowing();
  });

  it('listens once across connecting, disconnecting and connecting again', () => {
    useBleStore.getState().setConnectedDevice(BOARD);
    expect(monitors.size).toBe(1);
    expect(useBleCommandStore.getState().connectedDevice).toEqual(BOARD);

    useBleCommandStore.setState({ activeApp: 'keyword' });
    boardReports('yes');
    expect(recorded()).toHaveLength(1);

    useBleStore.getState().setConnectedDevice(null);
    expect(monitors.size).toBe(0);
    expect(useBleCommandStore.getState().connectedDevice).toBeNull();
    expect(useBleCommandStore.getState().latestDetection).toBeUndefined();
    expect(useBleCommandStore.getState().receivedAt).toBeNull();

    useBleStore.getState().setConnectedDevice({ ...BOARD });
    expect(monitors.size).toBe(1);

    useBleCommandStore.setState({ activeApp: 'keyword' });
    boardReports('no');
    expect(recorded()).toHaveLength(2);
    expect(useBleCommandStore.getState().latestDetection).toBe('no');
  });

  it('moves the session when the board comes back under another address', () => {
    useBleStore.getState().setConnectedDevice(BOARD);
    useBleStore
      .getState()
      .setConnectedDevice({ ...BOARD, id: 'AA:BB:CC:DD:EE:03' });

    expect(monitors.size).toBe(1);
    expect(mockSubscribe).toHaveBeenLastCalledWith(
      'AA:BB:CC:DD:EE:03',
      expect.any(Function),
    );
    expect(useBleCommandStore.getState().connectedDevice.id).toBe(
      'AA:BB:CC:DD:EE:03',
    );
  });

  it('leaves the session alone while the board stays the same', () => {
    useBleStore.getState().setConnectedDevice(BOARD);
    useBleStore.getState().setConnectionState('connected');
    useBleStore.getState().setScanning(true);

    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(monitors.size).toBe(1);
  });
});
