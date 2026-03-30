import {
  AlertTriangle,
  ChevronRight,
  Cpu,
  Download,
  Power,
  Sliders,
} from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import FactoryResetModal from '../../components/common/FactoryResetModal';
import PowerModeModal from '../../components/common/PowerModeModal';
import SensorConfigModal from '../../components/common/SensorConfigModal';
import BottomNavigationBar from '../../components/custom/BottomNavigationBar';
import DeviceHeader from '../../components/custom/DeviceHeader';
import { useBleStore } from '../store/useBleStore';
import { Colors } from '../theme/theme';
import { RouteName, ROUTES } from '../../types/routes';

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
  const [activeRoute, setActiveRoute] = useState<RouteName>(ROUTES.SETTINGS);
  const [showPowerModal, setShowPowerModal] = useState(false);
  const [showSensorModal, setShowSensorModal] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const { connectedDevice } = useBleStore();

  const deviceName = connectedDevice?.name ?? 'Unknown Device';

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* TOP BAR */}
      <DeviceHeader deviceName={deviceName} showConnectionStatus={true} />

      <View style={styles.content}>
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* SECTIONS */}
        <View style={{ flex: 1 }}>
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
              <View style={styles.cardRow}>
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
        </View>
      </View>

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
});
