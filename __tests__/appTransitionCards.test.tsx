/**
 * Renders the two screens that show the board changing application.
 *
 * The application card's wording during a start is pinned as rendered rather
 * than as a constant, because a card that stays silent for the two seconds a
 * model swap takes is what this work exists to fix, and the dashboard's
 * inference button has to say the same thing at the same time.
 *
 * @format
 */

import React from 'react';
import { Button, Provider as PaperProvider } from 'react-native-paper';
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

describe('the application cards while the board changes application', () => {
  const APPS = [
    {
      id: 'keyword',
      name: 'Keyword Spotting',
      description: 'Voice-activated wake word detection using microphone input',
      size: '21 KB',
      processor: '-',
      modelName: '-',
      modelVersion: '-',
      modelSize: '-',
      inputShape: '-',
      noOfClasses: '-',
      nodes: '-',
      powerConsumption: '-',
      keywords: [],
    },
    {
      id: 'vision',
      name: 'Vision Human Detection',
      description:
        'Person detection from the camera using the Akida vision model',
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
    },
  ];

  beforeEach(() => {
    mockRouteParams = {
      deviceId: 'AA:BB:CC:DD:EE:02',
      deviceName: 'BrainBoard1500',
      rssi: -50,
    };
    useBleCommandStore.setState({ appsList: APPS, activeApp: null });
  });

  afterEach(() => {
    useBleCommandStore.setState({ appTransition: null, appsList: [] });
  });

  /** The Run and Stop buttons, in card order. */
  const actionButtons = (renderer: ReactTestRenderer.ReactTestRenderer) =>
    renderer.root
      .findAllByType(Button)
      .filter(button =>
        textOf({ root: button } as never).match(
          /Application|Starting|Stopping/,
        ),
      );

  it('says Run Application and offers it while nothing is changing', async () => {
    const renderer = await mount(<DeviceApplicationsScreen />);

    const shown = textOf(renderer);
    expect(shown).toContain('Run Application');
    expect(shown).not.toContain('Starting');
    expect(
      actionButtons(renderer).every(button => !button.props.disabled),
    ).toBe(true);
    await unmount(renderer);
  });

  it('says the application is starting until the board confirms it', async () => {
    useBleCommandStore.setState({
      appTransition: { appId: 'vision', kind: 'starting' },
    });
    const renderer = await mount(<DeviceApplicationsScreen />);

    const shown = textOf(renderer);
    expect(shown).toContain('Starting…');
    expect(shown).toContain('● Starting');
    // The keyword card keeps its own label: it is the vision model the board
    // is loading, and only one application runs at a time, so both wait.
    expect(shown).toContain('Run Application');
    const buttons = actionButtons(renderer);
    expect(buttons).toHaveLength(2);
    expect(buttons.every(button => button.props.disabled)).toBe(true);
    expect(buttons.filter(button => button.props.loading)).toHaveLength(1);
    await unmount(renderer);
  });

  it('says the application is stopping until the board confirms it', async () => {
    useBleCommandStore.setState({
      activeApp: 'keyword',
      appTransition: { appId: 'keyword', kind: 'stopping' },
    });
    const renderer = await mount(<DeviceApplicationsScreen />);

    const shown = textOf(renderer);
    expect(shown).toContain('Stopping…');
    expect(shown).toContain('● Stopping');
    expect(shown).not.toContain('● Active');
    await unmount(renderer);
  });
});

describe('the human detection dashboard', () => {
  beforeEach(() => {
    mockRouteParams = { appType: 'vision', title: 'Vision Human Detection' };
    useBleStore.getState().setConnectedDevice({
      id: 'AA:BB:CC:DD:EE:02',
      name: 'BrainBoard1500',
      rssi: null,
      deviceInfo: null,
      serviceUUIDs: null,
    });
    useBleCommandStore.setState({
      activeApp: 'vision',
      isInferenceRunning: true,
      latestDetection: 'Waiting...',
      confidence: 0,
      appTransition: null,
    });
  });

  afterEach(() => {
    useBleStore.getState().setConnectedDevice(null);
  });

  it('says inference is starting while the board loads the model', async () => {
    useBleCommandStore.setState({
      isInferenceRunning: false,
      appTransition: { appId: 'vision', kind: 'starting' },
    });
    const renderer = await mount(<LiveSensorDataScreen />);

    expect(textOf(renderer)).toContain('Starting…');
    expect(textOf(renderer)).not.toContain('Start Inference');
    await unmount(renderer);
  });
});
