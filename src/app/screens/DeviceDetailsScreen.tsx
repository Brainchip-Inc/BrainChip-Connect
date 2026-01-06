import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';

const DeviceDetailsScreen = ({ route, navigation }: any) => {
  const { device } = route.params;

  return (
    <View style={styles.container}>
      {/* Header */}
      <Text style={styles.title}>Device Details</Text>

      {/* Status */}
      <View style={styles.statusContainer}>
        <View style={styles.statusDot} />
        <Text style={styles.statusText}>Connected</Text>
      </View>

      {/* Device Info */}
      <View style={styles.card}>
        <DetailRow label="Device Name" value={device.name || 'Unknown'} />
        <DetailRow label="Device ID" value={device.id} />
        <DetailRow label="RSSI" value={`${device.rssi} dBm`} />
        <DetailRow label="Manufacturer" value={device.manufacturer || 'N/A'} />
      </View>

      {/* Action */}
      <Button
        mode="contained"
        onPress={() => navigation.goBack()}
        style={styles.disconnectButton}
        labelStyle={styles.disconnectButtonLabel}
        buttonColor="#FF004E" // Error Red
      >
        Disconnect & Go Back
      </Button>
    </View>
  );
};

/* Reusable row */
const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.row}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F9', // Background Gray
    padding: 16,
  },

  title: {
    fontFamily: 'Sora-Bold',
    fontSize: 24,
    lineHeight: 24 * 1.3,
    letterSpacing: -0.48,
    color: '#000000',
    marginBottom: 12,
  },

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },

  statusDot: {
    width: 8,
    height: 8,
    backgroundColor: '#0BD6A5', // Success Green
    marginRight: 8,
  },

  statusText: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    lineHeight: 13 * 1.6,
    color: '#000000',
  },

  card: {
    backgroundColor: '#FFFFFF', // clickable surface
    borderRadius: 0,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },

  row: {
    marginBottom: 12,
  },

  label: {
    fontFamily: 'Inter-Regular',
    fontSize: 12,
    lineHeight: 12 * 1.5,
    color: 'rgba(0,0,0,0.6)',
    marginBottom: 2,
  },

  value: {
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    lineHeight: 13 * 1.6,
    color: '#000000',
  },

  disconnectButton: {
    marginTop: 'auto',
    borderRadius: 0,
  },

  disconnectButtonLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 13,
  },
});

export default DeviceDetailsScreen;
