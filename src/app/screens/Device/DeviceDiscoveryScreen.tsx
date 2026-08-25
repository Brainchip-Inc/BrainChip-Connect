import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bluetooth, RefreshCw, Wifi } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { Device } from 'react-native-ble-plx';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootParamList } from '../../../../App';
import BleService from '../../../services/ble/bleManager';
import { BLEDevice, useBleStore } from '../../store/useBleStore';
import { Colors } from '../../theme/theme';

const SCAN_TIMEOUT = 10000;

const DeviceDiscoveryScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootParamList>>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const {
    discoveredDevices: devices,
    addDiscoveredDevice,
    clearDiscoveredDevices,
  } = useBleStore();

  const [scanning, setScanning] = useState(false);
  const scanTimeRemainingRef = useRef(0);

  const scanCleanupRef = useRef<(() => void) | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    scanTimeRemainingRef.current = 0;
  }, []);

  const serviceUUIDs: Array<string> = [];

  const startScanning = useCallback(async () => {
    stopScanning();
    setScanning(true);
    clearDiscoveredDevices();
    scanTimeRemainingRef.current = SCAN_TIMEOUT / 1000;

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
        if (scanTimeRemainingRef.current <= 1) {
          stopScanning();
          return;
        }
        scanTimeRemainingRef.current -= 1;
      }, 1000);

      scanCleanupRef.current = BleService.scanDevices(
        (device: Device) => {
          if (__DEV__) console.log('device discovered', device);
          if (device.name) {
            addDiscoveredDevice({
              id: device.id,
              name: device.name,
              rssi: device.rssi,
              deviceInfo: device.manufacturerData,
              serviceUUIDs: device.serviceUUIDs,
            });
          }
        },
        serviceUUIDs,
        SCAN_TIMEOUT,
      );
    } catch {
      Alert.alert('Scan Error', 'Failed to scan for devices.');
      stopScanning();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- serviceUUIDs is a fresh empty array each render, so adding it would rebuild startScanning and restart the scan continuously
  }, [stopScanning, clearDiscoveredDevices, addDiscoveredDevice]);

  const handleDevicePress = (device: BLEDevice) => {
    stopScanning();
    if (__DEV__) console.log('handlepress', device);
    navigation.navigate('DevicePreview', {
      deviceId: device.id,
      deviceName: device.name || 'Unknown Device',
      rssi: device.rssi,
      deviceInfo: device.deviceInfo,
      serviceUUIDs: device.serviceUUIDs,
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
      {/* HEADER - FIXED */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingVertical: 24,
          backgroundColor: theme.colors.surface,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.outline,
        }}
      >
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

      {/* DEVICE LIST - SCROLLABLE */}
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <View
          style={{
            flex: 1,
            borderWidth: 1,
            borderColor: Colors.border.light,
            backgroundColor: theme.colors.background,
          }}
        >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          gap: 12,
        }}
        showsVerticalScrollIndicator={false}
      >
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
                marginTop: 16,
                color: theme.colors.onSurfaceVariant,
              }}
            >
              Scanning for devices...
            </Text>
          </View>
        )}

        {/* DEVICE LIST */}
        {hasDevices && (
          <View style={{ gap: 16 }}>
            {devices.map(device => {
              const signalColor = getSignalColor(device.rssi);

              return (
                <TouchableOpacity
                  key={device.id}
                  onPress={() => handleDevicePress(device)}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: theme.colors.surface,
                    padding: 16,
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
                          marginRight: 16,
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
        )}

        {/* EMPTY STATE */}
        {!scanning && !hasDevices && (
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <View
              style={{
                backgroundColor: theme.colors.surface,
                padding: 32,
                borderWidth: 1,
                borderColor: theme.colors.outline,
                alignItems: 'center',
                width: '100%',
              }}
            >
              <Bluetooth size={48} color={theme.colors.outline} />
              <Text style={{ marginTop: 16 }}>No devices found</Text>
            </View>
          </View>
        )}
      </ScrollView>
        </View>
      </View>

      {/* BUTTONS - FIXED AT BOTTOM */}
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 12,
          paddingBottom: insets.bottom + 48,
          backgroundColor: theme.colors.background,
        }}
      >
        <Button
          mode="contained"
          onPress={startScanning}
          icon={() => <RefreshCw size={16} color={Colors.white} />}
        >
          Scan again
        </Button>

        <Button
          mode="outlined"
          onPress={() => navigation.navigate('GetStarted')}
          style={{ marginTop: 12 }}
        >
          Back
        </Button>
      </View>
    </View>
  );
};

export default DeviceDiscoveryScreen;
