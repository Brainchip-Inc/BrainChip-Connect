import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  BatteryCharging,
  BatteryMedium,
  BatteryWarning,
  Cpu,
  Zap,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { RootParamList } from '../../../../App';
import BottomNavigationBar from '../../../components/custom/BottomNavigationBar';
import DeviceHeader from '../../../components/custom/DeviceHeader';
import NotificationCard from '../../../components/custom/NotificationCard';
import { AppsList } from '../../../services/ble/bleParser';
import { BatteryStateStrings } from '../../../types/batteryStateEnum';
import { RouteName, ROUTES } from '../../../types/routes';
import { useBleCommandStore } from '../../store/useBleCommandStore';
import { useBleStore } from '../../store/useBleStore';
import { useFirmwareStore } from '../../store/useFirmwareStore';
import { useNotificationsStore } from '../../store/useNotificationStore';
import { Colors } from '../../theme/theme';

type DeviceApplicationsRouteProp = RouteProp<
  RootParamList,
  'DeviceApplications'
>;
type NavigationProp = NativeStackNavigationProp<RootParamList>;

const DeviceApplicationsScreen: React.FC = () => {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const route = useRoute<DeviceApplicationsRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const {
    batteryLevel,
    batteryLoading,
    batteryError,
    deployApp,
    stopApp,
    latestDetection,
    confidence,
    requestAppInfo,
    batteryStateLabel,
  } = useBleCommandStore();

  const { connectedDevice } = useBleStore();

  const deviceName =
    route.params?.deviceName ?? connectedDevice?.name ?? 'Unknown Device';

  const deviceId = route.params?.deviceId ?? connectedDevice?.id ?? null;

  const [activeRoute, setActiveRoute] = useState<RouteName>(ROUTES.HOME);
  const [infoAppId, setInfoAppId] = useState<string | null>(null);

  const spacing = width < 375 ? 12 : 16;

  const [showNotification, setShowNotification] = useState(false);
  const { muteStatus, updateMuteStatus } = useNotificationsStore();

  const activeApp = useBleCommandStore(state => state.activeApp);
  const appList = useBleCommandStore(state => state.appsList);

  const installedBuild = useFirmwareStore(state => state.installedBuild);

  const shouldShowLabel =
    batteryStateLabel &&
    batteryStateLabel !== BatteryStateStrings.NotCharging &&
    batteryStateLabel !== BatteryStateStrings.Unknown;

  const getBatteryStateColors = (batteryStateLabel: string | null) => {
    // Charging state has highest priority
    if (batteryStateLabel === BatteryStateStrings.Charging) {
      return {
        borderColor: `${Colors.border.light}`,
        textColor: `${Colors.success}`,
        iconColor: `${Colors.success}`,
      };
    }

    if (batteryStateLabel === BatteryStateStrings.Warning) {
      return {
        borderColor: `${Colors.border.light}`,
        textColor: `${Colors.warning}`,
        iconColor: `${Colors.warning}`,
      };
    }

    if (batteryStateLabel === BatteryStateStrings.Fault) {
      return {
        borderColor: `${Colors.border.light}`,
        textColor: `${Colors.error}`,
        iconColor: `${Colors.error}`,
      };
    }

    return {
      borderColor: `${Colors.border.light}`,
      textColor: undefined,
      iconColor: undefined,
    };
  };

  const getProgressBarColor = (
    batteryLevel: string | undefined | null,
  ): string => {
    const parsed = Number(batteryLevel);

    if (!batteryLevel || Number.isNaN(parsed)) {
      return Colors.veryLightGrey;
    }

    if (parsed <= 20) return Colors.error;
    if (parsed <= 50) return Colors.warning;
    return Colors.success;
  };

  useEffect(() => {
    if (!deviceId) return;

    useBleCommandStore.getState().startDeviceSession(connectedDevice);

    return () => {
      useBleCommandStore.getState().endDeviceSession();
    };
  }, [deviceId, connectedDevice]);

  const handleDeploy = async (app: AppsList) => {
    if (!deviceId) {
      Alert.alert('Error', 'Device not connected');
      return;
    }

    try {
      await deployApp(app.id);
    } catch (error) {
      if (__DEV__) console.error('Deploy error:', error);
      Alert.alert('Error', 'Failed to deploy application');
    }
  };

  const handleStop = async (app: AppsList) => {
    if (!deviceId) return;

    try {
      await stopApp(app.id);
    } catch (error: any) {
      if (__DEV__) console.error('Stop error:', error);
      Alert.alert('Error', 'Failed to stop application');
    }
  };

  const navigateToLiveSensor = (app: AppsList) => {
    navigation.navigate('LiveSensorData', {
      appType: app.id,
      title: app.name,
    });
  };

  const navigateToNotification = () => {
    navigation.navigate('Notifications');
  };

  const muteNotifiations = () => {
    updateMuteStatus(false);
  };

  const getAppInfo = (appId: string | null) => {
    setInfoAppId(appId);
    if (appId) {
      requestAppInfo(appId);
    }
  };

  useEffect(() => {
    if (!muteStatus && activeApp) {
      if (latestDetection && confidence !== undefined) {
        setShowNotification(true);
        const timer = setTimeout(() => {
          setShowNotification(false);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [latestDetection, confidence, muteStatus, activeApp]);

  const renderAppCard = (app: AppsList) => {
    const isActive = activeApp === app.id;
    const isInfoVisible = infoAppId === app.id;

    return (
      <View
        key={app.id}
        style={[
          styles.appCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: isActive ? theme.colors.primary : Colors.border.light,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.appHeader}>
          <View style={[styles.iconBox, { borderColor: theme.colors.outline }]}>
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
                  ['Model Size', app.modelSize],
                  ['Input Shape', app.inputShape],
                  ['No of Classes', app.noOfClasses],
                  ['Akida Nodes', app.nodes],
                  ['Power Consumption', app.powerConsumption],
                ].map(([label, value]) => (
                  <View key={label} style={styles.infoRow}>
                    <Text
                      style={[styles.bullet, { color: theme.colors.primary }]}
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
                style={[styles.activeValue, { color: theme.colors.primary }]}
              >
                {latestDetection || 'Waiting...'}
              </Text>
              <Text
                style={[
                  styles.activePercent,
                  { color: theme.colors.secondary },
                ]}
              >
                {confidence ?? 0}%
              </Text>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={[styles.actionRow, { marginTop: spacing }]}>
          <Button
            mode="outlined"
            style={{ flex: 1, borderColor: theme.colors.primary }}
            onPress={() => getAppInfo(isInfoVisible ? null : app.id)}
          >
            <Text
              variant="labelSmall"
              style={{
                color: theme.colors.primary,
              }}
            >
              {isInfoVisible ? 'Less Information' : 'More Information'}
            </Text>
          </Button>

          {!isActive ? (
            <Button
              mode="contained"
              style={{ flex: 1 }}
              onPress={() => handleDeploy(app)}
            >
              <Text
                variant="labelSmall"
                style={{
                  color: theme.colors.surface,
                }}
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
                style={{
                  color: theme.colors.surface,
                }}
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
            onPress={() => navigateToLiveSensor(app)}
          >
            View Live Sensor Data
          </Button>
        )}
      </View>
    );
  };

  const { borderColor, textColor, iconColor } =
    getBatteryStateColors(batteryStateLabel);

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <DeviceHeader deviceName={deviceName} showConnectionStatus={true} />

      <View style={styles.content}>
        {/* Title - FIXED */}
        <Text style={[styles.title, { color: theme.colors.onBackground }]}>
          Select the Application
        </Text>

        {/* Firmware Build Card - FIXED (only shown when a build is installed) */}
        {installedBuild && (
          <View
            style={[
              styles.defaultCard,
              {
                backgroundColor: theme.colors.primary,
                borderColor: theme.colors.outline,
              },
            ]}
          >
            <View style={styles.defaultHeader}>
              <Cpu size={16} color={theme.colors.surface} />
              <Text
                style={[styles.defaultTitle, { color: theme.colors.surface }]}
              >
                Current Firmware Build
              </Text>
            </View>
            <Text
              variant="displaySmall"
              style={[{ color: theme.colors.surface, padding: 5 }]}
            >
              {installedBuild.title}
            </Text>
            <Text style={[styles.defaultDesc, { color: theme.colors.surface }]}>
              {installedBuild.description}
            </Text>
          </View>
        )}

        {/* Scrollable App Cards ONLY */}
        <View style={styles.scrollSection}>
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={true}
            contentContainerStyle={{ gap: 12 }}
          >
            {appList.map(app => renderAppCard(app))}
          </ScrollView>
        </View>

        {/* Device Status - FIXED at bottom */}
        <Text style={styles.statusTitle}>Device Status</Text>
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
          <View style={styles.statusCard}>
            <Text style={{ color: theme.colors.onSurfaceVariant }}>
              Loading battery information…
            </Text>
          </View>
        ) : batteryLevel ? (
          <View style={[styles.statusCard, { borderColor }]}>
            <View style={styles.statusRow}>
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
              >
                <BatteryMedium size={18} />
                <Text style={styles.statusLabel}>Battery</Text>
              </View>

              <Text
                style={{
                  fontWeight: '700',
                  color: getProgressBarColor(batteryLevel),
                }}
              >
                {batteryLevel}%
              </Text>
            </View>

            <View style={styles.progressContainer}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: getProgressBarColor(batteryLevel),
                  },
                ]}
              />
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 8,
              }}
            >
              <Text variant="labelMedium" style={{ fontWeight: '600' }}>
                {deviceName}:{' '}
              </Text>
              <Text variant="labelSmall" style={{ color: Colors.success }}>
                Connected
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginLeft: 'auto',
                }}
              >
                {batteryStateLabel === BatteryStateStrings.Charging ? (
                  <BatteryCharging size={16} color={iconColor} />
                ) : batteryStateLabel === BatteryStateStrings.Warning ? (
                  <BatteryWarning size={16} color={iconColor} />
                ) : batteryStateLabel === BatteryStateStrings.Fault ? (
                  <BatteryWarning size={16} color={iconColor} />
                ) : null}

                {shouldShowLabel ? (
                  <Text
                    style={{
                      marginLeft: 6,
                      fontWeight: '600',
                      color: textColor,
                    }}
                  >
                    {batteryStateLabel}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {showNotification && (
        <View style={styles.notificationOverlay}>
          <NotificationCard
            title={appList.find(a => a.id === activeApp)?.name ?? 'Application'}
            description={`"${latestDetection}"`}
            confidence={confidence ?? 0}
            onSeeMore={() => {
              navigateToNotification();
            }}
            onMuteNotifications={muteNotifiations}
            onClose={() => setShowNotification(false)}
          />
        </View>
      )}

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
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  title: {
    fontFamily: 'Sora',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 31,
    paddingTop: 20,
    paddingBottom: 16,
  },
  defaultCard: { padding: 12, borderWidth: 1, marginBottom: 16 },
  defaultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  defaultTitle: { fontFamily: 'Inter', fontSize: 13, fontWeight: '700' },
  defaultDesc: {
    fontFamily: 'Inter',
    fontSize: 12,
    fontWeight: '400',
    marginTop: 8,
    lineHeight: 18,
  },
  scrollSection: {
    flex: 1,
    position: 'relative',
    borderWidth: 1,
    borderColor: `${Colors.border.light}`,
    backgroundColor: `${Colors.background}`,
  },
  appCard: { padding: 15, borderWidth: 1 },
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
  statusTitle: {
    fontFamily: 'Sora',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },

  statusCard: {
    padding: 12,
    borderWidth: 1,
    borderColor: `${Colors.border.light}`,
    backgroundColor: `${Colors.white}`,
    marginBottom: 12,
  },

  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },

  statusLabel: {
    fontFamily: 'Sora',
    fontSize: 13,
    fontWeight: '700',
    color: `${Colors.black}`,
  },

  statusValue: {
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '700',
    color: `${Colors.black}`,
  },

  statusSub: {
    fontSize: 12,
    color: `${Colors.black}`,
    fontWeight: 400,
    marginTop: 2,
  },

  notificationOverlay: {
    position: 'absolute',
    top: 90,
    left: 0,
    right: 0,
    zIndex: 999,
  },
  progressContainer: {
    height: 10,
    width: '100%',
    backgroundColor: '#eee',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 10,
  },

  progressFill: {
    height: '100%',
    borderRadius: 10,
  },
});
