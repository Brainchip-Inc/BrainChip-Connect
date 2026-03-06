import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Download, Cpu, ChevronLeft } from 'lucide-react-native';
import DeviceHeader from '../../components/custom/DeviceHeader';
import BottomNavigationBar from '../../components/custom/BottomNavigationBar';
import { FirmwareBuild } from '../../types/FirmwareBuild';
import { useBleStore } from '../store/useBleStore';
import { RouteName, ROUTES } from '../../types/routes';
import { useFirmwareStore } from '../store/useFirmwareStore';
import { Colors } from '../theme/theme';
import { useDeviceAuthStore } from '../store/useDeviceAuthStore';
import bleService from '../../services/ble/bleManager';
import { useBleCommandStore } from '../store/useBleCommandStore';

const CONTENT_WIDTH = 382;

const FirmwareUpdateScreen = ({ navigation }: any) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [activeRoute, setActiveRoute] = useState<RouteName>(ROUTES.SETTINGS);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const { connectedDevice } = useBleStore();

  const {
    firmwareBuilds,
    installedBuild,
    setInstalledBuild,
    fetchFirmwareBuilds,
    loading,
  } = useFirmwareStore();

  const authtoken = useDeviceAuthStore(state => state.token);
  const downloadFirmware = useFirmwareStore(state => state.downloadFirmware);

  const deviceName = connectedDevice?.name ?? 'Unknown Device';

  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const [showUninstallProgress, setShowUninstallProgress] = useState(false);
  const [uninstallProgress, setUninstallProgress] = useState(0);

  useEffect(() => {
    if (!authtoken) {
      Alert.alert(
        'Authentication Failed',
        `Device ${deviceName} not authenticated`,
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('DeviceDiscovery'),
          },
        ],
      );
      navigation.navigate('DeviceDiscovery');
    } else {
      fetchFirmwareBuilds(authtoken);
    }
  }, [authtoken]);

  const downloadFile = async (build: FirmwareBuild) => {
    try {
      if (!authtoken || !connectedDevice?.id) {
        Alert.alert('Device not ready');
        return;
      }

      const deviceId = connectedDevice.id;
      setInstallingId(build.id);
      setProgress(0);

      // 1. Download firmware binary
      const filePath = await downloadFirmware(
        build.id,
        authtoken,
        build.filename,
      );
      console.log('🚀 ~ downloadFile ~ filePath:', filePath);
      if (!filePath) throw new Error('Download failed');

      const connected = await bleService.isDeviceConnected(deviceId);

      if (!connected) {
        Alert.alert('Device disconnected');
        return;
      }

      useBleCommandStore.getState().stopNotifications();

      // 3. Run full FOTA — handles subscribe, SMP params, upload, confirm, reset
      await bleService.performFota(
        deviceId,
        filePath,
        percent => setProgress(percent), // live progress 0–100
        msg => console.log('[FOTA]', msg), // optional log callback
      );

      Alert.alert('Success', 'Firmware updated successfully');

      // 4. Done
      setInstalledBuild(build);
    } catch (error: any) {
      console.error('[downloadFile] error:', error);
      Alert.alert(
        'Firmware Update Failed',
        error?.message ?? 'The firmware update did not complete.',
      );
    } finally {
      setInstallingId(null);
      setProgress(0);
    }
  };

  const handleInstall = async (build: FirmwareBuild) => {
    await downloadFile(build);
  };

  // const handleInstall = (build: FirmwareBuild) => {
  //   downloadFile(build);
  //   setInstallingId(build.id);
  //   setProgress(0);

  //   const interval = setInterval(() => {
  //     setProgress(prev => {
  //       if (prev >= 100) {
  //         clearInterval(interval);
  //         setInstallingId(null);
  //         setInstalledBuild(build);
  //         return 100;
  //       }
  //       return prev + 8;
  //     });
  //   }, 300);
  // };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <DeviceHeader deviceName={deviceName} showConnectionStatus={true} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        {/* HEADER – FULL WIDTH */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <ChevronLeft size={20} color={Colors.black} />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Firmware Update</Text>
          </View>
        </View>

        <View style={styles.container}>
          {/* CURRENT BUILD */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Cpu size={20} color={Colors.primary} />
              <Text style={styles.cardTitle}>Current Build</Text>
            </View>

            {!installedBuild ? (
              <>
                <Text style={styles.boldText}>No Build Installed</Text>
                <Text style={styles.subText}>
                  All 4 use cases are currently available on the device
                </Text>
              </>
            ) : (
              <>
                {/* TITLE + INSTALLED BADGE */}
                <View style={styles.installedRow}>
                  <Text style={styles.buildTitle}>{installedBuild.title}</Text>

                  <View style={styles.installedBadge}>
                    <Text style={styles.installedText}>INSTALLED</Text>
                  </View>
                </View>

                {/* DESCRIPTION */}
                <Text style={styles.subText}>{installedBuild.description}</Text>

                {/* USE CASES */}
                <Text style={styles.label}>Included Use Cases:</Text>
                <View style={styles.tagRow}>
                  {installedBuild.useCases.map(useCase => (
                    <Text key={useCase} style={styles.tag}>
                      {useCase}
                    </Text>
                  ))}
                </View>

                {/* META */}
                <Text style={styles.meta}>
                  Version: {installedBuild.version} &nbsp; Size:{' '}
                  {installedBuild.size} &nbsp; 2024-12-15
                </Text>

                {/* ACTION BUTTONS */}
                <Button mode="contained" style={styles.installBtn}>
                  See it in Action
                </Button>

                <Button
                  mode="outlined"
                  style={styles.uninstallBtn}
                  labelStyle={styles.uninstallLabel}
                  onPress={() => setShowUninstallConfirm(true)}
                >
                  Uninstall & Restore Default
                </Button>
              </>
            )}
          </View>

          {/* AVAILABLE BUILDS */}
          <Text style={styles.sectionTitle}>Available Firmware Builds</Text>

          {loading && firmwareBuilds.length == 0 && <Text>Loading...</Text>}
          {firmwareBuilds
            .filter(b => b.id !== installedBuild?.id)
            .map(build => (
              <View key={build.id} style={styles.card}>
                <Text style={styles.buildTitle}>{build.title}</Text>
                <Text style={styles.subText}>{build.description}</Text>

                <Text style={styles.label}>Included Use Cases:</Text>
                <View style={styles.tagRow}>
                  {build.useCases.map(useCase => (
                    <Text key={useCase} style={styles.tag}>
                      {useCase}
                    </Text>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <Text style={styles.meta}>Version: {build.version}</Text>
                  <Text style={styles.meta}>Size: {build.size}</Text>
                </View>

                {installingId === build.id && (
                  <>
                    <View style={styles.progressBar}>
                      <View
                        style={[styles.progressFill, { width: `${progress}%` }]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      Installing… {progress.toFixed(2)}%
                    </Text>
                  </>
                )}

                <Button
                  mode="contained"
                  style={styles.installBtn}
                  disabled={installingId !== null}
                  onPress={() => handleInstall(build)}
                >
                  {installingId === build.id
                    ? 'Installing…'
                    : 'Install This Build'}
                </Button>
              </View>
            ))}
        </View>
      </ScrollView>
      {showUninstallConfirm && (
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Uninstall Current Build?</Text>
            <Text style={styles.modalDesc}>
              This will remove{' '}
              <Text style={{ fontWeight: '600' }}>{installedBuild?.title}</Text>{' '}
              and restore the default firmware configuration with all 4 use
              cases available.
            </Text>

            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setShowUninstallConfirm(false)}
              >
                Cancel
              </Button>

              <Button
                mode="contained"
                buttonColor={Colors.error}
                onPress={() => {
                  setShowUninstallConfirm(false);
                  setShowUninstallProgress(true);
                  setUninstallProgress(0);

                  const timer = setInterval(() => {
                    setUninstallProgress(p => {
                      if (p >= 100) {
                        clearInterval(timer);
                        setShowUninstallProgress(false);
                        setInstalledBuild(null); // 🔑 removes current build card
                      }
                      return p + 10;
                    });
                  }, 300);
                }}
              >
                Uninstall
              </Button>
            </View>
          </View>
        </View>
      )}
      {showUninstallProgress && (
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Uninstalling Firmware</Text>
            <Text style={styles.subText}>
              Restoring default configuration...
            </Text>

            <Text style={{ marginTop: 16 }}>Progress</Text>

            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${uninstallProgress}%` },
                ]}
              />
            </View>

            <Text style={{ alignSelf: 'flex-end', marginTop: 6 }}>
              {uninstallProgress}%
            </Text>
          </View>
        </View>
      )}

      {/* Bottom Navigation */}
      <BottomNavigationBar
        activeRoute={activeRoute}
        onNavigate={route => setActiveRoute(route)}
        notificationCount={0}
      />
    </View>
  );
};

export default FirmwareUpdateScreen;
const styles = StyleSheet.create({
  root: { flex: 1 },

  scroll: { alignItems: 'center' },
  container: {
    alignSelf: 'center',
    padding: 24,
  },

  header: {
    width: '100%',
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: `${Colors.border.light}`,
  },

  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  headerTitle: {
    fontFamily: 'Sora',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 31,
    letterSpacing: -0.48,
    color: '#000000',
  },

  back: {
    fontSize: 24,
  },

  sectionTitle: {
    fontFamily: 'Sora',
    fontSize: 16,
    fontWeight: '700',
    marginVertical: 16,
  },

  card: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: `${Colors.border.light}`,
    padding: 16,
    marginBottom: 16,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },

  cardTitle: {
    fontFamily: 'Sora',
    fontSize: 16,
    fontWeight: '700',
  },

  buildTitle: {
    fontFamily: 'Sora',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },

  boldText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },

  subText: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },

  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },

  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },

  tag: {
    borderWidth: 1,
    borderColor: `${Colors.border.light}`,
    padding: 4,
    fontSize: 11,
  },

  meta: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
    marginTop: 6,
  },

  installBtn: {
    backgroundColor: `${Colors.primary}`,
    borderRadius: 0,
  },
  installedBadge: {
    borderWidth: 1,
    borderColor: `${Colors.success}`,
    color: `${Colors.success}`,
    fontSize: 11,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },

  uninstallBtn: {
    borderColor: '#FF004E',
    backgroundColor: '#fff',
    marginTop: 12,
  },

  progressBar: {
    height: 6,
    backgroundColor: `${Colors.border.light}`,
    marginBottom: 8,
  },

  progressFill: {
    height: '100%',
    backgroundColor: `${Colors.primary}`,
  },

  progressText: {
    fontSize: 12,
    color: `${Colors.primary}`,
    marginBottom: 8,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },

  modal: {
    width: 320,
    backgroundColor: '#FFF',
    padding: 20,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },

  modalDesc: {
    fontSize: 14,
    marginBottom: 20,
  },

  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  installedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  installedText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#0BD6A5',
  },

  uninstallLabel: {
    color: '#FF004E',
    fontWeight: '600',
  },
});
