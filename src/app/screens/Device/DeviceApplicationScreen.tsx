import React, { useState } from 'react';
import { View, ScrollView, useWindowDimensions, Alert } from 'react-native';
import {
  Text,
  Button,
  useTheme,
  Divider,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cpu, Zap } from 'lucide-react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { RootParamList } from '../../../../App';
import { useBleStore } from '../../store/useBleStore';
import DeviceHeader from '../../../components/custom/DeviceHeader';
import BottomNavigationBar from '../../../components/custom/BottomNavigationBar';

type DeviceApplicationsRouteProp = RouteProp<RootParamList, 'DeviceApplications'>;

interface AppItem {
  id: string;
  name: string;
  description: string;
  size: string;
  active?: boolean;
  latestDetection?: string;
  confidence?: number;
}

const APPS: AppItem[] = [
  {
    id: 'keyword',
    name: 'Keyword Spotting',
    description: 'Voice-activated wake word detection using microphone input',
    size: '128 kB',
  },
  {
    id: 'anomaly',
    name: 'Anomaly Detection',
    description:
      'Real-time anomaly detection from vibration and acoustic patterns',
    size: '96 kB',
  },
  {
    id: 'imu',
    name: 'IMU Gesture',
    description: 'Motion gesture recognition using 6-axis IMU sensor data',
    size: '112 kB',
  },
  {
    id: 'vision',
    name: 'Vision Lite',
    description: 'Lightweight image classification for object detection',
    size: '256 kB',
  },
];

const DeviceApplicationsScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const route = useRoute<DeviceApplicationsRouteProp>();
  const { connectedDevice } = useBleStore();

  const deviceName = route.params?.deviceName ?? connectedDevice?.name ?? 'Unknown Device';

  const spacing = width < 375 ? 12 : 16;
  const horizontalPadding = width < 375 ? 16 : 20;
  const maxWidth = width >= 768 ? 640 : width;

  const [apps, setApps] = useState<AppItem[]>(APPS);
  const [activeRoute, setActiveRoute] = useState<
    'Home' | 'Notifications' | 'Settings' | 'Profile'
  >('Notifications');

  const handleDeploy = (app: AppItem) => {
    setApps(prev =>
      prev.map(a =>
        a.id === app.id
          ? { ...a, active: true, latestDetection: 'Waiting...', confidence: 0 }
          : { ...a, active: false, latestDetection: undefined, confidence: undefined },
      ),
    );
    Alert.alert('Deploying', `${app.name} is being deployed to the device.`);
  };

  const handleStop = (app: AppItem) => {
    setApps(prev =>
      prev.map(a =>
        a.id === app.id
          ? { ...a, active: false, latestDetection: undefined, confidence: undefined }
          : a,
      ),
    );
    Alert.alert('Stopped', `${app.name} has been stopped.`);
  };

  const handleMoreInfo = (app: AppItem) => {
    Alert.alert(
      app.name,
      `${app.description}\n\nModel size: ${app.size}`,
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Header Component */}
      <DeviceHeader
        deviceName={deviceName}
        showConnectionStatus={true}
      />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: spacing,
          paddingBottom: insets.bottom + 110, // space for bottom nav
          alignItems: 'center',
        }}
      >
        <View style={{ width: '100%', maxWidth }}>
          {/* TITLE */}
          <Text
            variant="headlineMedium"
            style={{ fontWeight: '700', marginBottom: spacing }}
          >
            Select the Application
          </Text>

          {/* DEFAULT CONFIG */}
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.outline,
              padding: spacing,
              marginBottom: spacing * 1.5,
            }}
          >
            <Text variant="labelMedium" style={{ marginBottom: 4 }}>
              Default Configuration
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              No specific firmware build installed. All 4 AI use cases are
              currently available on your device. You can install a specialized
              build from Settings → Firmware Update to optimize for specific
              applications.
            </Text>
          </View>

          {/* APPLICATION CARDS */}
          {apps.map(app => (
            <View
              key={app.id}
              style={{
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: app.active
                  ? theme.colors.primary
                  : theme.colors.outline,
                padding: spacing,
                marginBottom: spacing * 1.5,
              }}
            >
              {/* HEADER */}
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderWidth: 1,
                    borderColor: theme.colors.outline,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 10,
                  }}
                >
                  <Cpu size={18} color={theme.colors.primary} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text variant="titleMedium" style={{ fontWeight: '600' }}>
                    {app.name}
                  </Text>
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {app.description}
                  </Text>
                </View>

                {app.active && (
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.secondary, fontWeight: '600' }}
                  >
                    ● Active
                  </Text>
                )}
              </View>

              {/* SIZE */}
              <Text
                variant="bodySmall"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  marginTop: 6,
                }}
              >
                ◦ Size: {app.size}
              </Text>

              {/* ACTIVE BLOCK */}
              {app.active && (
                <View
                  style={{
                    backgroundColor: 'rgba(0,97,237,0.05)',
                    borderWidth: 1,
                    borderColor: 'rgba(0,97,237,0.2)',
                    padding: spacing,
                    marginTop: spacing,
                  }}
                >
                  <Text variant="labelMedium">Latest Detection</Text>

                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      marginTop: 6,
                    }}
                  >
                    <Text variant="bodyMedium">{app.latestDetection}</Text>
                    <Text
                      variant="bodyMedium"
                      style={{
                        color: theme.colors.primary,
                        fontWeight: '600',
                      }}
                    >
                      {app.confidence}%
                    </Text>
                  </View>
                </View>
              )}

              {/* ACTIONS */}
              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing,
                  marginTop: spacing,
                }}
              >
                <Button
                  mode="outlined"
                  style={{ flex: 1 }}
                  onPress={() => handleMoreInfo(app)}
                >
                  More Information
                </Button>

                {!app.active ? (
                  <Button
                    mode="contained"
                    style={{ flex: 1 }}
                    onPress={() => handleDeploy(app)}
                  >
                    Deploy Application
                  </Button>
                ) : (
                  <Button
                    mode="contained"
                    buttonColor={theme.colors.error}
                    style={{ flex: 1 }}
                    onPress={() => handleStop(app)}
                  >
                    Stop Application
                  </Button>
                )}
              </View>

              {app.active && (
                <Button
                  mode="contained"
                  style={{ marginTop: spacing }}
                  icon={() => <Zap size={16} color="#fff" />}
                  onPress={() => Alert.alert('Live Data', `Viewing live sensor data for ${app.name}. (Not yet implemented)`)}
                >
                  View Live Sensor Data
                </Button>
              )}
            </View>
          ))}

          {/* DEVICE STATUS */}
          <Text
            variant="titleMedium"
            style={{ fontWeight: '600', marginBottom: spacing }}
          >
            Device Status
          </Text>

          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.outline,
              padding: spacing,
            }}
          >
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Battery and power information will be available once device
              reporting is configured.
            </Text>
          </View>
        </View>
      </ScrollView>
      {/* Bottom Navigation */}
      <BottomNavigationBar
        activeRoute={activeRoute}
        onNavigate={route => {
          setActiveRoute(route);
          console.log('Navigated to:', route);
        }}
        notificationCount={0}
      />
    </View>
  );
};

export default DeviceApplicationsScreen;
