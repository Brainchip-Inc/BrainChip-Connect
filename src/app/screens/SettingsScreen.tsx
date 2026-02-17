import { RouteProp } from '@react-navigation/native';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Download,
  Power,
  Sliders,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootParamList } from '../../../App';
import FactoryResetModal from '../../components/common/FactoryResetModal';
import PowerModeModal from '../../components/common/PowerModeModal';
import SensorConfigModal from '../../components/common/SensorConfigModal';
import BottomNavigationBar from '../../components/custom/BottomNavigationBar';
import DeviceHeader from '../../components/custom/DeviceHeader';
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

const SettingRow = ({ icon, title, subtitle, onPress }: any) => (
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

const SettingsScreen = ({ navigation }: any) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [activeRoute, setActiveRoute] = useState<
    'Home' | 'Notifications' | 'Settings' | 'Profile'
  >('Settings');
  const [showPowerModal, setShowPowerModal] = useState(false);
  const [showSensorModal, setShowSensorModal] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const { connectedDevice } = useBleStore();

  const deviceName = connectedDevice?.name ?? 'Unknown Device';

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
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        <View style={[styles.container]}>
          {/* DEVICE */}
          <Section title="Device">
            <SettingRow
              icon={<Power size={20} />}
              title="Power Mode"
              subtitle="Balanced"
              onPress={() => setShowPowerModal(true)}
            />
          </Section>

          {/* SENSORS */}
          <Section title="Sensors">
            <SettingRow
              icon={<Sliders size={20} />}
              title="Sensor Configuration"
              subtitle="10 Hz"
              onPress={() => setShowSensorModal(true)}
            />
          </Section>

          {/* FIRMWARE */}
          <Section title="Firmware">
            <SettingRow
              icon={<Cpu size={20} />}
              title="Firmware Update"
              subtitle="Update Application"
              onPress={() => navigation.navigate('FirmwareUpdate')}
            />
            <TouchableOpacity
              style={styles.secondCard}
              onPress={() => navigation.navigate('AIModelUpdate')}
            >
              <View style={styles.secondcardRow}>
                <Download size={20} />
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>AI Model Update</Text>
                  <Text style={styles.cardSub}>Check for system updates</Text>
                </View>
                <ChevronRight size={18} />
              </View>
            </TouchableOpacity>
          </Section>

          {/* DANGER */}
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <TouchableOpacity
            style={styles.secondCard}
            onPress={() => setShowReset(true)}
          >
            <View style={styles.dangerCard}>
              <View style={styles.dangerRow}>
                <AlertTriangle size={20} color={Colors.error} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.dangerText}>Factory Reset</Text>
                  <Text style={styles.dangerSub}>
                    Erase all device data and settings
                  </Text>
                </View>
                <ChevronRight size={18} />
              </View>
            </View>
          </TouchableOpacity>

          {/* FOOTER */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>BrainChip Akida� Neuron</Text>
            <Text style={styles.footerText}>
              Firmware v2.4.1 � Serial: AKD-A7F3
            </Text>
            <Text style={styles.footerText}>
              � 2025 BrainChip Holdings Ltd.
            </Text>
          </View>
        </View>
      </ScrollView>
      <PowerModeModal
        visible={showPowerModal}
        onClose={() => setShowPowerModal(false)}
      />

      <SensorConfigModal
        visible={showSensorModal}
        onClose={() => setShowSensorModal(false)}
      />
      <FactoryResetModal
        visible={showReset}
        onCancel={() => setShowReset(false)}
        onConfirm={() => {
          setShowReset(false);
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

export default SettingsScreen;

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
    padding: 12,
    gap: 12,
  },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
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
    borderWidth: 2,
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
    color: `${Colors.error}`,
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
});
