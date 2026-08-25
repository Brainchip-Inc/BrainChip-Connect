import React, { useState, useEffect, useRef } from 'react';
import { View, useWindowDimensions, Alert } from 'react-native';
import { Text, useTheme, ProgressBar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bluetooth, CheckCircle2, Loader } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootParamList } from '../../../../App';
import BleService from '../../../services/ble/bleManager';
import { useBleStore } from '../../store/useBleStore';
import { Colors } from '../../theme/theme';
import { useDeviceAuthStore } from '../../store/useDeviceAuthStore';
import { useBleCommandStore } from '../../store/useBleCommandStore';

type DeviceConnectingRouteProp = RouteProp<RootParamList, 'DeviceConnecting'>;

// Total time we'll wait for connection + auth before giving up
const CONNECTION_TIMEOUT_MS = 20000;

const ConnectionSteps = [
  { id: 1, label: 'Authenticating' },
  { id: 2, label: 'Establishing connection' },
  { id: 3, label: 'Syncing configuration' },
];

const DeviceConnectingScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootParamList>>();
  const route = useRoute<DeviceConnectingRouteProp>();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { deviceId, deviceName, rssi, deviceInfo, serviceUUIDs, deviceType } =
    route.params;
  const { setConnectedDevice, setConnectionState } = useBleStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const isMountedRef = useRef(true);

  const isSmallDevice = width < 375;
  const isMediumDevice = width >= 375 && width < 768;
  const isLargeDevice = width >= 768;

  const spacing = isSmallDevice ? 12 : isMediumDevice ? 16 : 20;
  const horizontalPadding = isSmallDevice
    ? 16
    : isMediumDevice
    ? 20
    : Math.min(width * 0.1, 80);
  const maxWidth = isLargeDevice ? 600 : width;
  const authenticateDevice = useDeviceAuthStore(
    state => state.authenticateDevice,
  );

  useEffect(() => {
    isMountedRef.current = true;
    const totalSteps = ConnectionSteps.length;

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    // Overall timeout covering auth + BLE connect. If the whole flow doesn't
    // complete within CONNECTION_TIMEOUT_MS we abort and surface an error.
    const overallTimeout = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        // Best-effort cancel of any in-flight BLE attempt
        BleService.disconnectDevice(deviceId).catch(() => {});
        reject(
          new Error(
            'Connection timed out. Please check your network and that the device is in range, then try again.',
          ),
        );
      }, CONNECTION_TIMEOUT_MS);
    });

    const advanceStep = (stepIndex: number) => {
      if (!isMountedRef.current) return;
      setCurrentStep(stepIndex);
      setProgress(stepIndex / totalSteps);
    };

    const connectDevice = async () => {
      try {
        setConnectionState('connecting');

        const deviceUniqServiceId = serviceUUIDs![0];

        // Race the entire auth + BLE connect flow against the overall timeout
        await Promise.race([
          (async () => {
            // STEP 1: Authenticate with server
            advanceStep(0);
            await authenticateDevice(
              deviceId,
              deviceName,
              deviceType,
              deviceUniqServiceId!,
            );

            // STEP 2: Establish BLE connection
            advanceStep(1);
            await BleService.connectDevice(deviceId, () => {
              Alert.alert(
                'Device Disconnected',
                'The device connection was lost.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      setConnectedDevice(null);
                      setConnectionState('disconnected');
                      navigation.replace('DeviceDiscovery');
                    },
                  },
                ],
                { cancelable: false },
              );
            });

            // STEP 3: Sync configuration (start BLE notifications)
            advanceStep(2);
          })(),
          overallTimeout,
        ]);

        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }

        if (!isMountedRef.current) return;

        // All steps completed
        setCurrentStep(totalSteps);
        setProgress(1);
        setConnectedDevice({
          id: deviceId,
          name: deviceName,
          rssi: rssi,
          deviceInfo: deviceInfo,
          serviceUUIDs: serviceUUIDs,
        });
        setConnectionState('connected');

        useBleCommandStore.getState().startNotifications(deviceId);

        // Navigate to Device Applications
        setTimeout(() => {
          if (!isMountedRef.current) return;
          navigation.replace('DeviceApplications', {
            deviceId,
            deviceName,
            rssi,
          });
        }, 500);
      } catch (error: unknown) {
        // Clean up timeout on error
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
          timeoutHandle = null;
        }

        // Best-effort cleanup of any partial connection
        BleService.disconnectDevice(deviceId).catch(() => {});
        setConnectedDevice(null);

        if (!isMountedRef.current) return;

        setConnectionState('error');
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to connect to the device. Please try again.';
        Alert.alert('Connection Failed', message, [
          {
            text: 'OK',
            onPress: () => navigation.replace('DeviceDiscovery'),
          },
        ]);
      }
    };

    connectDevice();

    return () => {
      isMountedRef.current = false;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- connect-once effect; deviceInfo/deviceType/serviceUUIDs are read from route params at connect time and adding them would re-run the whole BLE connect
  }, [
    deviceId,
    deviceName,
    rssi,
    navigation,
    setConnectedDevice,
    setConnectionState,
  ]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top,
        paddingHorizontal: horizontalPadding,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <View style={{ width: '100%', maxWidth, alignItems: 'center' }}>
        {/* Device Icon with Animation */}
        <View
          style={{
            width: 120,
            height: 120,
            backgroundColor: 'rgba(0, 97, 237, 0.1)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing * 2,
          }}
        >
          <Bluetooth size={60} color={theme.colors.primary} strokeWidth={1.5} />
        </View>

        {/* Device Name */}
        <Text
          variant={isSmallDevice ? 'headlineSmall' : 'headlineMedium'}
          style={{
            fontWeight: '700',
            marginBottom: spacing * 2,
            textAlign: 'center',
          }}
        >
          {deviceName}
        </Text>

        {/* Progress Bar */}
        <View style={{ width: '100%', marginBottom: spacing * 3 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: spacing * 0.5,
            }}
          >
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              {currentStep < ConnectionSteps.length
                ? ConnectionSteps[currentStep].label
                : 'Connected'}
            </Text>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.primary, fontWeight: '600' }}
            >
              {Math.round(progress * 100)}%
            </Text>
          </View>
          <ProgressBar
            progress={progress}
            color={theme.colors.primary}
            style={{ height: 8, backgroundColor: 'rgba(0, 97, 237, 0.1)' }}
          />
        </View>

        {/* Connection Steps */}
        <View
          style={{
            width: '100%',
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.outline,
            padding: spacing * 1.5,
          }}
        >
          {ConnectionSteps.map((step, index) => {
            const isCompleted = index < currentStep;
            const isCurrent = index === currentStep;

            return (
              <View
                key={step.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  marginBottom:
                    index < ConnectionSteps.length - 1 ? spacing : 0,
                }}
              >
                {/* Icon */}
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: isCompleted
                      ? `${Colors.success}`
                      : isCurrent
                      ? 'rgba(0, 97, 237, 0.1)'
                      : 'rgba(0, 0, 0, 0.05)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: spacing,
                  }}
                >
                  {isCompleted ? (
                    <CheckCircle2
                      size={20}
                      color={Colors.white}
                      strokeWidth={2}
                    />
                  ) : isCurrent ? (
                    <Loader
                      size={20}
                      color={theme.colors.primary}
                      strokeWidth={2}
                    />
                  ) : (
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: theme.colors.outline,
                      }}
                    />
                  )}
                </View>

                {/* Label */}
                <Text
                  variant="bodyMedium"
                  style={{
                    color:
                      isCompleted || isCurrent
                        ? theme.colors.onSurface
                        : theme.colors.onSurfaceVariant,
                    fontWeight: isCurrent ? '600' : '400',
                  }}
                >
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Info Text */}
        <Text
          variant="bodySmall"
          style={{
            color: theme.colors.onSurfaceVariant,
            marginTop: spacing * 2,
            textAlign: 'center',
            lineHeight: 20,
          }}
        >
          Please wait while we establish a secure connection with your device...
        </Text>
      </View>
    </View>
  );
};

export default DeviceConnectingScreen;
