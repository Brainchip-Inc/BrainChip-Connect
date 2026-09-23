/**
 * Drives the BLE command store with a board that reports a detection for
 * every frame it scores, and checks that the app stays cheap enough to keep
 * answering the user.
 *
 * The human detection board sends "person" or "no_person" about eleven times
 * a second for as long as it runs. Every report used to rewrite the whole
 * event history file, which was built for a keyword board that speaks a few
 * times a minute, and at eleven writes a second the app stopped answering
 * touches within a minute. These cases pin the two rules that keep it
 * answering: only a change of reading is an event, and the history is written
 * at most once a second however many events arrive.
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

const {
  useBleCommandStore,
  deservesHistoryEntry,
} = require('../src/app/store/useBleCommandStore');
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

/** Reports per second the human detection board was measured sending. */
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

beforeEach(async () => {
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

describe('a board that reports what it sees in every frame', () => {
  beforeEach(() => {
    useBleCommandStore.setState({ activeApp: 'vision' });
  });

  it('shows every report but records only a change of reading', async () => {
    // Half a minute of an empty room, one person walking through, and the
    // room empty again: three readings, three events, 330 reports.
    const seconds = 30;
    for (let second = 0; second < seconds; second++) {
      const label = second >= 10 && second < 20 ? 'person' : 'no_person';
      for (let frame = 0; frame < REPORTS_PER_SECOND; frame++) {
        notify(report(label, 90 + frame));
      }
      expect(useBleCommandStore.getState().latestDetection).toBe(label);
      expect(useBleCommandStore.getState().confidence).toBe(
        90 + REPORTS_PER_SECOND - 1,
      );
      jest.advanceTimersByTime(1000);
      await settle();
    }

    expect(recorded().map((event: { title: string }) => event.title)).toEqual([
      'no_person',
      'person',
      'no_person',
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

  it('keeps the history file bounded by the changes over a long run', async () => {
    // Ten minutes at eleven reports a second is 6,600 reports. Written per
    // report that is 6,600 rewrites of a growing file; as changes, it is one.
    for (let second = 0; second < 600; second++) {
      for (let frame = 0; frame < REPORTS_PER_SECOND; frame++) {
        notify(report('no_person'));
      }
      jest.advanceTimersByTime(1000);
      await settle();
    }

    expect(recorded()).toHaveLength(1);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });
});

describe('a board that speaks only when it hears something', () => {
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

  it('is the rule the store applies, spelled out', () => {
    expect(deservesHistoryEntry('keyword', 'yes', 'yes')).toBe(true);
    expect(deservesHistoryEntry('vision', 'no_person', 'no_person')).toBe(
      false,
    );
    expect(deservesHistoryEntry('vision', 'no_person', 'person')).toBe(true);
    expect(deservesHistoryEntry('vision', undefined, 'no_person')).toBe(true);
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
