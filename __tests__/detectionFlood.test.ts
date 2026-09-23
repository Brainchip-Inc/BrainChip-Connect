/**
 * Drives the BLE command store with a board that reports detections, and
 * checks that every report reaches the screen and the history while the
 * history file is written no more than once a second.
 *
 * Both demos on a BrainBoard1500 report events: a keyword when one is heard, a
 * person when one arrives, and nothing in between. Every report is therefore a
 * history entry, including the same reading twice running, which for the
 * vision model is a person who left and came back. What is kept from an
 * earlier board that reported every frame is the write rule: the file holds
 * the whole history, and rewriting it per report saturated the JavaScript
 * thread until the app stopped answering touches, so however many reports
 * arrive in a second, the file is written once.
 *
 * @format
 */

import { BleData } from '../src/types/bleData';

let notify: (data: BleData) => void = () => {};

const mockWriteFile = jest.fn(async () => {});
const mockReadFile = jest.fn(async () => '[]');
const mockExists = jest.fn(async () => false);

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/documents',
  exists: (...args: unknown[]) => mockExists(...(args as [])),
  readFile: (...args: unknown[]) => mockReadFile(...(args as [])),
  writeFile: (...args: unknown[]) => mockWriteFile(...(args as [])),
  unlink: jest.fn(async () => {}),
}));

jest.mock('../src/services/ble/bleManager', () => ({
  __esModule: true,
  default: {
    sendCommand: jest.fn(async () => {}),
    subscribeToNotifications: (
      _deviceId: string,
      onData: (data: BleData) => void,
    ) => {
      notify = onData;
      return { remove: jest.fn() };
    },
    removeSubscription: (subscription: { remove: () => void }) =>
      subscription.remove(),
  },
}));

const { useBleCommandStore } = require('../src/app/store/useBleCommandStore');
const {
  useEventsStore,
  SAVE_DELAY_MS,
} = require('../src/app/store/useEventStore');

const BOARD = {
  id: 'AA:BB:CC:DD:EE:02',
  name: 'BrainBoard1500',
  rssi: null,
  deviceInfo: null,
  serviceUUIDs: null,
};

/** Reports per second an earlier human detection board was measured sending. */
const REPORTS_PER_SECOND = 11;

/** A detection text frame, as the parser hands it to the store. */
const report = (label: string, confidence = 97.25): BleData => ({
  type: 'DEPLOYSTART',
  data: `${label},${confidence.toFixed(2)}`,
});

/** Every event in the history, newest first. */
const recorded = () =>
  useEventsStore
    .getState()
    .events.flatMap((section: { items: unknown[] }) => section.items);

/** Let the timers and the promises they start settle. */
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  jest.useFakeTimers();
  mockWriteFile.mockClear();
  useEventsStore.setState({ events: [], todayEvents: [] });
  useBleCommandStore.setState({
    connectedDevice: BOARD,
    latestDetection: 'Waiting...',
  });
  useBleCommandStore.getState().startNotifications(BOARD.id);
});

afterEach(async () => {
  await useEventsStore.getState().clearEvents();
  useBleCommandStore.getState().endDeviceSession();
  jest.useRealTimers();
});

describe('a board that reports a person when one arrives', () => {
  beforeEach(() => {
    useBleCommandStore.setState({ activeApp: 'vision' });
  });

  it('shows and records every report, including the same person coming back', () => {
    notify(report('person', 66.16));
    notify(report('person', 96.09));
    notify(report('person', 54.54));

    expect(useBleCommandStore.getState().latestDetection).toBe('person');
    expect(useBleCommandStore.getState().confidence).toBe(54.54);
    expect(useBleCommandStore.getState().receivedAt).toBeInstanceOf(Date);
    expect(recorded().map((event: { title: string }) => event.title)).toEqual([
      'person',
      'person',
      'person',
    ]);
  });

  it('writes the history file once for a second of reports, not once each', async () => {
    for (let frame = 0; frame < REPORTS_PER_SECOND; frame++) {
      notify(report(frame % 2 === 0 ? 'person' : 'no_person'));
    }
    expect(recorded()).toHaveLength(REPORTS_PER_SECOND);
    expect(mockWriteFile).not.toHaveBeenCalled();

    jest.advanceTimersByTime(SAVE_DELAY_MS);
    await settle();

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [, written] = mockWriteFile.mock.calls[0] as unknown as [
      string,
      string,
    ];
    expect(JSON.parse(written)[0].items).toHaveLength(REPORTS_PER_SECOND);
  });

  it('keeps writing once a second however long the reports go on', async () => {
    const seconds = 60;
    for (let second = 0; second < seconds; second++) {
      for (let frame = 0; frame < REPORTS_PER_SECOND; frame++) {
        notify(report('person'));
      }
      jest.advanceTimersByTime(1000);
      await settle();
    }

    expect(recorded()).toHaveLength(seconds * REPORTS_PER_SECOND);
    expect(mockWriteFile).toHaveBeenCalledTimes(seconds);
  });
});

describe('a board that reports a keyword when it hears one', () => {
  beforeEach(() => {
    useBleCommandStore.setState({ activeApp: 'keyword' });
  });

  it('records every report, including the same word twice running', () => {
    notify(report('yes'));
    notify(report('yes'));
    notify(report('no'));

    expect(recorded().map((event: { title: string }) => event.title)).toEqual([
      'no',
      'yes',
      'yes',
    ]);
  });
});

describe('the event history on disk', () => {
  it('does not let a reload throw away events that are still to be written', async () => {
    mockExists.mockResolvedValueOnce(true);
    mockReadFile.mockResolvedValueOnce('[]');
    useEventsStore.getState().addEvent({
      appId: 'keyword',
      title: 'yes',
      timestamp: Date.now(),
      confidence: 99,
      status: 'ok',
    });

    await useEventsStore.getState().loadEvents();

    expect(recorded()).toHaveLength(1);
  });

  it('forgets a pending write when the history is cleared', async () => {
    useEventsStore.getState().addEvent({
      appId: 'keyword',
      title: 'yes',
      timestamp: Date.now(),
      confidence: 99,
      status: 'ok',
    });

    await useEventsStore.getState().clearEvents();
    jest.advanceTimersByTime(SAVE_DELAY_MS);
    await settle();

    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(recorded()).toHaveLength(0);
  });
});
