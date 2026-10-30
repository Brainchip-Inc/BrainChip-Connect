/**
 * Keeps the application list as tall as its cards.
 *
 * A board offering one application left an empty band under its card when the
 * list stretched to fill the screen down to Device Status. The list must only
 * shrink, and scroll, when its cards do not fit.
 *
 * @format
 */

import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({
    params: { deviceId: 'AA:BB:CC:DD:EE:01', deviceName: 'AkidaTag' },
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
    subscribeToNotifications: jest.fn(() => ({ remove: jest.fn() })),
    removeSubscription: jest.fn(),
  },
}));

// Required rather than imported so the mocks above are in place before the
// screen and store are loaded.
const DeviceApplicationsScreen =
  require('../src/app/screens/Device/DeviceApplicationScreen').default;
const { useBleCommandStore } = require('../src/app/store/useBleCommandStore');

/**
 * Render the application list for a board offering only keyword spotting.
 *
 * @returns The list's scroll view and the bordered frame around it.
 */
const renderOneApplication = async () => {
  useBleCommandStore.setState({
    appsList: [
      {
        id: 'keyword',
        name: 'Keyword Spotting',
        description: '-',
        size: '-',
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
    ],
    activeApp: null,
  });
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <PaperProvider>
        <DeviceApplicationsScreen />
      </PaperProvider>,
    );
  });
  const list = renderer.root.findByType(ScrollView);
  const styles = {
    listStyle: StyleSheet.flatten(list.props.style),
    frameStyle: StyleSheet.flatten(list.parent!.props.style),
  };
  await ReactTestRenderer.act(() => renderer.unmount());
  return styles;
};

describe('the application list', () => {
  afterEach(() => {
    useBleCommandStore.setState({ appsList: [] });
  });

  it('does not grow past its cards to fill the screen', async () => {
    const { listStyle, frameStyle } = await renderOneApplication();

    expect(frameStyle.flex).toBeUndefined();
    expect(frameStyle.flexGrow ?? 0).toBe(0);
    expect(listStyle.flex).toBeUndefined();
    expect(listStyle.flexGrow).toBe(0);
  });

  it('shrinks to scroll its cards when they do not fit', async () => {
    const { listStyle, frameStyle } = await renderOneApplication();

    expect(frameStyle.flexShrink).toBe(1);
    expect(listStyle.flexShrink ?? 1).toBe(1);
  });
});
