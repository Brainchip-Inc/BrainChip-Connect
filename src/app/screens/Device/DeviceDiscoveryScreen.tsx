import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { useBleStore, BLEDevice } from '../../store/useBleStore';

const SCAN_TIMEOUT = 10000;

const DeviceDiscoveryScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootParamList>>();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const {
    discoveredDevices: devices,
    addDiscoveredDevice,
    clearDiscoveredDevices,
  } = useBleStore();

  const [scanning, setScanning] = useState(false);
  const [scanTimeRemaining, setScanTimeRemaining] = useState(0);

  const scanCleanupRef = useRef<(() => void) | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isSmallDevice = width < 375;
  const spacing = isSmallDevice ? 12 : 16;
  const horizontalPadding = isSmallDevice ? 16 : 20;
  const maxWidth = width >= 768 ? 600 : width;

  const hasDevices = devices.length > 0;

  const getSignalColor = (rssi: number | null) => {
    if (!rssi) return theme.colors.outline;
    if (rssi > -50) return theme.colors.primary;
    if (rssi > -60) return theme.colors.secondary;
    if (rssi > -70) return theme.colors.tertiary;
    return theme.colors.error;
  };

  const stopScanning = useCallback(() => {
    if (scanCleanupRef.current) {
      scanCleanupRef.current();
      scanCleanupRef.current = null;
    }
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    setScanning(false);
    setScanTimeRemaining(0);
  }, []);

  const startScanning = useCallback(async () => {
    stopScanning();
    setScanning(true);
    clearDiscoveredDevices();
    setScanTimeRemaining(SCAN_TIMEOUT / 1000);

    try {
      const isEnabled = await BleService.isBluetoothEnabled();
      if (!isEnabled) {
        Alert.alert(
          'Bluetooth Not Enabled',
          'Please turn on Bluetooth to scan for devices.',
        );
        stopScanning();
        return;
      }

      scanTimerRef.current = setInterval(() => {
        setScanTimeRemaining(prev => {
          if (prev <= 1) {
            stopScanning();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // scanDevices now returns a cleanup function (no longer a Promise)
      scanCleanupRef.current = BleService.scanDevices(
        (device: Device) => {
          if (device.name) {
            addDiscoveredDevice({
              id: device.id,
              name: device.name,
              rssi: device.rssi,
            });
          }
        },
        null,
        SCAN_TIMEOUT,
      );
    } catch (error) {
      Alert.alert('Scan Error', 'Failed to scan for devices.');
      stopScanning();
    }
  }, [stopScanning, clearDiscoveredDevices, addDiscoveredDevice]);

  const handleDevicePress = (device: BLEDevice) => {
    stopScanning();
    navigation.navigate('DevicePreview', {
      deviceId: device.id,
      deviceName: device.name || 'Unknown Device',
      rssi: device.rssi,
    });
  };

  useEffect(() => {
    startScanning();
    return () => stopScanning();
  }, [startScanning, stopScanning]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top,
      }}
    >
      {/* HEADER */}
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
          <Text variant="headlineMedium" style={{ fontWeight: '700' }}>
            Discover Devices
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Select a device to connect
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: spacing * 2,
          paddingBottom: insets.bottom + spacing * 2,
          alignItems: 'center',
          flexGrow: 1,
        }}
      >
        <View style={{ width: '100%', maxWidth, flex: 1 }}>
          {/* CENTER SCANNING STATE */}
          {scanning && !hasDevices && (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text
                variant="bodyMedium"
                style={{
                  marginTop: spacing,
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                Scanning for devices...
              </Text>
            </View>
          )}

          {/* DEVICE LIST */}
          {hasDevices && (
            <>
              <View style={{ gap: spacing }}>
                {devices.map(device => {
                  const signalColor = getSignalColor(device.rssi);

                  return (
                    <TouchableOpacity
                      key={device.id}
                      onPress={() => handleDevicePress(device)}
                      activeOpacity={0.7}
                      style={{
                        backgroundColor: theme.colors.surface,
                        padding: spacing,
                        borderWidth: 1,
                        borderColor: theme.colors.outline,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        {/* LEFT */}
                        <View
                          style={{ flexDirection: 'row', alignItems: 'center' }}
                        >
                          <View
                            style={{
                              width: 44,
                              height: 44,
                              backgroundColor: 'rgba(0,97,237,0.08)',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginRight: spacing,
                            }}
                          >
                            <Bluetooth
                              size={22}
                              color={theme.colors.primary}
                              strokeWidth={1.5}
                            />
                          </View>

                          <Text
                            variant="titleMedium"
                            style={{ fontWeight: '600' }}
                          >
                            {device.name || 'Unknown Device'}
                          </Text>
                        </View>

                        {/* RIGHT */}
                        {device.rssi !== null && (
                          <View style={{ alignItems: 'flex-end' }}>
                            <Wifi size={14} color={signalColor} />
                            <Text
                              variant="bodySmall"
                              style={{ color: theme.colors.onSurfaceVariant }}
                            >
                              {device.rssi} dBm
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* SCAN AGAIN */}
              <Button
                mode="contained"
                onPress={startScanning}
                style={{ marginTop: spacing * 2 }}
                icon={() => <RefreshCw size={16} color="#fff" />}
              >
                Scan again
              </Button>

              {/* BACK */}
              <Button
                mode="outlined"
                onPress={() => navigation.goBack()}
                style={{ marginTop: spacing }}
              >
                Back
              </Button>
            </>
          )}

          {/* EMPTY STATE */}
          {!scanning && !hasDevices && (
            <>
              <View
                style={{
                  backgroundColor: theme.colors.surface,
                  padding: spacing * 2,
                  borderWidth: 1,
                  borderColor: theme.colors.outline,
                  alignItems: 'center',
                }}
              >
                <Bluetooth size={48} color={theme.colors.outline} />
                <Text style={{ marginTop: spacing }}>No devices found</Text>
              </View>

              <Button
                mode="contained"
                onPress={startScanning}
                style={{ marginTop: spacing * 2 }}
              >
                Scan again
              </Button>

              <Button
                mode="outlined"
                onPress={() => navigation.goBack()}
                style={{ marginTop: spacing }}
              >
                Back
              </Button>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

export default DeviceDiscoveryScreen;
