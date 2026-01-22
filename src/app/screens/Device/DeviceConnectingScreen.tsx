import React, { useState, useEffect } from 'react';
import { View, useWindowDimensions, Alert } from 'react-native';
import { Text, useTheme, ProgressBar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bluetooth, CheckCircle2, Loader } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootParamList } from '../../../../App';
import BleService from '../../../services/ble/bleManager';

type DeviceConnectingRouteProp = RouteProp<RootParamList, 'DeviceConnecting'>;

const ConnectionSteps = [
  { id: 1, label: 'Establishing connection', duration: 2000 },
  { id: 2, label: 'Authenticating', duration: 2000 },
  { id: 3, label: 'Reading device info', duration: 1500 },
  { id: 4, label: 'Syncing configuration', duration: 1500 },
];

const DeviceConnectingScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootParamList>>();
  const route = useRoute<DeviceConnectingRouteProp>();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { deviceId, deviceName, rssi } = route.params;

  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

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

  useEffect(() => {
    let stepIndex = 0;
    let progressValue = 0;
    const totalSteps = ConnectionSteps.length;

    const connectDevice = async () => {
      try {
        // Start connection process
        const connection = BleService.connectDevice(deviceId);

        // Simulate connection steps with progress
        const stepInterval = setInterval(() => {
          if (stepIndex < totalSteps) {
            setCurrentStep(stepIndex);
            progressValue = (stepIndex + 1) / totalSteps;
            setProgress(progressValue);
            stepIndex++;
          } else {
            clearInterval(stepInterval);
          }
        }, 1800);

        // Wait for actual connection
        await connection;

        // All steps completed
        setTimeout(() => {
          setCurrentStep(totalSteps);
          setProgress(1);

          // Navigate to Device Details
          setTimeout(() => {
            // navigation.replace('DeviceDetails', {
            //   deviceId,
            //   deviceName,
            //   rssi,
            // });
            navigation.replace('DeviceApplications');
          }, 500);
        }, 500);
      } catch (error: any) {
        console.error('Connection error:', error);
        Alert.alert(
          'Connection Failed',
          error.message || 'Failed to connect to the device. Please try again.',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ],
        );
      }
    };

    connectDevice();
  }, []);

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
            const isPending = index > currentStep;

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
                      ? '#0BD6A5'
                      : isCurrent
                      ? 'rgba(0, 97, 237, 0.1)'
                      : 'rgba(0, 0, 0, 0.05)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: spacing,
                  }}
                >
                  {isCompleted ? (
                    <CheckCircle2 size={20} color="#FFFFFF" strokeWidth={2} />
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
