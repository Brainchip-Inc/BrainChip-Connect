import React, { useState, useEffect } from 'react';
import { View, ScrollView, useWindowDimensions, Alert } from 'react-native';
import { Text, Button, useTheme, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bluetooth,
  Wifi,
  Activity,
  Zap,
  ArrowLeft,
  Power,
} from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootParamList } from '../../../../App';
import BleService from '../../../services/ble/bleManager';
import { useBleCommandStore } from '../../store/useBleCommandStore';

type DeviceDetailsRouteProp = RouteProp<RootParamList, 'DeviceDetails'>;

const DeviceDetailsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootParamList>>();
  const route = useRoute<DeviceDetailsRouteProp>();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { deviceId, deviceName, rssi } = route.params;

  // The permanent hardware serial, not the OS Bluetooth handle: on Android
  // that handle is the resolvable private address, which rotates every
  // fifteen minutes and identifies nothing. The serial only arrives once the
  // device-info burst has, so it is null for the first moment on screen.
  const deviceSerial = useBleCommandStore(state => state.deviceSerial);

  const [isConnected, setIsConnected] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'disconnected' | 'error'
  >('connected');

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

  const getSignalStrength = (rssiValue: number | null) => {
    if (!rssiValue) return { text: 'Unknown', color: theme.colors.outline };
    if (rssiValue > -50)
      return { text: 'Excellent', color: theme.colors.primary };
    if (rssiValue > -60) return { text: 'Good', color: '#0BD6A5' };
    if (rssiValue > -70) return { text: 'Fair', color: '#FFC524' };
    return { text: 'Weak', color: '#FF004E' };
  };

  const signal = getSignalStrength(rssi);

  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect Device',
      `Are you sure you want to disconnect from ${deviceName}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            setIsDisconnecting(true);
            try {
              await BleService.disconnectDevice(deviceId);
              setIsConnected(false);
              setConnectionStatus('disconnected');

              Alert.alert(
                'Disconnected',
                `Successfully disconnected from ${deviceName}`,
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.navigate('DeviceDiscovery'),
                  },
                ],
              );
            } catch (error: any) {
              if (__DEV__) console.error('Disconnect error:', error);
              setConnectionStatus('error');
              Alert.alert(
                'Disconnect Failed',
                error.message || 'Failed to disconnect from the device.',
                [{ text: 'OK' }],
              );
            } finally {
              setIsDisconnecting(false);
            }
          },
        },
      ],
    );
  };

  const checkConnection = async () => {
    try {
      const connected = await BleService.isDeviceConnected(deviceId);
      setIsConnected(connected);
      setConnectionStatus(connected ? 'connected' : 'disconnected');
    } catch (error) {
      if (__DEV__) console.error('Error checking connection:', error);
      setConnectionStatus('error');
    }
  };

  useEffect(() => {
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- checkConnection is re-created every render, so adding it would tear down and restart the 5s poll on each one
  }, []);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top,
      }}
    >
      {/* Header */}
      <View
        style={{
          paddingHorizontal: horizontalPadding,
          paddingVertical: spacing * 1.5,
          backgroundColor: theme.colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.outline,
        }}
      >
        <View style={{ maxWidth, width: '100%', alignSelf: 'center' }}>
          <Button
            mode="text"
            onPress={() => navigation.navigate('DeviceDiscovery')}
            icon={() => <ArrowLeft size={20} color={theme.colors.primary} />}
            style={{ alignSelf: 'flex-start', marginBottom: spacing }}
          >
            Back to Discovery
          </Button>
          <Text
            variant={isSmallDevice ? 'headlineSmall' : 'headlineMedium'}
            style={{ fontWeight: '700', textAlign: 'center' }}
          >
            Device Details
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: spacing * 1.5,
          paddingBottom: insets.bottom + spacing * 2,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', maxWidth }}>
          {/* Connection Status Card */}
          <View
            style={{
              backgroundColor: theme.colors.surface,
              padding: spacing * 1.5,
              borderWidth: 1,
              borderColor: theme.colors.outline,
              marginBottom: spacing * 1.5,
              alignItems: 'center',
            }}
          >
            <View
              style={{
                width: 80,
                height: 80,
                backgroundColor:
                  connectionStatus === 'connected'
                    ? 'rgba(11, 214, 165, 0.1)'
                    : 'rgba(255, 0, 78, 0.1)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing,
              }}
            >
              <Bluetooth
                size={40}
                color={connectionStatus === 'connected' ? '#0BD6A5' : '#FF004E'}
                strokeWidth={1.5}
              />
            </View>
            <View
              style={{
                paddingHorizontal: spacing,
                paddingVertical: spacing * 0.5,
                backgroundColor:
                  connectionStatus === 'connected' ? '#0BD6A5' : '#FF004E',
                marginBottom: spacing * 0.5,
              }}
            >
              <Text
                variant="labelMedium"
                style={{ color: '#FFFFFF', fontWeight: '600' }}
              >
                {connectionStatus === 'connected'
                  ? 'CONNECTED'
                  : 'DISCONNECTED'}
              </Text>
            </View>
            <Text
              variant="titleLarge"
              style={{ fontWeight: '600', textAlign: 'center' }}
            >
              {deviceName}
            </Text>
          </View>

          {/* Device Information */}
          <Text
            variant="titleMedium"
            style={{ fontWeight: '600', marginBottom: spacing }}
          >
            Device Information
          </Text>

          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.outline,
              marginBottom: spacing * 1.5,
            }}
          >
            {/* Device ID */}
            <View style={{ padding: spacing }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(0, 97, 237, 0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Activity
                    size={18}
                    color={theme.colors.primary}
                    strokeWidth={1.5}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: spacing }}>
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Device ID
                  </Text>
                  <Text
                    variant="bodyMedium"
                    style={{
                      marginTop: 2,
                      fontFamily: 'monospace',
                      color: deviceSerial
                        ? theme.colors.onSurface
                        : theme.colors.onSurfaceVariant,
                    }}
                  >
                    {deviceSerial ?? 'Reading...'}
                  </Text>
                </View>
              </View>
            </View>

            <Divider />

            {/* Signal Strength */}
            <View style={{ padding: spacing }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(0, 97, 237, 0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Wifi size={18} color={signal.color} strokeWidth={1.5} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing }}>
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Signal Strength
                  </Text>
                  <Text
                    variant="bodyMedium"
                    style={{
                      marginTop: 2,
                      color: signal.color,
                      fontWeight: '600',
                    }}
                  >
                    {signal.text} {rssi ? `(${rssi} dBm)` : ''}
                  </Text>
                </View>
              </View>
            </View>

            <Divider />

            {/* Connection Status */}
            <View style={{ padding: spacing }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: 'rgba(0, 97, 237, 0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Zap
                    size={18}
                    color={theme.colors.primary}
                    strokeWidth={1.5}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: spacing }}>
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    Status
                  </Text>
                  <Text variant="bodyMedium" style={{ marginTop: 2 }}>
                    {isConnected ? 'Active Connection' : 'Not Connected'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Actions */}
          <Text
            variant="titleMedium"
            style={{ fontWeight: '600', marginBottom: spacing }}
          >
            Actions
          </Text>

          <View style={{ gap: spacing }}>
            {/* Disconnect Button */}
            <Button
              mode="contained"
              onPress={handleDisconnect}
              disabled={!isConnected || isDisconnecting}
              loading={isDisconnecting}
              style={{ backgroundColor: theme.colors.error }}
              contentStyle={{ paddingVertical: isSmallDevice ? 6 : 8 }}
              labelStyle={{
                fontSize: isSmallDevice ? 13 : 14,
                fontWeight: '600',
              }}
              icon={() => <Power size={20} color="#FFFFFF" />}
            >
              {isDisconnecting ? 'Disconnecting...' : 'Disconnect Device'}
            </Button>

            {/* Back Button */}
            <Button
              mode="outlined"
              onPress={() => navigation.navigate('DeviceDiscovery')}
              contentStyle={{ paddingVertical: isSmallDevice ? 6 : 8 }}
              labelStyle={{
                fontSize: isSmallDevice ? 13 : 14,
                fontWeight: '600',
              }}
            >
              Back to Discovery
            </Button>
          </View>

          {/* Info Box */}
          <View
            style={{
              backgroundColor: 'rgba(0, 97, 237, 0.05)',
              padding: spacing,
              borderWidth: 1,
              borderColor: 'rgba(0, 97, 237, 0.2)',
              marginTop: spacing * 1.5,
            }}
          >
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant, lineHeight: 20 }}
            >
              ℹ️ This device is connected via Bluetooth Low Energy.
              Disconnecting will stop all data transmission between your phone
              and the Edge AI device.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default DeviceDetailsScreen;
