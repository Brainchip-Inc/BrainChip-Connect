/**
 * Renders the detection banner, alone and on the two screens that show it,
 * and checks that a detection reads as an event that happened at a time
 * rather than as a state the board is in.
 *
 * A BrainBoard1500 reports a person when one arrives and says nothing while
 * they stay or after they leave, and a keyword when one is heard. A banner
 * that shows only the label therefore looks frozen from the first report on:
 * the same person walking back in changes nothing on screen. The age is what
 * makes the next report visible, and both screens draw it from the one store,
 * so a report shows up on both at once.
 *
 * @format
 */

import React from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import ReactTestRenderer from 'react-test-renderer';

/** Route params the screens under test are opened with, set per case. */
let mockRouteParams: object = {};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: mockRouteParams }),
  useNavigationState: (
    select: (state: { routes: { name: string }[]; index: number }) => string,
  ) => select({ routes: [{ name: 'DeviceApplications' }], index: 0 }),
}));

jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('../src/services/ble/bleManager', () => ({
  __esModule: true,
  default: {
    sendCommand: jest.fn(async () => {}),
    subscribeToNotifications: jest.fn(() => ({ remove: jest.fn() })),
    removeSubscription: jest.fn(),
    subscribeToEdgeLearningAck: jest.fn(() => ({ remove: jest.fn() })),
    getAckEdgeMode: jest.fn(() => 'edge'),
    getAckEdgeStartMode: jest.fn(() => 'edge-start'),
  },
}));

// Required rather than imported so the mocks above are in place before the
// screens and stores are loaded.
const {
  default: DetectionBanner,
  describeAge,
  describeDetection,
} = require('../src/components/common/DetectionBanner');
const DeviceApplicationsScreen =
  require('../src/app/screens/Device/DeviceApplicationScreen').default;
const LiveSensorDataScreen =
  require('../src/app/screens/LiveSensorDataScreen').default;
const { useBleCommandStore } = require('../src/app/store/useBleCommandStore');
const { useBleStore } = require('../src/app/store/useBleStore');

/**
 * Render an element inside the app's theme provider.
 *
 * @param element - What to render.
 */
const mount = async (
  element: React.ReactElement,
): Promise<ReactTestRenderer.ReactTestRenderer> => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <PaperProvider>{element}</PaperProvider>,
    );
  });
  return renderer;
};

/**
 * Every string a rendered tree puts on screen, run together.
 *
 * @param renderer - The mounted tree.
 */
const textOf = (renderer: ReactTestRenderer.ReactTestRenderer): string =>
  renderer.root
    .findAll(node => typeof node.type === 'string')
    .flatMap(node =>
      (Array.isArray(node.props.children)
        ? node.props.children
        : [node.props.children]
      ).filter((child: unknown) => typeof child === 'string'),
    )
    .join(' ')
    .replace(/\s+/g, ' ');

const unmount = async (renderer: ReactTestRenderer.ReactTestRenderer) => {
  await ReactTestRenderer.act(() => renderer.unmount());
};

/** A moment some seconds after a fixed point in time. */
const at = (seconds: number): Date =>
  new Date(1_700_000_000_000 + seconds * 1000);

describe('putting a detection into words', () => {
  it('names what the vision model saw', () => {
    expect(describeDetection('vision', 'person')).toBe('Person detected');
    expect(describeDetection('vision', 'no_person')).toBe(
      'No person detected',
    );
  });

  it('quotes a keyword', () => {
    expect(describeDetection('keyword', 'up')).toBe('"up" detected');
  });

  it('quotes a label it has no words for', () => {
    expect(describeDetection('vision', 'cat')).toBe('"cat" detected');
  });
});

describe('saying how old a detection is', () => {
  it('calls the first two seconds just now', () => {
    expect(describeAge(at(0), at(0))).toBe('just now');
    expect(describeAge(at(0), at(1.9))).toBe('just now');
  });

  it('counts seconds, then minutes, then hours', () => {
    expect(describeAge(at(0), at(2))).toBe('2 s ago');
    expect(describeAge(at(0), at(59))).toBe('59 s ago');
    expect(describeAge(at(0), at(60))).toBe('1 min ago');
    expect(describeAge(at(0), at(59 * 60))).toBe('59 min ago');
    expect(describeAge(at(0), at(3 * 3600 + 5))).toBe('3 h ago');
  });

  it('never puts a detection in the future', () => {
    expect(describeAge(at(5), at(0))).toBe('just now');
  });
});

describe('the detection banner', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the report, its confidence and its age, and keeps the age current', async () => {
    const renderer = await mount(
      <DetectionBanner
        appId="vision"
        label="person"
        confidence={66.16}
        receivedAt={new Date()}
      />,
    );

    expect(textOf(renderer)).toContain('Person detected');
    expect(textOf(renderer)).toContain('66.2% Confidence');
    expect(textOf(renderer)).toContain('just now');

    await ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(12_000);
    });

    expect(textOf(renderer)).toContain('12 s ago');
    await unmount(renderer);
  });

  it('shows the same reading arriving again as news', async () => {
    const banner = (receivedAt: Date) => (
      <PaperProvider>
        <DetectionBanner
          appId="vision"
          label="person"
          confidence={66.16}
          receivedAt={receivedAt}
        />
      </PaperProvider>
    );
    const renderer = await mount(
      <DetectionBanner
        appId="vision"
        label="person"
        confidence={66.16}
        receivedAt={new Date(Date.now() - 30_000)}
      />,
    );
    expect(textOf(renderer)).toContain('30 s ago');

    await ReactTestRenderer.act(() => {
      renderer.update(banner(new Date()));
    });

    expect(textOf(renderer)).toContain('just now');
    expect(textOf(renderer)).not.toContain('30 s ago');
    await unmount(renderer);
  });

  it("says nothing has been detected yet in the application's own terms", async () => {
    const vision = await mount(
      <DetectionBanner
        appId="vision"
        label="Waiting..."
        confidence={0}
        receivedAt={null}
      />,
    );
    expect(textOf(vision)).toContain('No person detected yet');
    expect(textOf(vision)).not.toContain('Confidence');
    await unmount(vision);

    const keyword = await mount(
      <DetectionBanner
        appId="keyword"
        label={undefined}
        confidence={undefined}
        receivedAt={null}
      />,
    );
    expect(textOf(keyword)).toContain('No keyword detected yet');
    await unmount(keyword);
  });
});

describe('the two screens that show the detection', () => {
  const BOARD = {
    id: 'AA:BB:CC:DD:EE:02',
    name: 'BrainBoard1500',
    rssi: null,
    deviceInfo: null,
    serviceUUIDs: null,
  };

  const VISION_APP = {
    id: 'vision',
    name: 'Vision Human Detection',
    description: 'Person detection from the camera using the Akida vision model',
    size: '179 KB',
    processor: '-',
    modelName: '-',
    modelVersion: '-',
    modelSize: '-',
    inputShape: '-',
    noOfClasses: '-',
    nodes: '-',
    powerConsumption: '-',
    keywords: [],
  };

  beforeEach(() => {
    jest.useFakeTimers();
    useBleStore.getState().setConnectedDevice(BOARD);
    useBleCommandStore.setState({
      appsList: [VISION_APP],
      activeApp: 'vision',
      isInferenceRunning: true,
      latestDetection: 'person',
      confidence: 66.16,
      receivedAt: new Date(Date.now() - 20_000),
      appTransition: null,
      cameraPreview: null,
    });
  });

  afterEach(() => {
    useBleStore.getState().setConnectedDevice(null);
    useBleCommandStore.setState({
      appsList: [],
      activeApp: null,
      latestDetection: 'Waiting',
      confidence: 0,
      receivedAt: null,
    });
    jest.useRealTimers();
  });

  it('both show the latest report from the one store, and both follow the next', async () => {
    mockRouteParams = {
      deviceId: BOARD.id,
      deviceName: BOARD.name,
      rssi: -50,
    };
    const applications = await mount(<DeviceApplicationsScreen />);
    mockRouteParams = { appType: 'vision', title: 'Vision Human Detection' };
    const dashboard = await mount(<LiveSensorDataScreen />);

    for (const screen of [applications, dashboard]) {
      expect(textOf(screen)).toContain('Person detected');
      expect(textOf(screen)).toContain('66.2% Confidence');
      expect(textOf(screen)).toContain('20 s ago');
    }

    await ReactTestRenderer.act(() => {
      useBleCommandStore.setState({
        latestDetection: 'person',
        confidence: 71.5,
        receivedAt: new Date(),
      });
    });

    for (const screen of [applications, dashboard]) {
      expect(textOf(screen)).toContain('71.5% Confidence');
      expect(textOf(screen)).toContain('just now');
      expect(textOf(screen)).not.toContain('20 s ago');
    }

    await unmount(applications);
    await unmount(dashboard);
  });
});
