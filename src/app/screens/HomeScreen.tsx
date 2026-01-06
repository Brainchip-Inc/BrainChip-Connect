import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, ActivityIndicator } from 'react-native-paper';
import BleService from '../../services/ble/bleManager';

const MOCK_BLE_DEVICES = [
  {
    id: 'MOCK-001',
    name: 'Mock Heart Rate Monitor',
    rssi: -42,
    manufacturer: 'Mock Inc',
  },
  {
    id: 'MOCK-002',
    name: 'Mock Temperature Sensor',
    rssi: -55,
    manufacturer: 'Mock Labs',
  },
  {
    id: 'MOCK-003',
    name: 'Mock Fitness Band',
    rssi: -60,
    manufacturer: 'Demo Corp',
  },
  {
    id: 'MOCK-004',
    name: 'Mock SpO₂ Band',
    rssi: -70,
    manufacturer: 'Mock Spo2',
  },
];

const HomeScreen = ({ navigation }: any) => {
  const [devices, setDevices] = useState<any[]>([]);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    BleService.isBluetoothEnabled();
  }, []);

  const startScanning = () => {
    setScanning(true);
    setDevices([]);

    setTimeout(() => {
      setDevices(MOCK_BLE_DEVICES);
      setScanning(false);
    }, 1500);
  };

  const connectDevice = (device: any) => {
    navigation.navigate('DeviceDetails', { device });
  };

  return (
    <View style={styles.container}>
      {/* Page Title */}
      <Text style={styles.title}>Bluetooth Device Scanner</Text>

      {/* Scan Button */}
      <Button
        mode="contained"
        onPress={startScanning}
        disabled={scanning}
        style={styles.scanButton}
        labelStyle={styles.scanButtonLabel}
        buttonColor="#0061ED"
      >
        {scanning ? 'Scanning…' : 'Scan for Devices'}
      </Button>

      {scanning && (
        <ActivityIndicator
          animating
          size="large"
          color="#0061ED"
          style={{ marginTop: 16 }}
        />
      )}

      {/* Device List */}
      {devices.map(device => (
        <View key={device.id} style={styles.card}>
          <Text style={styles.cardTitle}>{device.name}</Text>

          <Text style={styles.metaText}>RSSI: {device.rssi} dBm</Text>

          <Text style={styles.metaText}>
            Manufacturer: {device.manufacturer}
          </Text>

          <Text style={styles.metaText}>ID: {device.id}</Text>

          <Button
            mode="outlined"
            onPress={() => connectDevice(device)}
            style={styles.connectButton}
            labelStyle={styles.connectButtonLabel}
            textColor="#0061ED"
          >
            Connect
          </Button>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#F8F8F9', // Background Gray
  },

  title: {
    fontFamily: 'Sora-Bold',
    fontSize: 24,
    lineHeight: 24 * 1.3,
    letterSpacing: -0.48,
    color: '#000000',
    marginBottom: 16,
  },

  scanButton: {
    borderRadius: 0,
    marginBottom: 16,
  },

  scanButtonLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },

  card: {
    backgroundColor: '#FFFFFF', // clickable surface
    borderRadius: 0,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },

  cardTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    lineHeight: 16 * 1.3,
    color: '#000000',
    marginBottom: 8,
  },

  metaText: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 12 * 1.5,
    color: 'rgba(0,0,0,0.7)',
    marginBottom: 4,
  },

  connectButton: {
    marginTop: 12,
    borderRadius: 0,
    borderColor: '#0061ED',
  },

  connectButtonLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
});

export default HomeScreen;
