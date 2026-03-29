import { RouteProp } from '@react-navigation/native';
import {
  Bluetooth,
  ChevronLeft,
  ChevronRight,
  EditIcon,
  Info,
  LogOut,
  Pencil,
  Shield,
  User,
} from 'lucide-react-native';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Text, TextInput, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootParamList } from '../../../App';
import UnpairDeviceModal from '../../components/common/UnpairDeviceModal';
import BottomNavigationBar from '../../components/custom/BottomNavigationBar';
import DeviceHeader from '../../components/custom/DeviceHeader';
import BleService from '../../services/ble/bleManager';
import { RouteName, ROUTES } from '../../types/routes';
import { useBleStore } from '../store/useBleStore';
import { Colors } from '../theme/theme';

type DevicePreviewRouteProp = RouteProp<RootParamList, 'DevicePreview'>;

const CONTENT_WIDTH = 400;

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
  const insets = useSafeAreaInsets();
  const [activeRoute, setActiveRoute] = useState<RouteName>(ROUTES.PROFILE);
  const { connectedDevice } = useBleStore();

  const [isConnected, setIsConnected] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'disconnected' | 'error'
  >('connected');
  const [userName, setUserName] = useState('User Profile');
  const [isEditing, setIsEditing] = useState(false);
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
            setIsDisconnecting(true);
            try {
              // useBleCommandStore.getState().stopNotifications();
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
              console.error('Disconnect error:', error);
              setConnectionStatus('error');
              Alert.alert(
                'Disconnect Failed',
                error.message || 'Failed to disconnect from the device.',
                [{ text: 'OK' }],
              );
            } finally {
              setIsDisconnecting(false);
              setUnpairModal(false);
            }
          },
        },
      ],
    );
  };

  const handleEditProfile = () => {
    Alert.alert(
      'Edit Profile Name',
      `Do you want to change your profile name?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Edit',
          onPress: () => {
            setIsEditing(true); // opens modal with input
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* TOP BAR */}
      <DeviceHeader deviceName={deviceName} showConnectionStatus={true} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          {
            paddingBottom: insets.bottom + 140,
            flexGrow: 1,
          },
        ]}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={30} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Profile */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            {/* Center User Icon */}
            <User size={32} color="#111" />

            {/* Bottom right edit button */}
            {/* <View style={styles.editBadge}>
              <Pencil size={12} color="#fff" />
            </View> */}
          </View>

          <View style={styles.profileTitleRow}>
            <Text style={styles.profileTitle}>{userName}</Text>
            <TouchableOpacity
              style={styles.renameBtn}
              onPress={handleEditProfile}
            >
              <Pencil size={14} />
            </TouchableOpacity>
            <View style={styles.renameBtn}></View>
          </View>

          <Text style={styles.profileSub}>
            Manage your device and preferences
          </Text>
        </View>

        <View style={[styles.container]}>
          {/* DEVICE */}
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
              <View style={styles.secondcardRow}>
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
              <View style={styles.secondcardRow}>
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
            <TouchableOpacity
              style={styles.secondCard}
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
          </Section>
        </View>
      </ScrollView>
      {isEditing && (
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Edit Profile Name</Text>
            <TextInput
              value={userName}
              onChangeText={setUserName} // directly updates userName
              style={styles.input}
              placeholder="Enter new name"
            />
            <View style={styles.modalActions}>
              <Button onPress={() => setIsEditing(false)}>Cancel</Button>
              <Button
                mode="contained"
                onPress={() => {
                  Alert.alert(
                    'Profile Updated',
                    `Name changed to ${userName}`,
                    [{ text: 'OK' }],
                  );
                  setIsEditing(false);
                }}
              >
                Save
              </Button>
            </View>
          </View>
        </View>
      )}

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

  header: {
    width: '100%',
    flexDirection: 'row',
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: `${Colors.border.light}`,
    gap: 16,
  },

  headerTitle: {
    fontFamily: 'Sora',
    fontSize: 24,
    fontWeight: '700',
  },

  scroll: { alignItems: 'center' },
  container: {
    alignSelf: 'center',
    padding: 24,
    width: CONTENT_WIDTH,
  },

  profileSection: {
    alignItems: 'center',
    marginTop: 24,
  },

  avatar: {
    width: 100,
    height: 100,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 28,
    height: 28,
    backgroundColor: '#0061ED',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },

  profileTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },

  profileTitle: {
    fontFamily: 'Sora',
    fontSize: 20,
    fontWeight: '600',
  },

  renameBtn: {
    backgroundColor: '#F8F8F9',
    padding: 6,
    borderRadius: 6,
  },

  profileSub: {
    fontFamily: 'Inter',
    fontSize: 13,
    marginTop: 4,
  },

  sectionTitle: {
    fontFamily: 'Sora',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 8,
    marginRight: 8,
  },

  card: {
    backgroundColor: `${Colors.white}`,
    borderWidth: 1,
    borderColor: `${Colors.border.light}`,
    marginLeft: 8,
    marginRight: 8,
  },

  secondCard: {
    backgroundColor: `${Colors.white}`,
    borderWidth: 1,
    borderColor: `${Colors.border.light}`,
    marginTop: 10,
    marginLeft: 8,
    marginRight: 8,
  },

  secondcardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 12,
  },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
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
    fontWeight: 600,
  },

  dangerTitle: {
    color: `${Colors.error}`,
    fontFamily: 'Sora',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 8,
    marginRight: 8,
  },

  dangerCard: {
    backgroundColor: `${Colors.verylightWhite}`,
    borderWidth: 1,
    borderColor: `${Colors.error}`,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
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

  footer: {
    marginTop: 32,
    alignItems: 'center',
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 12,
    fontFamily: 'Inter',
  },

  statusContainer: {
    position: 'absolute',
    left: 49,
    top: 57,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6, // if RN version supports gap
  },

  dot: {
    width: 6,
    height: 6,
    backgroundColor: `${Colors.success}`,
    borderRadius: 50, // equivalent of large border-radius
  },

  statusText: {
    fontFamily: 'Inter',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 20,
    color: `${Colors.success}`,
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },

  modal: {
    width: 300,
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    fontFamily: 'Sora',
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    padding: 12,
  },
});
