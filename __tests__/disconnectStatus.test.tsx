/**
 * Pins what the screen behind a disconnect alert says about the board.
 *
 * Unpairing from the Profile screen used to forget the board while the
 * "Disconnected" alert was still up, so the screen under it read "Unknown
 * Device • Connected" until OK. A board that drops on its own left the header
 * claiming "Connected" in the same way. The board is gone in both cases, and
 * it is still the one the user was just using.
 *
 * @format
 */

import React from 'react';
import { Alert, AlertButton } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ReactTestRenderer from 'react-test-renderer';

const mockDisconnectDevice = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), reset: jest.fn() }),
  useNavigationState: (select: (state: object) => unknown) =>
    select({ index: 0, routes: [{ name: 'Profile' }] }),
}));

jest.mock('../src/services/ble/bleManager', () => ({
  __esModule: true,
  default: {
    disconnectDevice: (...args: unknown[]) => mockDisconnectDevice(...args),
  },
}));

// Required rather than imported so the mocks above are in place first.
const UserProfileScreen =
  require('../src/app/screens/UserProfileScreen').default;
const DeviceHeader = require('../src/components/custom/DeviceHeader').default;
const UnpairDeviceModal =
  require('../src/components/common/UnpairDeviceModal').default;
const BleConnectionHelper =
  require('../src/app/utils/BleConnectionHelper').default;
const { useBleStore } = require('../src/app/store/useBleStore');

const NICLA_VISION = {
  id: 'AA:BB:CC:DD:EE:01',
  name: 'NiclaVision',
  rssi: -60,
  deviceInfo: null,
  serviceUUIDs: null,
};

// The provider renders nothing until it knows the insets, which no native view
// reports here, so a phone-sized frame with no insets is supplied up front.
const PHONE_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

let alertSpy: jest.SpyInstance;
let mounted: ReactTestRenderer.ReactTestRenderer[] = [];

/**
 * Mount an element inside the providers the app's screens read from.
 *
 * @param element - The screen or component to show.
 * @returns The rendered tree.
 */
const render = async (element: React.ReactElement) => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <SafeAreaProvider initialMetrics={PHONE_METRICS}>
        <PaperProvider>{element}</PaperProvider>
      </SafeAreaProvider>,
    );
  });
  mounted.push(tree);
  return tree;
};

/**
 * Every string the rendered tree puts on screen.
 *
 * @param tree - The rendered tree to read.
 * @returns Each piece of text, in render order.
 */
const shownText = (tree: ReactTestRenderer.ReactTestRenderer): string[] =>
  tree.root
    .findAll(node => typeof node.type === 'string')
    .flatMap(node =>
      (Array.isArray(node.props.children)
        ? node.props.children
        : [node.props.children]
      ).filter((child: unknown) => typeof child === 'string'),
    );

/**
 * Tap a button on the most recent alert.
 *
 * @param label - The button's text.
 */
const tapAlertButton = async (label: string) => {
  const buttons: AlertButton[] = alertSpy.mock.calls.at(-1)[2];
  const button = buttons.find(candidate => candidate.text === label);
  await ReactTestRenderer.act(async () => {
    await button?.onPress?.();
  });
};

beforeEach(() => {
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockDisconnectDevice.mockReset().mockResolvedValue(undefined);
  useBleStore.setState({
    connectedDevice: NICLA_VISION,
    connectionState: 'connected',
  });
  BleConnectionHelper.setFotaRunning(false);
});

afterEach(async () => {
  await ReactTestRenderer.act(async () => {
    mounted.forEach(tree => tree.unmount());
  });
  mounted = [];
  alertSpy.mockRestore();
});

describe('unpairing from the Profile screen', () => {
  it('names the board and calls it disconnected behind the alert', async () => {
    const tree = await render(<UserProfileScreen navigation={{}} />);
    expect(shownText(tree)).toContain('Connected');

    await ReactTestRenderer.act(async () => {
      tree.root.findByType(UnpairDeviceModal).props.onConfirm();
    });
    await tapAlertButton('Disconnect');

    expect(mockDisconnectDevice).toHaveBeenCalledWith(NICLA_VISION.id);
    expect(alertSpy.mock.calls.at(-1)[0]).toBe('Disconnected');
    const shown = shownText(tree);
    expect(shown.filter(text => text === 'NiclaVision')).toHaveLength(2);
    expect(shown.filter(text => text === 'Disconnected')).toHaveLength(2);
    expect(shown).not.toContain('Connected');
    expect(shown).not.toContain('Unknown Device');
  });

  it('forgets the board once the alert is dismissed', async () => {
    const tree = await render(<UserProfileScreen navigation={{}} />);
    await ReactTestRenderer.act(async () => {
      tree.root.findByType(UnpairDeviceModal).props.onConfirm();
    });
    await tapAlertButton('Disconnect');
    await tapAlertButton('OK');

    expect(useBleStore.getState().connectedDevice).toBeNull();
    expect(useBleStore.getState().connectionState).toBe('disconnected');
  });
});

describe('a board that drops on its own', () => {
  it('keeps its name in the header and calls it disconnected', async () => {
    const tree = await render(
      <DeviceHeader deviceName="NiclaVision" showConnectionStatus />,
    );
    expect(shownText(tree)).toEqual(['Connect', 'NiclaVision', 'Connected']);

    await ReactTestRenderer.act(async () => {
      BleConnectionHelper.handleDisconnect(NICLA_VISION.id);
    });

    expect(shownText(tree)).toEqual(['Connect', 'NiclaVision', 'Disconnected']);
    expect(useBleStore.getState().connectedDevice).toEqual(NICLA_VISION);
  });

  it('leaves a firmware update to report its own restart', async () => {
    BleConnectionHelper.setFotaRunning(true);
    const tree = await render(
      <DeviceHeader deviceName="NiclaVision" showConnectionStatus />,
    );

    await ReactTestRenderer.act(async () => {
      BleConnectionHelper.handleDisconnect(NICLA_VISION.id);
    });

    expect(shownText(tree)).toContain('Connected');
  });
});
