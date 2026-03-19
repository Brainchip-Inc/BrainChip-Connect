/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { enableScreens } from 'react-native-screens';
import { Buffer } from 'buffer';

enableScreens(true);
global.Buffer = Buffer;
AppRegistry.registerComponent(appName, () => App);
