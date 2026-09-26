/**
 * The Get Started screen draws its four feature cards with icons from the
 * lucide-react-native package rather than bundled image files, so the screen
 * mounts anywhere the package does, the test runner included.
 */

import React from 'react';
import { act, create } from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { Activity, Bluetooth, Download, LayoutGrid } from 'lucide-react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import GetStartedScreen from '../src/app/screens/Start/GetStartedScreen';

const FEATURE_TITLES = [
  'Bluetooth Low Energy',
  'AI Application Control',
  'Real-time Sensor Data',
  'Over-the-Air Updates',
];

const FEATURE_ICONS = [Bluetooth, LayoutGrid, Activity, Download];

// The provider renders nothing until it knows the insets, which no native view
// reports here, so a phone-sized frame with no insets is supplied up front.
const PHONE_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

/**
 * Mount the Get Started screen inside the providers it reads from.
 *
 * @returns The rendered tree.
 */
const renderGetStartedScreen = async () => {
  let tree: ReturnType<typeof create> | undefined;
  await act(async () => {
    tree = create(
      <SafeAreaProvider initialMetrics={PHONE_METRICS}>
        <PaperProvider>
          <NavigationContainer>
            <GetStartedScreen />
          </NavigationContainer>
        </PaperProvider>
      </SafeAreaProvider>,
    );
  });
  return tree!;
};

describe('GetStartedScreen', () => {
  it('shows one card per feature, each with an icon', async () => {
    const tree = await renderGetStartedScreen();

    for (const title of FEATURE_TITLES) {
      const matches = tree.root.findAll(node => node.props.children === title);
      expect(matches.length).toBeGreaterThan(0);
    }

    for (const Icon of FEATURE_ICONS) {
      expect(tree.root.findAllByType(Icon)).toHaveLength(1);
    }
  });
});
