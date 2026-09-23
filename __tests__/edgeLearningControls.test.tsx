/**
 * Drives the Edge Learning controls on the keyword dashboard against a board
 * that takes a command and never answers it.
 *
 * The switch used to flip the moment it was touched and the buttons gave no
 * sign that anything was in flight, so a board that had hung on the command
 * looked like one that had taken it, right up until the link timed out twelve
 * seconds later. Every control here has to keep showing the state the board
 * last confirmed, say that it is waiting, and put the failure into words when
 * the wait ends.
 *
 * @format
 */

import React from 'react';
import { Alert } from 'react-native';
import {
  Button,
  Provider as PaperProvider,
  Switch,
} from 'react-native-paper';
import ReactTestRenderer from 'react-test-renderer';

/** Settles the pending edge command the way the test decides. */
let mockSettleCommand: {
  resolve: () => void;
  reject: (error: Error) => void;
} | null = null;

const mockSendEdgeCommand = jest.fn(
  (_deviceId: string, _command: number) =>
    new Promise<void>((resolve, reject) => {
      mockSettleCommand = { resolve, reject };
    }),
);

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({
    params: { appType: 'keyword', title: 'Keyword Spotting' },
  }),
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
    sendEdgeCommand: (deviceId: string, command: number) =>
      mockSendEdgeCommand(deviceId, command),
    subscribeToNotifications: jest.fn(() => ({ remove: jest.fn() })),
    removeSubscription: jest.fn(),
    subscribeToEdgeLearningAck: jest.fn(() => ({ remove: jest.fn() })),
    getAckEdgeMode: jest.fn(() => 0xa7),
    getAckEdgeStartMode: jest.fn(() => 0xa6),
  },
}));

// Required rather than imported so the mocks above are in place before the
// screen and stores are loaded.
const LiveSensorDataScreen =
  require('../src/app/screens/LiveSensorDataScreen').default;
const { useBleCommandStore } = require('../src/app/store/useBleCommandStore');
const { useBleStore } = require('../src/app/store/useBleStore');
const { EdgeCommand } = require('../src/types/edgeLearning');

const BOARD = {
  id: 'AA:BB:CC:DD:EE:01',
  name: 'AkidaTag',
  rssi: null,
  deviceInfo: null,
  serviceUUIDs: null,
};

const NO_ANSWER = 'It did not acknowledge the command within 5 seconds.';

/**
 * Render the dashboard inside the app's theme provider.
 *
 * @returns The mounted tree.
 */
const mountDashboard = async (): Promise<ReactTestRenderer.ReactTestRenderer> => {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <PaperProvider>
        <LiveSensorDataScreen />
      </PaperProvider>,
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

/** The Edge Learning switch, the only switch on the keyword dashboard. */
const edgeSwitch = (renderer: ReactTestRenderer.ReactTestRenderer) =>
  renderer.root.findByType(Switch);

/**
 * The button carrying a label, or none if it is not on screen.
 *
 * @param renderer - The mounted tree.
 * @param label - The button's text.
 */
const buttonLabelled = (
  renderer: ReactTestRenderer.ReactTestRenderer,
  label: string,
) =>
  renderer.root
    .findAllByType(Button)
    .find(button => textOf({ root: button } as never).includes(label));

/** Touch the switch the way a user does. */
const flipSwitch = async (renderer: ReactTestRenderer.ReactTestRenderer) => {
  await ReactTestRenderer.act(async () => {
    edgeSwitch(renderer).props.onValueChange(true);
  });
};

/** Let the fake board answer the command in flight. */
const boardAcknowledges = async () => {
  await ReactTestRenderer.act(async () => {
    mockSettleCommand?.resolve();
  });
};

/** Let the command in flight fail the way the service reports it. */
const commandFails = async (reason: string) => {
  await ReactTestRenderer.act(async () => {
    mockSettleCommand?.reject(new Error(reason));
  });
};

const unmount = async (renderer: ReactTestRenderer.ReactTestRenderer) => {
  await ReactTestRenderer.act(() => renderer.unmount());
};

let alerts: jest.SpyInstance;

beforeEach(() => {
  alerts = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockSendEdgeCommand.mockClear();
  mockSettleCommand = null;
  useBleStore.getState().setConnectedDevice(BOARD);
  useBleCommandStore.setState({
    activeApp: 'keyword',
    isInferenceRunning: true,
    latestDetection: 'Waiting...',
    confidence: 0,
    receivedAt: null,
    appTransition: null,
  });
});

afterEach(() => {
  alerts.mockRestore();
  useBleStore.getState().setConnectedDevice(null);
});

describe('the Edge Learning switch', () => {
  it('waits for the board rather than flipping on touch', async () => {
    const renderer = await mountDashboard();

    await flipSwitch(renderer);

    expect(mockSendEdgeCommand).toHaveBeenCalledWith(
      BOARD.id,
      EdgeCommand.ToggleLearningMode,
    );
    expect(edgeSwitch(renderer).props.value).toBe(false);
    expect(edgeSwitch(renderer).props.disabled).toBe(true);
    expect(textOf(renderer)).toContain('Waiting for AkidaTag to confirm');
    expect(buttonLabelled(renderer, 'Start Learning')).toBeUndefined();
    await unmount(renderer);
  });

  it('stays off and says what happened when the board never answers', async () => {
    const renderer = await mountDashboard();
    await flipSwitch(renderer);

    await commandFails(NO_ANSWER);

    expect(alerts).toHaveBeenCalledTimes(1);
    const [title, message] = alerts.mock.calls[0];
    expect(title).toBe('No answer from AkidaTag');
    expect(message).toContain('The Edge Learning command was sent');
    expect(message).toContain('your AkidaTag did not confirm it');
    expect(message).toContain(NO_ANSWER);
    expect(message).toContain('Edge Learning stays as it was.');
    expect(edgeSwitch(renderer).props.value).toBe(false);
    expect(edgeSwitch(renderer).props.disabled).toBe(false);
    expect(textOf(renderer)).not.toContain('Waiting for AkidaTag');
    expect(buttonLabelled(renderer, 'Start Learning')).toBeUndefined();
    await unmount(renderer);
  });

  it('turns on only once the board has acknowledged', async () => {
    const renderer = await mountDashboard();
    await flipSwitch(renderer);

    await boardAcknowledges();

    expect(alerts).not.toHaveBeenCalled();
    expect(edgeSwitch(renderer).props.value).toBe(true);
    expect(edgeSwitch(renderer).props.disabled).toBe(false);
    expect(buttonLabelled(renderer, 'Start Learning')).toBeDefined();
    await unmount(renderer);
  });
});

describe('the Start Learning button', () => {
  /** A dashboard whose board has already confirmed edge learning mode. */
  const mountInLearningMode = async () => {
    const renderer = await mountDashboard();
    await flipSwitch(renderer);
    await boardAcknowledges();
    return renderer;
  };

  it('shows the wait and holds every control while the board is asked', async () => {
    const renderer = await mountInLearningMode();

    await ReactTestRenderer.act(async () => {
      buttonLabelled(renderer, 'Start Learning')!.props.onPress();
    });

    expect(mockSendEdgeCommand).toHaveBeenLastCalledWith(
      BOARD.id,
      EdgeCommand.StartLearning,
    );
    expect(buttonLabelled(renderer, 'Start Learning')!.props.loading).toBe(
      true,
    );
    for (const label of ['Start Learning', 'Next Class', 'Delete Class']) {
      expect(buttonLabelled(renderer, label)!.props.disabled).toBe(true);
    }
    expect(edgeSwitch(renderer).props.disabled).toBe(true);
    expect(textOf(renderer)).toContain('Waiting for AkidaTag to confirm');
    await unmount(renderer);
  });

  it('reports a board that never started learning and frees the controls', async () => {
    const renderer = await mountInLearningMode();
    await ReactTestRenderer.act(async () => {
      buttonLabelled(renderer, 'Start Learning')!.props.onPress();
    });

    await commandFails(NO_ANSWER);

    expect(alerts).toHaveBeenCalledTimes(1);
    const [title, message] = alerts.mock.calls[0];
    expect(title).toBe('No answer from AkidaTag');
    expect(message).toContain('The Start Learning command was sent');
    expect(message).toContain('Learning has not started.');
    expect(buttonLabelled(renderer, 'Start Learning')!.props.loading).toBe(
      false,
    );
    expect(buttonLabelled(renderer, 'Start Learning')!.props.disabled).toBe(
      false,
    );
    expect(edgeSwitch(renderer).props.value).toBe(true);
    await unmount(renderer);
  });
});
