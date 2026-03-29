import { pick } from '@react-native-documents/picker';
import {
  ChevronLeft,
  CloudDownload,
  Cpu,
  Folder,
  Loader,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNavigationBar from '../../components/custom/BottomNavigationBar';
import DeviceHeader from '../../components/custom/DeviceHeader';
import bleService from '../../services/ble/bleManager';
import { FirmwareBuild } from '../../types/FirmwareBuild';
import { RouteName, ROUTES } from '../../types/routes';
import { useBleCommandStore } from '../store/useBleCommandStore';
import { useBleStore } from '../store/useBleStore';
import { useDeviceAuthStore } from '../store/useDeviceAuthStore';
import { useFirmwareStore } from '../store/useFirmwareStore';
import { Colors } from '../theme/theme';
import RNFS from 'react-native-fs';

const CONTENT_WIDTH = 382;

const FirmwareUpdateScreen = ({ navigation }: any) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [activeRoute, setActiveRoute] = useState<RouteName>(ROUTES.SETTINGS);
  const [installingId, setInstallingId] = useState<string | number | null>(null);
  const [progress, setProgress] = useState(0);
  const { connectedDevice } = useBleStore();
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    uri: string;
  } | null>(null);

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
  const [isLocalFile, setIsLocalFile] = useState(false);
  const [serverRequested, setServerRequested] = useState(false);

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
    }
  }, [authtoken]);

  const FetchFromServer = async () => {
    // if (!authtoken) return;

    setIsLocalFile(false);
    setSelectedFile(null);
    setServerRequested(true);

    await fetchFirmwareBuilds(authtoken!);
  };

  const runFirmwareUpdate = async (
    deviceId: string,
    filePath: string,
    buildId: string | number,
    build?: FirmwareBuild,
  ) => {
    try {
      const connected = await bleService.isDeviceConnected(deviceId);

      if (!connected) {
        Alert.alert('Device disconnected');
        return;
      }

      setInstallingId(buildId);
      setProgress(0);

      const exists = await RNFS.exists(filePath);

      if (!exists) {
        Alert.alert('Firmware file not found');
        return;
      }

      // useBleCommandStore.getState().stopNotifications();

      await bleService.performFota(
        deviceId,
        filePath,
        percent => setProgress(percent),
        msg => console.log('[FOTA]', msg),
      );

      Alert.alert('Success', 'Firmware updated successfully');

      if (build) {
        setInstalledBuild(build);
      }

      setSelectedFile(null);
    } catch (error: any) {
      if (__DEV__) console.error('[FOTA ERROR]', error);
      Alert.alert(
        'Firmware Update Failed',
        error?.message ?? 'The firmware update did not complete.',
      );
    } finally {
      setInstallingId(null);
      setProgress(0);
    }
  };

  const browseLocalFirmware = async () => {
    setIsLocalFile(true);
    setServerRequested(false);
    setSelectedFile(null);

    try {
      // const [result] = await pick({
      //   type: ['*/*'],
      //   copyTo: 'cachesDirectory',
      // });
      const results = await pick({
        allowMultiSelection: false,
        type: Platform.select({
          ios: ['public.data'],
          android: ['*/*'],
        }),
        copyTo: 'cachesDirectory',
      });

      const result = results[0];

      const fileName = result.name ?? 'firmware.bin';

      if (!fileName.toLowerCase().endsWith('.bin')) {
        Alert.alert('Invalid File', 'Please select a .bin firmware file');
        return;
      }

      // Prefer copied path
      const sourceUri = (result as any).fileCopyUri ?? result.uri;

      if (!sourceUri) {
        Alert.alert('Invalid file path');
        return;
      }

      // Clean URI
      const cleanUri = sourceUri.replace('file://', '');

      // Copy to stable path inside app cache
      const localPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

      await RNFS.copyFile(cleanUri, localPath);

      const stat = await RNFS.stat(localPath);

      setSelectedFile({
        name: fileName,
        size: stat.size,
        uri: localPath,
      });

      if (__DEV__) console.log('Local firmware copied to:', localPath);
    } catch (err: any) {
      if (__DEV__) console.log('File picker error:', err?.message);

      if (err?.message !== 'User cancelled the picker') {
        Alert.alert('File selection failed');
      }
    }
  };

  const localBuild =
    selectedFile && isLocalFile
      ? {
          id: 'local',
          title: selectedFile.name,
          description: 'Local firmware selected from device',
          version: 'Local',
          size: `${(selectedFile.size / 1024).toFixed(2)} KB`,
          useCases: ['Local Firmware'],
          filename: selectedFile.name,
        }
      : null;

  const startLocalUpdate = async () => {
    if (!selectedFile || !connectedDevice?.id) {
      Alert.alert(
        'Installation Failed',
        'No Device Connected or firmware selected',
      );
      return;
    }

    await runFirmwareUpdate(
      connectedDevice.id,
      selectedFile.uri,
      'local',
      localBuild!,
    );
    // try {
    //   if (!selectedFile || !connectedDevice?.id) {
    //     Alert.alert(
    //       'Installation Failed',
    //       'No Device Connected or firmware selected',
    //     );
    //     return;
    //   }

    //   const deviceId = connectedDevice.id;

    //   const connected = await bleService.isDeviceConnected(deviceId);

    //   if (!connected) {
    //     Alert.alert('Device disconnected');
    //     return;
    //   }

    //   setInstallingId('local');
    //   setProgress(0);

    //   const exists = await RNFS.exists(selectedFile.uri);

    //   if (!exists) {
    //     Alert.alert('Firmware file not found');
    //     return;
    //   }

    //   // useBleCommandStore.getState().stopNotifications();

    //   await bleService.performFota(
    //     deviceId,
    //     selectedFile.uri,
    //     percent => setProgress(percent),
    //     msg => console.log('[LOCAL FOTA]', msg),
    //   );

    //   Alert.alert('Success', 'Firmware updated successfully');

    //   setSelectedFile(null);
    // } catch (error: any) {
    //   Alert.alert('Firmware Update Failed', error?.message ?? 'Update failed');
    // } finally {
    //   setInstallingId(null);
    //   setProgress(0);
    // }
  };

  const downloadFile = async (build: FirmwareBuild) => {
    setIsLocalFile(false);
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
      if (__DEV__) console.log('downloadFile filePath:', filePath);
      if (!filePath) throw new Error('Download failed');

      // const connected = await bleService.isDeviceConnected(deviceId);

      // if (!connected) {
      //   Alert.alert('Device disconnected');
      //   return;
      // }

      // // useBleCommandStore.getState().stopNotifications();

      // // 3. Run full FOTA — handles subscribe, SMP params, upload, confirm, reset
      // await bleService.performFota(
      //   deviceId,
      //   filePath,
      //   percent => setProgress(percent), // live progress 0–100
      //   msg => console.log('[FOTA]', msg), // optional log callback
      // );

      // Alert.alert('Success', 'Firmware updated successfully');

      // // 4. Done
      // setInstalledBuild(build);

      if (!filePath || !connectedDevice?.id) {
        Alert.alert(
          'Installation Failed',
          'No Device Connected or firmware selected',
        );
        return;
      }

      await runFirmwareUpdate(
        connectedDevice.id,
        filePath,
        build.id,
        build,
      );
    } catch (error: any) {
      if (__DEV__) console.error('[downloadFile] error:', error);
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

          <View style={{ flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            <Button
              mode="contained"
              icon={({ size, color }) => <Folder size={size} color={color} />}
              onPress={browseLocalFirmware}
            >
              Browse Local Firmware
            </Button>

            <Button
              mode="outlined"
              icon={({ size, color }) => (
                <CloudDownload size={size} color={color} />
              )}
              onPress={FetchFromServer}
            >
              Download From Server
            </Button>
          </View>

          {localBuild && (
            <View style={styles.card}>
              <Text style={styles.buildTitle}>{localBuild.title}</Text>
              <Text style={styles.subText}>{localBuild.description}</Text>

              <Text style={styles.label}>Source</Text>

              <View style={styles.tagRow}>
                <Text style={styles.tag}>Local File</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Text style={styles.meta}>Version: {localBuild.version}</Text>
                <Text style={styles.meta}>Size: {localBuild.size}</Text>
              </View>

              {installingId === 'local' && (
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
                onPress={startLocalUpdate}
              >
                {installingId === 'local'
                  ? 'Installing…'
                  : 'Install This Build'}
              </Button>
            </View>
          )}

          {/* AVAILABLE BUILDS */}
          {serverRequested && !loading && firmwareBuilds.length > 0 && (
            <Text style={styles.sectionTitle}>Available Firmware Builds</Text>
          )}
          {serverRequested && loading && (
            <View style={styles.card}>
              <Loader size={20} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Fetching firmware builds</Text>
              <Text style={styles.subText}>
                Downloading firmware list from server...
              </Text>
            </View>
          )}

          {serverRequested && !loading && firmwareBuilds.length === 0 && (
            <View style={styles.card}>
              <Text style={styles.buildTitle}>No Firmware Available</Text>
              <Text style={styles.subText}>
                No firmware builds were found on the server.
              </Text>
            </View>
          )}
          {serverRequested &&
            !loading &&
            firmwareBuilds
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
                          style={[
                            styles.progressFill,
                            { width: `${progress}%` },
                          ]}
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
