import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  useWindowDimensions,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Text, Button, ActivityIndicator, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bluetooth, RefreshCw, Wifi } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootParamList } from '../../../../App';
import BleService from '../../../services/ble/bleManager';
import { Device } from 'react-native-ble-plx';

interface BLEDevice {
  id: string;
  name: string | null;
  rssi: number | null;
}

const SCAN_TIMEOUT = 10000; // 10 seconds

const DeviceDiscoveryScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootParamList>>();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [scanning, setScanning] = useState(false);
  const [devices, setDevices] = useState<BLEDevice[]>([]);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [scanTimeRemaining, setScanTimeRemaining] = useState(0);

  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);

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

  const getSignalStrength = (rssi: number | null) => {
    if (!rssi) return { text: 'Unknown', color: theme.colors.outline };
    if (rssi > -50) return { text: 'Excellent', color: theme.colors.primary };
    if (rssi > -60) return { text: 'Good', color: '#0BD6A5' };
    if (rssi > -70) return { text: 'Fair', color: '#FFC524' };
    return { text: 'Weak', color: '#FF004E' };
  };

  const clearTimers = () => {
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
  };

  const stopScanning = () => {
    BleService.stopScan();
    setScanning(false);
    setScanTimeRemaining(0);
    clearTimers();
  };

  const startScanning = async () => {
    // Clear any existing timers
    clearTimers();

    setScanning(true);
    setDevices([]);
    setScanTimeRemaining(SCAN_TIMEOUT / 1000);

    try {
      // Check if Bluetooth is enabled
      const isEnabled = await BleService.isBluetoothEnabled();
      if (!isEnabled) {
        Alert.alert(
          'Bluetooth Not Enabled',
          'Please turn on Bluetooth to scan for devices.',
          [{ text: 'OK' }],
        );
        stopScanning();
        return;
      }

      const discoveredDevices: BLEDevice[] = [];

      // Start countdown timer
      scanTimerRef.current = setInterval(() => {
        setScanTimeRemaining(prev => {
          if (prev <= 1) {
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // Start scanning
      await BleService.scanDevices((device: Device) => {
        // Only add devices with names and avoid duplicates
        if (device.name && !discoveredDevices.find(d => d.id === device.id)) {
          const newDevice: BLEDevice = {
            id: device.id,
            name: device.name,
            rssi: device.rssi,
          };
          discoveredDevices.push(newDevice);
          setDevices([...discoveredDevices]);
        }
      });

      // Stop scanning after timeout
      scanTimeoutRef.current = setTimeout(() => {
        stopScanning();
        console.log(
          `Scan completed. Found ${discoveredDevices.length} devices.`,
        );
      }, SCAN_TIMEOUT);
    } catch (error) {
      console.error('Error scanning devices:', error);
      Alert.alert(
        'Scan Error',
        'Failed to scan for devices. Please try again.',
        [{ text: 'OK' }],
      );
      stopScanning();
    }
  };

  const connectToDevice = async (device: BLEDevice) => {
    setConnecting(device.id);

    try {
      // Stop scanning before connecting
      stopScanning();

      const connectedDevice = await BleService.connectDevice(device.id);
      setConnecting(null);

      // Navigate to Device Details screen
      navigation.navigate('DeviceDetails', {
        deviceId: device.id,
        deviceName: device.name || 'Unknown Device',
        rssi: device.rssi,
      });
    } catch (error: any) {
      setConnecting(null);
      console.error('Connection error:', error);
      Alert.alert(
        'Connection Failed',
        error.message || 'Failed to connect to the device. Please try again.',
        [{ text: 'OK' }],
      );
    }
  };

  useEffect(() => {
    startScanning();

    return () => {
      stopScanning();
    };
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
        <View
          style={{
            alignItems: 'center',
            maxWidth,
            width: '100%',
            alignSelf: 'center',
          }}
        >
          <Text
            variant={isSmallDevice ? 'headlineSmall' : 'headlineMedium'}
            style={{ fontWeight: '700', marginBottom: spacing * 0.5 }}
          >
            Discover Devices
          </Text>
          <Text
            variant="bodyMedium"
            style={{
              color: theme.colors.onSurfaceVariant,
              textAlign: 'center',
            }}
          >
            Scanning for nearby BrainChip Edge AI devices
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
          {/* Scanning Status */}
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
            {scanning ? (
              <>
                <ActivityIndicator size="large" color={theme.colors.primary} />
                <Text
                  variant="titleMedium"
                  style={{ marginTop: spacing, fontWeight: '600' }}
                >
                  Scanning for devices...
                </Text>
                <Text
                  variant="bodySmall"
                  style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}
                >
                  Time remaining: {scanTimeRemaining}s
                </Text>
                <Button
                  mode="text"
                  onPress={stopScanning}
                  style={{ marginTop: spacing * 0.5 }}
                  textColor={theme.colors.error}
                >
                  Stop Scanning
                </Button>
              </>
            ) : (
              <>
                <Bluetooth
                  size={48}
                  color={theme.colors.primary}
                  strokeWidth={1.5}
                />
                <Text
                  variant="titleMedium"
                  style={{ marginTop: spacing, fontWeight: '600' }}
                >
                  {devices.length} device{devices.length !== 1 ? 's' : ''} found
                </Text>
                <Button
                  mode="text"
                  onPress={startScanning}
                  style={{ marginTop: spacing * 0.5 }}
                  icon={() => (
                    <RefreshCw size={16} color={theme.colors.primary} />
                  )}
                >
                  Scan Again
                </Button>
              </>
            )}
          </View>

          {/* Device List */}
          {devices.length > 0 && (
            <View style={{ gap: spacing }}>
              <Text variant="titleMedium" style={{ fontWeight: '600' }}>
                Available Devices ({devices.length})
              </Text>

              {devices.map(device => {
                const signal = getSignalStrength(device.rssi);
                const isConnecting = connecting === device.id;

                return (
                  <TouchableOpacity
                    key={device.id}
                    onPress={() =>
                      !isConnecting && !scanning && connectToDevice(device)
                    }
                    activeOpacity={0.7}
                    disabled={isConnecting || scanning}
                    style={{
                      backgroundColor: theme.colors.surface,
                      padding: spacing,
                      borderWidth: 1,
                      borderColor: theme.colors.outline,
                      opacity: scanning ? 0.6 : 1,
                    }}
                  >
                    <View
                      style={{ flexDirection: 'row', alignItems: 'center' }}
                    >
                      {/* Icon */}
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          backgroundColor: 'rgba(0, 97, 237, 0.1)',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Bluetooth
                          size={24}
                          color={theme.colors.primary}
                          strokeWidth={1.5}
                        />
                      </View>

                      {/* Device Info */}
                      <View style={{ flex: 1, marginLeft: spacing }}>
                        <Text
                          variant="titleMedium"
                          style={{ fontWeight: '600', marginBottom: 4 }}
                        >
                          {device.name || 'Unknown Device'}
                        </Text>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: 8,
                          }}
                        >
                          <Text
                            variant="bodySmall"
                            style={{ color: theme.colors.onSurfaceVariant }}
                            numberOfLines={1}
                          >
                            {device.id.substring(0, 17)}...
                          </Text>
                          {device.rssi && (
                            <>
                              <View
                                style={{
                                  width: 4,
                                  height: 4,
                                  borderRadius: 2,
                                  backgroundColor:
                                    theme.colors.onSurfaceVariant,
                                }}
                              />
                              <View
                                style={{
                                  flexDirection: 'row',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <Wifi size={12} color={signal.color} />
                                <Text
                                  variant="bodySmall"
                                  style={{
                                    color: signal.color,
                                    fontWeight: '600',
                                  }}
                                >
                                  {signal.text}
                                </Text>
                              </View>
                            </>
                          )}
                        </View>
                      </View>

                      {/* Connect Button */}
                      <View style={{ marginLeft: spacing * 0.5 }}>
                        {isConnecting ? (
                          <ActivityIndicator
                            size="small"
                            color={theme.colors.primary}
                          />
                        ) : (
                          <Button
                            mode="contained"
                            compact
                            onPress={() => connectToDevice(device)}
                            disabled={scanning}
                            contentStyle={{ paddingVertical: 2 }}
                          >
                            Connect
                          </Button>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Empty State */}
          {!scanning && devices.length === 0 && (
            <View
              style={{
                backgroundColor: theme.colors.surface,
                padding: spacing * 3,
                borderWidth: 1,
                borderColor: theme.colors.outline,
                alignItems: 'center',
              }}
            >
              <Bluetooth
                size={64}
                color={theme.colors.outline}
                strokeWidth={1}
              />
              <Text
                variant="titleMedium"
                style={{
                  marginTop: spacing * 1.5,
                  fontWeight: '600',
                  textAlign: 'center',
                }}
              >
                No devices found
              </Text>
              <Text
                variant="bodyMedium"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  marginTop: spacing * 0.5,
                  textAlign: 'center',
                }}
              >
                Make sure your BrainChip device is powered on and in range
              </Text>
              <Button
                mode="contained"
                onPress={startScanning}
                style={{ marginTop: spacing * 1.5 }}
                icon={() => <RefreshCw size={16} color="#FFFFFF" />}
              >
                Scan Again
              </Button>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default DeviceDiscoveryScreen;
