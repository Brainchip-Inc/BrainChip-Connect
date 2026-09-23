import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Base64, UUID } from 'react-native-ble-plx';
import AboutScreen from './src/app/screens/AboutScreen';
import AccountPrivacyPolicyScreen from './src/app/screens/AccountPrivacyPolicyScreen';
import AccountTermsAndConditionsScreen from './src/app/screens/AccountTermsAndConditionsScreen';
import DeviceApplicationsScreen from './src/app/screens/Device/DeviceApplicationScreen';
import DeviceConnectingScreen from './src/app/screens/Device/DeviceConnectingScreen';
import DeviceDetailsScreen from './src/app/screens/Device/DeviceDetailsScreen';
import DeviceDiscoveryScreen from './src/app/screens/Device/DeviceDiscoveryScreen';
import DevicePreviewScreen from './src/app/screens/Device/DevicePreviewScreen';
import EventHistoryScreen from './src/app/screens/EventHistoryScreen';
import HomeScreen from './src/app/screens/HomeScreen';
import LiveSensorDataScreen from './src/app/screens/LiveSensorDataScreen';
import NotificationsScreen from './src/app/screens/NotificationsScreen';
import SettingsScreen from './src/app/screens/SettingsScreen';
import SplashScreen from './src/app/screens/SplashScreen';
import GetStartedScreen from './src/app/screens/Start/GetStartedScreen';
import PermissionsScreen from './src/app/screens/Start/PermissionScreen';
import PrivacyPolicyScreen from './src/app/screens/Start/PrivacyPolicyScreen';
import TermsAndConditionsScreen from './src/app/screens/Start/TermsAndConditionsScreen';
import UserProfileScreen from './src/app/screens/UserProfileScreen';
import { followConnection } from './src/app/store/useBleCommandStore';
import { AppType } from './src/app/store/useLiveSensorStore';
import BrainChipTheme from './src/app/theme/theme';
import FirmwareUpdateScreen from './src/app/screens/FirmwareUpdateScreen';
import AIModelUpdateScreen from './src/app/screens/AIModelUpdateScreen';
import BleConnectionHelper from './src/app/utils/BleConnectionHelper';

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
    serviceUUIDs: UUID[] | null;
  };
  DeviceConnecting: {
    deviceId: string;
    deviceName: string;
    rssi: number | null;
    deviceInfo: Base64 | null;
    serviceUUIDs: UUID[] | null;
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
  LiveSensorData: {
    appType: AppType;
    title: string;
  };
  UserProfile: undefined;
  Aboutapp: undefined;
  AccountPrivacyPolicy: undefined;
  AccountTermsAndConditions: undefined;
};

const Stack = createNativeStackNavigator<RootParamList>();
const navigationRef = React.createRef<any>();

const App = () => {
  useEffect(followConnection, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={BrainChipTheme}>
        <StatusBar barStyle="dark-content" />
        <NavigationContainer
          ref={navigationRef}
          onReady={() => {
            BleConnectionHelper.setNavigationRef(navigationRef.current);
          }}
        >
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
            <Stack.Screen
              name="LiveSensorData"
              component={LiveSensorDataScreen}
            />
            <Stack.Screen name="UserProfile" component={UserProfileScreen} />
            <Stack.Screen name="Aboutapp" component={AboutScreen} />
            <Stack.Screen
              name="AccountPrivacyPolicy"
              component={AccountPrivacyPolicyScreen}
            />
            <Stack.Screen
              name="AccountTermsAndConditions"
              component={AccountTermsAndConditionsScreen}
            />
            <Stack.Screen
              name="FirmwareUpdate"
              component={FirmwareUpdateScreen}
            />
            <Stack.Screen
              name="AIModelUpdate"
              component={AIModelUpdateScreen}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
};

export default App;
