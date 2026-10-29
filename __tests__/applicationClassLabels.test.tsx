/**
 * Renders the class labels an application card shows under More Information.
 *
 * Keyword spotting lists the words it listens for as Keywords; the vision
 * demo reports what it detects, so its card must not call that a keyword.
 *
 * @format
 */

import React from 'react';
import { Button, Provider as PaperProvider } from 'react-native-paper';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({
    params: { deviceId: 'AA:BB:CC:DD:EE:02', deviceName: 'BrainBoard1500' },
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
 * Build an application card's details as the board reported them.
 *
 * @param id - The application identifier.
 * @param name - The application's display name.
 * @param keywords - The class labels from the board's details reply.
 */
const appWithLabels = (id: string, name: string, keywords: string[]) => ({
  id,
  name,
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
  keywords,
});

/**
 * Every string a rendered node puts on screen, one text element per word run.
 *
 * Strings within one text element are joined as the screen shows them, so a
 * heading rendered as `{heading}:` reads back as `Keywords:`.
 *
 * @param node - The rendered node to read.
 */
const textOf = (node: ReactTestRenderer.ReactTestInstance): string =>
  node
    .findAll(child => typeof child.type === 'string')
    .map(child =>
      (Array.isArray(child.props.children)
        ? child.props.children
        : [child.props.children]
      )
        .filter((text: unknown) => typeof text === 'string')
        .join(''),
    )
    .join(' ')
    .replace(/\s+/g, ' ');

/**
 * Render the application list with one card and open its More Information.
 *
 * @param app - The application the board reported.
 * @returns The text the opened card shows.
 */
const openInformation = async (
  app: ReturnType<typeof appWithLabels>,
): Promise<string> => {
  useBleCommandStore.setState({ appsList: [app], activeApp: null });
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    renderer = ReactTestRenderer.create(
      <PaperProvider>
        <DeviceApplicationsScreen />
      </PaperProvider>,
    );
  });
  const moreInformation = renderer.root
    .findAllByType(Button)
    .find(button => textOf(button).includes('More Information'));
  await ReactTestRenderer.act(() => moreInformation!.props.onPress());
  const shown = textOf(renderer.root);
  await ReactTestRenderer.act(() => renderer.unmount());
  return shown;
};

describe('the class labels on an application card', () => {
  afterEach(() => {
    useBleCommandStore.setState({ appsList: [] });
  });

  it('lists keyword spotting labels as Keywords', async () => {
    const shown = await openInformation(
      appWithLabels('keyword', 'Keyword Spotting', ['yes', 'no']),
    );

    expect(shown).toContain('Keywords:');
    expect(shown).toContain('yes');
    expect(shown).toContain('no');
  });

  it('does not call what the vision demo detects a keyword', async () => {
    const shown = await openInformation(
      appWithLabels('vision', 'Vision Human Detection', ['person']),
    );

    expect(shown).not.toContain('Keywords');
    expect(shown).toContain('Label:');
    expect(shown).toContain('Person detected');
  });
});
