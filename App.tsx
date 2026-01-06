import React, { useState, useEffect } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';

import SplashScreen from './src/app/screens/SplashScreen';
import GetStartedScreen from './src/app/screens/Start/GetStartedScreen';
import HomeScreen from './src/app/screens/HomeScreen';
import DeviceDetailsScreen from './src/app/screens/DeviceDetailsScreen';
import SettingsScreen from './src/app/screens/SettingsScreen';
import { darkTheme, lightTheme } from './src/app/theme/paperTheme';

export type RootParamList = {
  Splash: undefined;
  GetStarted: undefined;
  Home: undefined;
  DeviceDetails: undefined;
  Settings: undefined;
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
    }, 1500);

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
              </>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </SafeAreaProvider>
  );
};

export default App;
