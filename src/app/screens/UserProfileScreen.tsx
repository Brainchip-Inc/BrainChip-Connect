import {
  Bluetooth,
  ChevronRight,
  EditIcon,
  Info,
  LogOut,
  Shield,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import UnpairDeviceModal from '../../components/common/UnpairDeviceModal';
import BottomNavigationBar from '../../components/custom/BottomNavigationBar';
import DeviceHeader from '../../components/custom/DeviceHeader';
import BleService from '../../services/ble/bleManager';
import { RouteName, ROUTES } from '../../types/routes';
import { useBleStore } from '../store/useBleStore';
import { Colors } from '../theme/theme';

const Section = ({ title, children }: any) => (
  <View style={{ marginBottom: 20 }}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const ProfileRow = ({ icon, title, subtitle, onPress }: any) => (
  <TouchableOpacity style={styles.card} onPress={onPress}>
    <View style={styles.cardRow}>
      {icon}
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSub}>{subtitle}</Text>
      </View>
      <ChevronRight size={18} />
    </View>
  </TouchableOpacity>
);

const UserProfileScreen = ({ navigation }: any) => {
  const theme = useTheme();
  const [activeRoute, setActiveRoute] = useState<RouteName>(ROUTES.PROFILE);
  const { connectedDevice,setConnectedDevice,setConnectionState } = useBleStore();

  const [unpairModal, setUnpairModal] = useState(false);

  const deviceName = connectedDevice?.name ?? 'Unknown Device';
  const deviceId = connectedDevice?.id ?? 'Unknown';

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
            try {
              await BleService.disconnectDevice(deviceId);

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
              Alert.alert(
                'Disconnect Failed',
                error.message || 'Failed to disconnect from the device.',
                [{ text: 'OK' }],
              );
            } finally {
              setUnpairModal(false);
              setConnectedDevice(null);
              setConnectionState("disconnected")
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* TOP BAR */}
      <DeviceHeader deviceName={deviceName} showConnectionStatus={true} />

      <View style={styles.content}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* SECTIONS */}
        <View style={{ flex: 1 }}>
          {/* Account */}
          <Section title="Account">
            <ProfileRow
              icon={<Info size={20} />}
              title="About"
              subtitle="App version 1.0.0"
              onPress={() => navigation.navigate('Aboutapp')}
            />
            <TouchableOpacity
              style={styles.secondCard}
              onPress={() => navigation.navigate('AccountPrivacyPolicy')}
            >
              <View style={styles.cardRow}>
                <Shield size={20} />
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>Privacy & Data</Text>
                  <Text style={styles.cardSub}>
                    Your data stays on your device
                  </Text>
                </View>
                <ChevronRight size={18} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondCard}
              onPress={() => navigation.navigate('AccountTermsAndConditions')}
            >
              <View style={styles.cardRow}>
                <EditIcon size={20} />
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>Terms & Conditions</Text>
                  <Text style={styles.cardSub}>
                    Service terms and conditions
                  </Text>
                </View>
                <ChevronRight size={18} />
              </View>
            </TouchableOpacity>
          </Section>

          {/* Connected Device */}
          <Section title="Connected Device">
            <ProfileRow
              icon={<Bluetooth size={20} color={Colors.primary} />}
              title={deviceName}
              subtitle={
                <View style={styles.statusContainer}>
                  <View style={styles.dot} />
                  <Text style={styles.statusText}>Connected via Bluetooth</Text>
                </View>
              }
            />
          </Section>

          {/* Unpair Device */}
          <TouchableOpacity
            style={styles.card}
            onPress={() => setUnpairModal(true)}
          >
            <View style={styles.dangerCard}>
              <View style={styles.dangerRow}>
                <LogOut size={20} color={Colors.error} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dangerText}>Unpair Device</Text>
                  <Text style={styles.dangerSub}>
                    Disconnect and return to setup
                  </Text>
                </View>
                <ChevronRight size={18} />
              </View>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <UnpairDeviceModal
        visible={unpairModal}
        onCancel={() => setUnpairModal(false)}
        onConfirm={() => {
          handleDisconnect();
          setUnpairModal(false);
        }}
      />

      {/* Bottomnavbar */}
      <BottomNavigationBar
        activeRoute={activeRoute}
        onNavigate={route => setActiveRoute(route)}
      />
    </View>
  );
};

export default UserProfileScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },

  content: {
    flex: 1,
    paddingHorizontal: 20,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    gap: 12,
  },

  headerTitle: {
    fontFamily: 'Sora',
    fontSize: 24,
    fontWeight: '700',
  },

  sectionTitle: {
    fontFamily: 'Sora',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },

  card: {
    backgroundColor: `${Colors.white}`,
    borderWidth: 1,
    borderColor: `${Colors.border.light}`,
  },

  secondCard: {
    backgroundColor: `${Colors.white}`,
    borderWidth: 1,
    borderColor: `${Colors.border.light}`,
    marginTop: 10,
  },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },

  cardText: { flex: 1 },
  cardTitle: {
    fontFamily: 'Sora',
    fontSize: 15,
    fontWeight: '700',
  },
  cardSub: {
    fontFamily: 'Inter',
    fontSize: 13,
  },

  dangerCard: {
    backgroundColor: `${Colors.verylightWhite}`,
    borderWidth: 1,
    borderColor: `${Colors.error}`,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  dangerText: {
    fontFamily: 'Sora',
    fontSize: 15,
    fontWeight: '700',
    color: `${Colors.error}`,
  },
  dangerSub: {
    fontFamily: 'Inter',
    fontSize: 12,
  },

  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  dot: {
    width: 6,
    height: 6,
    backgroundColor: `${Colors.success}`,
    borderRadius: 50,
  },

  statusText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 20,
    color: `${Colors.success}`,
  },
});
