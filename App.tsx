import React from 'react';
import { StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';

import SplashScreen from './src/app/screens/SplashScreen';
import GetStartedScreen from './src/app/screens/Start/GetStartedScreen';
import HomeScreen from './src/app/screens/HomeScreen';
import SettingsScreen from './src/app/screens/SettingsScreen';
import BrainChipTheme from './src/app/theme/theme';
import PermissionsScreen from './src/app/screens/Start/PermissionScreen';
import PrivacyPolicyScreen from './src/app/screens/Start/PrivacyPolicyScreen';
import TermsAndConditionsScreen from './src/app/screens/Start/TermsAndConditionsScreen';
import DevicePreviewScreen from './src/app/screens/Device/DevicePreviewScreen';
import DeviceConnectingScreen from './src/app/screens/Device/DeviceConnectingScreen';
import DeviceDetailsScreen from './src/app/screens/Device/DeviceDetailsScreen';
import DeviceDiscoveryScreen from './src/app/screens/Device/DeviceDiscoveryScreen';
import DeviceApplicationsScreen from './src/app/screens/Device/DeviceApplicationScreen';
import { Base64 } from 'react-native-ble-plx';
import NotificationsScreen from './src/app/screens/NotificationsScreen';
import EventHistoryScreen from './src/app/screens/EventHistoryScreen';

export type RootParamList = {
  Splash: undefined;
  GetStarted: undefined;
  Home: undefined;
  Settings: undefined;
  Permissions: undefined;
  DeviceDiscovery: undefined;
  DeviceDetails: {
    deviceId: string;
    deviceName: string;
    rssi: number | null;
  };
  PrivacyPolicy: {
    onAccept?: () => void;
  };
  TermsAndConditions: {
    onAccept?: () => void;
  };
  DevicePreview: {
    deviceId: string;
    deviceName: string;
    rssi: number | null;
    deviceInfo: Base64 | null;
  };
  DeviceConnecting: {
    deviceId: string;
    deviceName: string;
    rssi: number | null;
    deviceInfo: Base64 | null;
  };
  DeviceApplications: {
    deviceId: string;
    deviceName: string;
    rssi: number | null;
  };
  Notifications: undefined;
  Eventhistory: undefined;
  FirmwareUpdate: undefined;
  AIModelUpdate: undefined;
};

const Stack = createNativeStackNavigator<RootParamList>();

const App = () => {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={BrainChipTheme}>
        <StatusBar barStyle="dark-content" />
        <NavigationContainer>
          <Stack.Navigator
            initialRouteName="Splash"
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="GetStarted" component={GetStartedScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen
              name="DeviceDetails"
              component={DeviceDetailsScreen}
            />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Permissions" component={PermissionsScreen} />
            <Stack.Screen
              name="DeviceDiscovery"
              component={DeviceDiscoveryScreen}
            />
            <Stack.Screen
              name="PrivacyPolicy"
              component={PrivacyPolicyScreen}
            />
            <Stack.Screen
              name="TermsAndConditions"
              component={TermsAndConditionsScreen}
            />
            <Stack.Screen
              name="DevicePreview"
              component={DevicePreviewScreen}
            />
            <Stack.Screen
              name="DeviceConnecting"
              component={DeviceConnectingScreen}
            />
            <Stack.Screen
              name="DeviceApplications"
              component={DeviceApplicationsScreen}
            />
            <Stack.Screen name="Eventhistory" component={EventHistoryScreen} />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
};

export default App;
