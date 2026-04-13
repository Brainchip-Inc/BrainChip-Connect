import { pick } from '@react-native-documents/picker';
import {
  CloudDownload,
  Cpu,
  Folder,
  Loader,
  X,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Portal, Modal, Text } from 'react-native-paper';
import bleService from '../../services/ble/bleManager';
import { FirmwareBuild } from '../../types/FirmwareBuild';
import { useBleStore } from '../../app/store/useBleStore';
import { useDeviceAuthStore } from '../../app/store/useDeviceAuthStore';
import { useFirmwareStore } from '../../app/store/useFirmwareStore';
import { Colors } from '../../app/theme/theme';
import RNFS from 'react-native-fs';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FirmwareUpdateModalProps {
  visible: boolean;
  onClose: () => void;
}

const FirmwareUpdateModal: React.FC<FirmwareUpdateModalProps> = ({
  visible,
  onClose,
}) => {
  const [installingId, setInstallingId] = useState<number | null>(null);
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
  const [expandedBuildId, setExpandedBuildId] = useState<number | null>(null);

  useEffect(() => {
    if (visible && !authtoken) {
      Alert.alert(
        'Authentication Failed',
        `Device ${deviceName} not authenticated`,
        [{ text: 'OK', onPress: onClose }],
      );
    }
  }, [visible, authtoken]);

  const FetchFromServer = async () => {
    setIsLocalFile(false);
    setSelectedFile(null);
    setServerRequested(true);
    await fetchFirmwareBuilds(authtoken!);
  };

  const runFirmwareUpdate = async (
    deviceId: string,
    filePath: string,
    buildId: number,
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

      if (
        !fileName.toLowerCase().endsWith('.bin') &&
        !fileName.toLowerCase().endsWith('.zip')
      ) {
        Alert.alert(
          'Invalid File',
          'Please select a .bin or .zip firmware file',
        );
        return;
      }

      const sourceUri = (result as any).fileCopyUri ?? result.uri;
      if (!sourceUri) {
        Alert.alert('Invalid file path');
        return;
      }

      const cleanUri = sourceUri.replace('file://', '');
      const localPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

      if (await RNFS.exists(localPath)) await RNFS.unlink(localPath);
      await RNFS.copyFile(cleanUri, localPath);

      const stat = await RNFS.stat(localPath);

      setSelectedFile({
        name: fileName,
        size: stat.size,
        uri: localPath,
      });
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
          id: -1,
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
      -1,
      localBuild!,
    );
  };

  const downloadFile = async (build: FirmwareBuild) => {
    setIsLocalFile(false);
    try {
      if (!authtoken || !connectedDevice?.id) {
        Alert.alert('Device not ready');
        return;
      }

      setInstallingId(build.id);
      setProgress(0);

      const filePath = await downloadFirmware(
        build.id,
        authtoken,
        build.filename,
      );
      if (!filePath) throw new Error('Download failed');

      await runFirmwareUpdate(connectedDevice.id, filePath, build.id, build);
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

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={styles.modalContainer}
        dismissable={true}
      >
        {/* Backdrop */}
        <View style={styles.backdrop} />

        {/* Modal content */}
        <View style={styles.modal}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Cpu size={18} color={Colors.primary} />
              <View>
                <Text style={styles.title}>Firmware Update</Text>
                <Text style={styles.subtitle}>
                  Manage device firmware
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={true}
            style={styles.scrollContent}
          >
            {/* CURRENT BUILD */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Cpu size={16} color={Colors.primary} />
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
                  <View style={styles.installedRow}>
                    <Text style={styles.buildTitle}>
                      {installedBuild.title}
                    </Text>
                    <View style={styles.installedBadge}>
                      <Text style={styles.installedText}>INSTALLED</Text>
                    </View>
                  </View>
                  <Text style={styles.subText}>
                    Version: {installedBuild.version}
                  </Text>
                </>
              )}
            </View>

            {/* ACTION BUTTONS */}
            <View style={styles.buttonRow}>
              <Button
                mode="contained"
                icon={({ size, color }) => <Folder size={size} color={color} />}
                onPress={browseLocalFirmware}
                style={styles.actionBtn}
              >
                Browse Local Firmware
              </Button>

              <Button
                mode="outlined"
                icon={({ size, color }) => (
                  <CloudDownload size={size} color={color} />
                )}
                onPress={FetchFromServer}
                style={styles.actionBtn}
              >
                Download From Server
              </Button>
            </View>

            {/* LOCAL BUILD CARD */}
            {localBuild && (
              <View style={styles.card}>
                <Text style={styles.buildTitle}>{localBuild.title}</Text>
                <Text style={styles.subText}>{localBuild.description}</Text>

                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <Text style={styles.meta}>Version: {localBuild.version}</Text>
                  <Text style={styles.meta}>Size: {localBuild.size}</Text>
                </View>

                {installingId === -1 && (
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
                      Installing... {progress.toFixed(2)}%
                    </Text>
                  </>
                )}

                <Button
                  mode="contained"
                  style={styles.installBtn}
                  disabled={installingId !== null}
                  onPress={startLocalUpdate}
                >
                  {installingId === -1 ? 'Installing...' : 'Install This Build'}
                </Button>
              </View>
            )}

            {/* SERVER BUILDS - LOADING */}
            {serverRequested && loading && (
              <View style={styles.card}>
                <Loader size={20} color={Colors.primary} />
                <Text style={[styles.boldText, { marginTop: 8 }]}>
                  Fetching firmware builds
                </Text>
                <Text style={styles.subText}>
                  Downloading firmware list from server...
                </Text>
              </View>
            )}

            {/* SERVER BUILDS - EMPTY */}
            {serverRequested && !loading && firmwareBuilds.length === 0 && (
              <View style={styles.card}>
                <Text style={styles.buildTitle}>No Firmware Available</Text>
                <Text style={styles.subText}>
                  No firmware builds were found on the server.
                </Text>
              </View>
            )}

            {/* SERVER BUILDS - LIST */}
            {serverRequested &&
              !loading &&
              firmwareBuilds
                .filter(b => b.id !== installedBuild?.id)
                .map((build, index) => {
                  const isExpanded = expandedBuildId === build.id;
                  const isNewest = index === 0;

                  return (
                    <View key={build.id} style={styles.card}>
                      <View style={styles.buildHeaderRow}>
                        <Text style={styles.buildTitle}>{build.title}</Text>
                        {isNewest && (
                          <View style={styles.newBadge}>
                            <Text style={styles.newBadgeText}>NEW</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.meta}>
                        Version: {build.version} | Size: {build.size}
                      </Text>

                      {isExpanded && (
                        <>
                          <Text style={styles.subText}>
                            {build.description}
                          </Text>
                          <Text style={styles.label}>Included Use Cases:</Text>
                          <View style={styles.tagRow}>
                            {build.useCases.map(useCase => (
                              <Text key={useCase} style={styles.tag}>
                                {useCase}
                              </Text>
                            ))}
                          </View>
                        </>
                      )}

                      <TouchableOpacity
                        onPress={() =>
                          setExpandedBuildId(isExpanded ? null : build.id)
                        }
                      >
                        <Text style={styles.moreInfoText}>
                          {isExpanded ? 'Less Information' : 'More Information'}
                        </Text>
                      </TouchableOpacity>

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
                            Installing... {progress.toFixed(2)}%
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
                          ? 'Installing...'
                          : 'Install This Build'}
                      </Button>
                    </View>
                  );
                })}
          </ScrollView>
        </View>

        {/* Uninstall confirmation overlay */}
        {showUninstallConfirm && (
          <View style={styles.overlay}>
            <View style={styles.overlayModal}>
              <Text style={styles.overlayTitle}>Uninstall Current Build?</Text>
              <Text style={styles.subText}>
                This will remove{' '}
                <Text style={{ fontWeight: '600' }}>
                  {installedBuild?.title}
                </Text>{' '}
                and restore the default firmware configuration.
              </Text>

              <View style={styles.overlayActions}>
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
                          setInstalledBuild(null);
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

        {/* Uninstall progress overlay */}
        {showUninstallProgress && (
          <View style={styles.overlay}>
            <View style={styles.overlayModal}>
              <Text style={styles.overlayTitle}>Uninstalling Firmware</Text>
              <Text style={styles.subText}>
                Restoring default configuration...
              </Text>
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
      </Modal>
    </Portal>
  );
};

export default FirmwareUpdateModal;

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },

  backdrop: {
    position: 'absolute',
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: 'rgba(0,0,0,0.4)',
    top: 0,
    left: 0,
  },

  modal: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 0,
    width: '90%',
    maxHeight: '85%',
    elevation: 5,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
    gap: 8,
  },

  closeBtn: {
    padding: 6,
    backgroundColor: Colors.background,
    borderRadius: 4,
  },

  title: {
    fontFamily: 'Sora',
    fontSize: 16,
    fontWeight: '700',
    color: Colors.black,
  },

  subtitle: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: Colors.black,
    opacity: 0.6,
    marginTop: 2,
  },

  scrollContent: {
    flexGrow: 0,
  },

  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border.light,
    padding: 16,
    marginBottom: 12,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },

  cardTitle: {
    fontFamily: 'Sora',
    fontSize: 14,
    fontWeight: '700',
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
    marginBottom: 8,
  },

  buildTitle: {
    fontFamily: 'Sora',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },

  installedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  installedBadge: {
    borderWidth: 1,
    borderColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },

  installedText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.success,
  },

  buttonRow: {
    flexDirection: 'column',
    gap: 10,
    marginBottom: 16,
  },

  actionBtn: {
    borderRadius: 0,
  },

  meta: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
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
    borderColor: Colors.border.light,
    padding: 4,
    fontSize: 11,
  },

  installBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 0,
    marginTop: 8,
  },

  progressBar: {
    height: 6,
    backgroundColor: Colors.border.light,
    marginBottom: 8,
    marginTop: 8,
  },

  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },

  progressText: {
    fontSize: 12,
    color: Colors.primary,
    marginBottom: 8,
  },

  buildHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },

  newBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  newBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.5,
  },

  moreInfoText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
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

  overlayModal: {
    width: 300,
    backgroundColor: Colors.white,
    padding: 20,
  },

  overlayTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },

  overlayActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 12,
  },
});
