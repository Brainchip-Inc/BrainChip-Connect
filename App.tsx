import React, { useState, useEffect } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';

import SplashScreen from './src/app/screens/SplashScreen';
import GetStartedScreen from './src/app/screens/Start/GetStartedScreen';
import HomeScreen from './src/app/screens/HomeScreen';
import SettingsScreen from './src/app/screens/SettingsScreen';
import { darkTheme, lightTheme } from './src/app/theme/paperTheme';
import PermissionsScreen from './src/app/screens/Start/PermissionScreen';
import PrivacyPolicyScreen from './src/app/screens/Start/PrivacyPolicyScreen';
import TermsAndConditionsScreen from './src/app/screens/Start/TermsAndConditionsScreen';
import DevicePreviewScreen from './src/app/screens/Device/DevicePreviewScreen';
import DeviceConnectingScreen from './src/app/screens/Device/DeviceConnectingScreen';
import DeviceDetailsScreen from './src/app/screens/Device/DeviceDetailsScreen';
import DeviceDiscoveryScreen from './src/app/screens/Device/DeviceDiscoveryScreen';
import DeviceApplicationsScreen from './src/app/screens/Device/DeviceApplicationScreen';

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
  };
  DeviceConnecting: {
    deviceId: string;
    deviceName: string;
    rssi: number | null;
  };
  DeviceApplications: undefined;
};

const Stack = createNativeStackNavigator<RootParamList>();

const App = () => {
  const scheme = useColorScheme();
  const isDarkMode = scheme === 'dark';
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate app loading (1.5 sec)
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider>
      <PaperProvider theme={isDarkMode ? darkTheme : lightTheme}>
        <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {isLoading ? (
              <Stack.Screen name="Splash" component={SplashScreen} />
            ) : (
              <>
                <Stack.Screen name="GetStarted" component={GetStartedScreen} />
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen
                  name="DeviceDetails"
                  component={DeviceDetailsScreen}
                />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen
                  name="Permissions"
                  component={PermissionsScreen}
                />
                <Stack.Screen
                  name="DeviceDiscovery"
                  component={DeviceDiscoveryScreen}
                />
                <Stack.Screen
                  name="PrivacyPolicy"
                  component={PrivacyPolicyScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="TermsAndConditions"
                  component={TermsAndConditionsScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="DevicePreview"
                  component={DevicePreviewScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="DeviceConnecting"
                  component={DeviceConnectingScreen}
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="DeviceApplications"
                  component={DeviceApplicationsScreen}
                  options={{ headerShown: false }}
                />
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
};

export default App;
