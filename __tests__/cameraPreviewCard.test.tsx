/**
 * Renders the camera preview through each state a user sees it in, on its own
 * and on the human detection dashboard.
 *
 * The preview has three states and the words for each are the whole of what
 * a user gets before the first frame, so they are pinned here as rendered
 * rather than as constants.
 *
 * @format
 */

import React from 'react';
import { Image } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import ReactTestRenderer from 'react-test-renderer';
import CameraPreview, {
  FIRST_FRAME_PATIENCE_MS,
  previewScale,
} from '../src/components/common/CameraPreview';
import { CameraPreviewFrame } from '../src/types/cameraPreview';

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
const LiveSensorDataScreen =
  require('../src/app/screens/LiveSensorDataScreen').default;
const { useBleCommandStore } = require('../src/app/store/useBleCommandStore');
const { useBleStore } = require('../src/app/store/useBleStore');
const { useLiveSensorStore } = require('../src/app/store/useLiveSensorStore');

const FRAME_ONE: CameraPreviewFrame = {
  uri: 'data:image/png;base64,one',
  width: 96,
  height: 96,
  sequence: 1,
};

/** Room a 320-point-wide phone leaves a card's content. */
const CARD_WIDTH = 320 - 40 - 32;

const FRAME_TWO: CameraPreviewFrame = {
  ...FRAME_ONE,
  uri: 'data:image/png;base64,two',
  sequence: 2,
};

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

/** The URIs of every image a rendered tree shows, in tree order. */
const imageUris = (renderer: ReactTestRenderer.ReactTestRenderer): string[] =>
  renderer.root
    .findAllByType(Image)
    .map(image => image.props.source?.uri)
    .filter((uri): uri is string => typeof uri === 'string');

const unmount = async (renderer: ReactTestRenderer.ReactTestRenderer) => {
  await ReactTestRenderer.act(() => renderer.unmount());
};

describe('choosing the size a frame is shown at', () => {
  it('gives every camera pixel the same whole number of points', () => {
    expect(previewScale(96, CARD_WIDTH)).toBe(2);
    expect(previewScale(96, 360 - 40 - 32)).toBe(3);
    expect(previewScale(96, 191)).toBe(1);
  });

  it('never shows a frame smaller than its own pixels', () => {
    expect(previewScale(240, 200)).toBe(1);
  });

  it('stops enlarging before a small frame becomes a blur', () => {
    expect(previewScale(96, 1000)).toBe(3);
  });
});

describe('the camera preview card', () => {
  it('says how to start before streaming', async () => {
    const renderer = await mount(
      <CameraPreview
        frame={null}
        streaming={false}
        deviceName="BrainBoard1500"
        maxWidth={CARD_WIDTH}
      />,
    );

    expect(textOf(renderer)).toContain(
      'Start streaming to see what the camera sees.',
    );
    expect(imageUris(renderer)).toEqual([]);
    await unmount(renderer);
  });

  it('names the board it is waiting on before the first frame', async () => {
    const renderer = await mount(
      <CameraPreview
        frame={null}
        streaming
        deviceName="BrainBoard1500"
        maxWidth={CARD_WIDTH}
      />,
    );

    expect(textOf(renderer)).toContain(
      'Waiting for the first frame from your BrainBoard1500…',
    );
    expect(textOf(renderer)).not.toContain('may not send a preview');
    await unmount(renderer);
  });

  it('says the board may not send a preview once the wait has gone on', async () => {
    jest.useFakeTimers();
    const renderer = await mount(
      <CameraPreview
        frame={null}
        streaming
        deviceName="BrainBoard1500"
        maxWidth={CARD_WIDTH}
      />,
    );

    await ReactTestRenderer.act(() => {
      jest.advanceTimersByTime(FIRST_FRAME_PATIENCE_MS);
    });

    expect(textOf(renderer)).toContain(
      'The firmware on this board may not send a preview.',
    );
    await unmount(renderer);
    jest.useRealTimers();
  });

  it('shows the frame at a whole-number scale and says what it is', async () => {
    const renderer = await mount(
      <CameraPreview
        frame={FRAME_ONE}
        streaming
        deviceName="BrainBoard1500"
        maxWidth={CARD_WIDTH}
      />,
    );

    expect(imageUris(renderer)).toEqual([FRAME_ONE.uri]);
    const shown = renderer.root.findByProps({ testID: 'camera-preview-frame' });
    expect(shown.props.style).toEqual(
      expect.arrayContaining([{ width: 192, height: 192 }]),
    );
    expect(textOf(renderer)).toContain(
      '96 × 96 grayscale, as the model sees it',
    );
    expect(textOf(renderer)).toContain('Frames are skipped');
    await unmount(renderer);
  });

  it('keeps the last frame underneath while the next one decodes', async () => {
    const renderer = await mount(
      <CameraPreview
        frame={FRAME_ONE}
        streaming
        deviceName="BrainBoard1500"
        maxWidth={CARD_WIDTH}
      />,
    );

    await ReactTestRenderer.act(() => {
      renderer.update(
        <PaperProvider>
          <CameraPreview
            frame={FRAME_TWO}
            streaming
            deviceName="BrainBoard1500"
            maxWidth={CARD_WIDTH}
          />
        </PaperProvider>,
      );
    });

    expect(imageUris(renderer)).toEqual([FRAME_ONE.uri, FRAME_TWO.uri]);
    await unmount(renderer);
  });

  it('goes back to saying how to start once streaming stops', async () => {
    const renderer = await mount(
      <CameraPreview
        frame={FRAME_ONE}
        streaming
        deviceName="BrainBoard1500"
        maxWidth={CARD_WIDTH}
      />,
    );

    await ReactTestRenderer.act(() => {
      renderer.update(
        <PaperProvider>
          <CameraPreview
            frame={null}
            streaming={false}
            deviceName="BrainBoard1500"
            maxWidth={CARD_WIDTH}
          />
        </PaperProvider>,
      );
    });

    expect(imageUris(renderer)).toEqual([]);
    expect(textOf(renderer)).toContain(
      'Start streaming to see what the camera sees.',
    );
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
      cameraPreview: null,
      appTransition: null,
    });
    useLiveSensorStore.setState({ isStreaming: false });
  });

  afterEach(() => {
    useBleStore.getState().setConnectedDevice(null);
    useLiveSensorStore.setState({ isStreaming: false });
  });

  it('shows the camera section with how to start it', async () => {
    const renderer = await mount(<LiveSensorDataScreen />);

    const shown = textOf(renderer);
    expect(shown).toContain('Camera');
    expect(shown).toContain('Start streaming to see what the camera sees.');
    expect(shown).toContain('No person detected yet');
    expect(shown).not.toContain('Live Camera Feed');
    await unmount(renderer);
  });

  it('shows the newest frame and the newest result together', async () => {
    useLiveSensorStore.setState({ isStreaming: true });
    useBleCommandStore.setState({
      cameraPreview: FRAME_ONE,
      latestDetection: 'person',
      confidence: 97.25,
    });
    const renderer = await mount(<LiveSensorDataScreen />);

    const shown = textOf(renderer);
    expect(imageUris(renderer)).toContain(FRAME_ONE.uri);
    expect(shown).toContain('Person detected');
    expect(shown).toMatch(/97\.3 ?% Confidence/);
    await unmount(renderer);
  });

  it('puts the no-person result into words rather than showing the label', async () => {
    useBleCommandStore.setState({
      latestDetection: 'no_person',
      confidence: 88.5,
    });
    const renderer = await mount(<LiveSensorDataScreen />);

    expect(textOf(renderer)).toContain('No person detected');
    expect(textOf(renderer)).not.toContain('no_person');
    await unmount(renderer);
  });
});
