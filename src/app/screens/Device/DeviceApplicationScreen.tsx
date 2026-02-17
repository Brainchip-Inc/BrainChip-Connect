import { RouteProp, useRoute } from '@react-navigation/native';
import { Cpu, Zap } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button, ProgressBar, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootParamList } from '../../../../App';
import BottomNavigationBar from '../../../components/custom/BottomNavigationBar';
import DeviceHeader from '../../../components/custom/DeviceHeader';
import { DeviceInfo } from '../../../services/ble/bleParser';
import { useBleStore } from '../../store/useBleStore';
import { Colors } from '../../theme/theme';
import { RouteName, ROUTES } from '../../../types/routes';
import { Subscription } from 'react-native-ble-plx';
import { BleData } from '../../../types/bleData';
import { BleCommand } from '../../../services/ble/bleCommands';
import BleService from '../../../services/ble/bleManager';

type DeviceApplicationsRouteProp = RouteProp<
  RootParamList,
  'DeviceApplications'
>;

interface AppItem {
  id: string;
  name: string;
  description: string;
  size: string;
  active?: boolean;
  latestDetection?: string;
  confidence?: number;
  processor: string;
  modelName: string;
  modelVersion: string;
  nodes: string;
  power: string;
}

const APPS: AppItem[] = [
  {
    id: 'keyword',
    name: 'Keyword Spotting',
    description: 'Voice-activated wake word detection using microphone input',
    size: '128 kB',
    processor: 'AKD1500',
    modelName: 'DS-CNN-KWS',
    modelVersion: 'v1.0.0',
    nodes: '512 nodes',
    power: '2.3 mW',
  },
  {
    id: 'anomaly',
    name: 'Anomaly Detection',
    description:
      'Real-time anomaly detection from vibration and acoustic patterns',
    size: '96 kB',
    processor: 'AKD1500',
    modelName: 'AnomalyNet',
    modelVersion: 'v2.1.0',
    nodes: '384 nodes',
    power: '3.1 mW',
  },
  {
    id: 'imu',
    name: 'IMU Gesture',
    description: 'Motion gesture recognition using 6-axis IMU sensor data',
    size: '112 kB',
    processor: 'AKD1500',
    modelName: 'IMU-GestureNet',
    modelVersion: 'v1.3.2',
    nodes: '256 nodes',
    power: '1.9 mW',
  },
  {
    id: 'vision',
    name: 'Vision Lite',
    description: 'Lightweight image classification for object detection',
    size: '256 kB',
    processor: 'AKD1500',
    modelName: 'VisionLite-CNN',
    modelVersion: 'v3.0.0',
    nodes: '768 nodes',
    power: '4.5 mW',
  },
];

const DeviceApplicationsScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const route = useRoute<DeviceApplicationsRouteProp>();
  const { connectedDevice } = useBleStore();

  const deviceName =
    route.params?.deviceName ?? connectedDevice?.name ?? 'Unknown Device';

  const deviceId = route.params?.deviceId ?? connectedDevice?.id ?? null;

  const spacing = width < 375 ? 12 : 16;
  const horizontalPadding = width < 375 ? 16 : 20;
  const maxWidth = width >= 768 ? 640 : width;

  const [apps, setApps] = useState<AppItem[]>(APPS);
  const [activeRoute, setActiveRoute] = useState<RouteName>(ROUTES.HOME);
  const [infoAppId, setInfoAppId] = useState<string | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<string | null>(null);
  const [batteryError, setBatteryError] = useState<string | null>(null);
  const [batteryLoading, setBatteryLoading] = useState(true);
  const fullBatteryMins = 1440; // 24hrs

  // will use it for future , to send the ble command to device to activate the application
  const handleDeploy = (app: AppItem) => {
    setApps(prev =>
      prev.map(a =>
        a.id === app.id
          ? { ...a, active: true, latestDetection: 'Waiting...', confidence: 0 }
          : {
              ...a,
              active: false,
              latestDetection: undefined,
              confidence: undefined,
            },
      ),
    );
    Alert.alert('Deploying', `${app.name} is being deployed to the device.`);
  };

  const handleStop = (app: AppItem) => {
    setApps(prev =>
      prev.map(a =>
        a.id === app.id
          ? {
              ...a,
              active: false,
              latestDetection: undefined,
              confidence: undefined,
            }
          : a,
      ),
    );
    Alert.alert('Stopped', `${app.name} has been stopped.`);
  };

  const contentWidth = Math.min(width - 48, 382);

  useEffect(() => {
    let subscription: Subscription | undefined;

    const setupBle = async () => {
      try {
        setBatteryLoading(true);
        setBatteryError(null);

        subscription = await BleService.subscribeToNotifications(
          deviceId,
          (data: BleData) => {
            console.log('BLE DATA:', data);
            if (!data) return;

            if (data.type === 'BATTERY') {
              setBatteryLevel(String(data.data)); // always string
              setBatteryLoading(false);
              setBatteryError(null);
            }
          },
        );

        await BleService.sendCommand(deviceId, BleCommand.BATTERY);
      } catch (error) {
        console.error('BLE setup error:', error);
        setBatteryError('Unable to fetch battery info');
        setBatteryLoading(false);
      }
    };

    setupBle();

    return () => {
      subscription?.remove();
    };
  }, [deviceId]);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <DeviceHeader deviceName={deviceName} showConnectionStatus={true} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 120,
          alignItems: 'center',
        }}
      >
        <View style={{ width: contentWidth }}>
          {/* Title */}
          <Text style={[styles.title, { color: theme.colors.onBackground }]}>
            Select the Application
          </Text>
          {/* Default Configuration */}
          <View
            style={[
              styles.defaultCard,
              {
                backgroundColor: theme.colors.surface,
                borderColor: theme.colors.outline,
              },
            ]}
          >
            <View style={styles.defaultHeader}>
              <Cpu size={16} color={theme.colors.primary} />
              <Text
                style={[styles.defaultTitle, { color: theme.colors.onSurface }]}
              >
                Default Configuration
              </Text>
            </View>
            <Text
              style={[
                styles.defaultDesc,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              No specific firmware build installed. All 4 AI use cases are
              currently available on your device. You can install a specialized
              build from Settings → Firmware Update to optimize for specific
              applications.
            </Text>
          </View>
          {/* Application Cards */}
          {apps.map(app => {
            const isActive = app.active;
            const isInfoVisible = infoAppId === app.id;

            return (
              <View
                key={app.id}
                style={[
                  styles.appCard,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: isActive
                      ? theme.colors.primary
                      : Colors.border.light,
                  },
                ]}
              >
                {/* Header */}
                <View style={styles.appHeader}>
                  <View
                    style={[
                      styles.iconBox,
                      { borderColor: theme.colors.outline },
                    ]}
                  >
                    <Cpu size={18} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.titleRow}>
                      <Text variant="titleMedium">{app.name}</Text>
                      <Text
                        style={[
                          styles.activeBadge,
                          {
                            color: isActive
                              ? theme.colors.secondary
                              : theme.colors.error,
                          },
                        ]}
                      >
                        {isActive ? '● Active' : '● Inactive'}
                      </Text>
                    </View>
                    <Text
                      style={{
                        ...styles.appDesc,
                        color: theme.colors.onSurfaceVariant,
                      }}
                    >
                      {app.description}
                    </Text>

                    {isInfoVisible ? (
                      <View style={styles.infoBlock}>
                        {[
                          ['Processor', app.processor],
                          ['Model Name', app.modelName],
                          ['Model Version', app.modelVersion],
                          ['Model Size', app.size],
                          ['Akida Nodes', app.nodes],
                          ['Power Consumption', app.power],
                        ].map(([label, value]) => (
                          <View key={label} style={styles.infoRow}>
                            <Text
                              style={[
                                styles.bullet,
                                { color: theme.colors.primary },
                              ]}
                            >
                              ✱
                            </Text>
                            <Text
                              style={[
                                styles.infoText,
                                { color: theme.colors.onSurface },
                              ]}
                            >
                              <Text style={styles.label}>{label}:</Text> {value}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text
                        style={{
                          ...styles.sizeText,
                          color: theme.colors.onSurfaceVariant,
                        }}
                      >
                        ◦ Size: {app.size}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Active Block */}
                {isActive && (
                  <View
                    style={[
                      styles.activeBlock,
                      {
                        borderColor: theme.colors.primary,
                        backgroundColor: 'rgba(0,97,237,0.05)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.activeLabel,
                        { color: theme.colors.onSurfaceVariant },
                      ]}
                    >
                      Latest Detection
                    </Text>
                    <View style={styles.activeRow}>
                      <Text
                        style={[
                          styles.activeValue,
                          { color: theme.colors.primary },
                        ]}
                      >
                        {app.latestDetection || 'Waiting...'}
                      </Text>
                      <Text
                        style={[
                          styles.activePercent,
                          { color: theme.colors.secondary },
                        ]}
                      >
                        {app.confidence ?? 0}%
                      </Text>
                    </View>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={[styles.actionRow, { marginTop: spacing }]}>
                  {/* Toggle Info Button */}
                  <Button
                    mode="outlined"
                    style={{ flex: 1, borderColor: theme.colors.primary }}
                    onPress={() => setInfoAppId(isInfoVisible ? null : app.id)}
                  >
                    <Text
                      variant="labelSmall"
                      style={[
                        {
                          color: theme.colors.primary,
                        },
                      ]}
                    >
                      {isInfoVisible ? 'Less Information' : 'More Information'}
                    </Text>
                  </Button>

                  {/* Deploy / Stop Button */}
                  {!isActive ? (
                    <Button
                      mode="contained"
                      style={{ flex: 1 }}
                      onPress={() => handleDeploy(app)}
                    >
                      <Text
                        variant="labelSmall"
                        style={[
                          {
                            color: theme.colors.surface,
                          },
                        ]}
                      >
                        Deploy Application
                      </Text>
                    </Button>
                  ) : (
                    <Button
                      mode="contained"
                      buttonColor={theme.colors.error}
                      style={{ flex: 1 }}
                      onPress={() => handleStop(app)}
                    >
                      <Text
                        variant="labelSmall"
                        style={[
                          {
                            color: theme.colors.surface,
                          },
                        ]}
                      >
                        Stop Application
                      </Text>
                    </Button>
                  )}
                </View>

                {isActive && (
                  <Button
                    mode="contained"
                    style={{ marginTop: spacing }}
                    icon={() => <Zap size={16} color={Colors.white} />}
                    onPress={() =>
                      Alert.alert(
                        'Live Data',
                        `Viewing live sensor data for ${app.name}. (Not yet implemented)`,
                      )
                    }
                  >
                    View Live Sensor Data
                  </Button>
                )}
              </View>
            );
          })}
          {/* Device Status */}
          <Text variant="titleMedium">Device Status</Text>
          {batteryError ? (
            <View
              style={[
                styles.statusCard,
                {
                  borderColor: theme.colors.error,
                  backgroundColor: `${Colors.lightWhite}`,
                },
              ]}
            >
              <Text style={{ color: theme.colors.error }}>
                ⚠ {batteryError}. Please check your device connection.
              </Text>
            </View>
          ) : batteryLoading ? (
            <View
              style={[
                styles.statusCard,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <Text style={{ color: theme.colors.onSurfaceVariant }}>
                Loading battery information…
              </Text>
            </View>
          ) : batteryLevel ? (
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Battery</Text>
                <Text style={styles.statusValue}>{batteryLevel}%</Text>
              </View>

              <ProgressBar
                progress={Number(batteryLevel) / 100}
                color={Colors.success}
                style={styles.progress}
              />

              <View style={styles.statusFooter}>
                <Text style={styles.statusSub}>Power Mode: Balanced</Text>
                <Text style={styles.statusSub}>
                  {Math.round((Number(batteryLevel) / 100) * fullBatteryMins)}{' '}
                  minutes left
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavigationBar
        activeRoute={activeRoute}
        onNavigate={route => setActiveRoute(route)}
        notificationCount={0}
      />
    </View>
  );
};

export default DeviceApplicationsScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },
  title: {
    fontFamily: 'Sora',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 31,
    textAlign: 'center',
    marginBottom: 24,
  },
  defaultCard: { padding: 12, borderWidth: 1, marginBottom: 24 },
  defaultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  defaultTitle: { fontFamily: 'Inter', fontSize: 13, fontWeight: '700' },
  defaultDesc: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '400',
    marginTop: 8,
    lineHeight: 18,
  },
  appCard: { padding: 15, borderWidth: 1, marginBottom: 12 },
  appHeader: { flexDirection: 'row', gap: 16 },
  iconBox: {
    width: 48,
    height: 48,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appDesc: { fontSize: 13, lineHeight: 20, fontWeight: '400', marginTop: 4 },
  sizeText: { fontSize: 12, marginTop: 6 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  activeBadge: { fontSize: 12, fontWeight: '600' },
  inactiveBadge: { fontSize: 12, fontWeight: '600' },
  activeBlock: { marginTop: 12, padding: 12, borderWidth: 1 },
  activeLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
  activeRow: { flexDirection: 'row', justifyContent: 'space-between' },
  activeValue: { fontSize: 14, fontWeight: '600' },
  activePercent: { fontSize: 14, fontWeight: '600' },
  infoBlock: { marginTop: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  bullet: { fontSize: 12, marginRight: 8 },
  infoText: { fontSize: 13 },
  label: { fontWeight: '700' },
  progress: {
    height: 8,
    marginBottom: 6,
  },
  statusCard: {
    padding: 17,
    borderWidth: 1,
    borderColor: `${Colors.border.light}`,
    backgroundColor: `${Colors.white}`,
  },

  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },

  statusLabel: {
    fontFamily: 'Sora',
    fontSize: 15,
    fontWeight: '700',
    color: `${Colors.black}`,
  },

  statusValue: {
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '700',
    color: `${Colors.black}`,
  },

  statusFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  statusSub: {
    fontSize: 12,
    color: `${Colors.black}`,
    fontWeight: 400,
  },
});
