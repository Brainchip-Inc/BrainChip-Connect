import { pick } from '@react-native-documents/picker';
import { Cpu, Folder, X } from 'lucide-react-native';
import React, { useState } from 'react';
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
  const [isInstalling, setIsInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const { connectedDevice } = useBleStore();
  const [selectedFile, setSelectedFile] = useState<{
    name: string;
    size: number;
    uri: string;
  } | null>(null);

  const { installedBuild, setInstalledBuild } = useFirmwareStore();

  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const [showUninstallProgress, setShowUninstallProgress] = useState(false);
  const [uninstallProgress, setUninstallProgress] = useState(0);

  const runFirmwareUpdate = async (
    deviceId: string,
    filePath: string,
    build: FirmwareBuild,
  ) => {
    try {
      const connected = await bleService.isDeviceConnected(deviceId);
      if (!connected) {
        Alert.alert('Device disconnected');
        return;
      }

      setIsInstalling(true);
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

      setInstalledBuild(build);

      setSelectedFile(null);
    } catch (error: any) {
      if (__DEV__) console.error('[FOTA ERROR]', error);
      Alert.alert(
        'Firmware Update Failed',
        error?.message ?? 'The firmware update did not complete.',
      );
    } finally {
      setIsInstalling(false);
      setProgress(0);
    }
  };

  const browseLocalFirmware = async () => {
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

  const localBuild: FirmwareBuild | null = selectedFile
    ? {
        title: selectedFile.name,
        description: 'Local firmware selected from device',
        version: 'Local',
        size: `${(selectedFile.size / 1024).toFixed(2)} KB`,
        useCases: ['Local Firmware'],
      }
    : null;

  const startLocalUpdate = async () => {
    if (!selectedFile || !localBuild || !connectedDevice?.id) {
      Alert.alert(
        'Installation Failed',
        'No Device Connected or firmware selected',
      );
      return;
    }
    await runFirmwareUpdate(connectedDevice.id, selectedFile.uri, localBuild);
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={styles.modalContainer}
        dismissable={!isInstalling}
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
                <Text style={styles.subtitle}>Manage device firmware</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              disabled={isInstalling}
            >
              <X
                size={18}
                color={isInstalling ? Colors.text.disabled : Colors.black}
              />
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

            {/* ACTION BUTTON */}
            <View style={styles.actionArea}>
              <Button
                mode="contained"
                icon={({ size, color }) => <Folder size={size} color={color} />}
                onPress={browseLocalFirmware}
                style={styles.actionBtn}
              >
                Browse Local Firmware
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

                {isInstalling && (
                  <>
                    <View style={styles.progressBar}>
                      <View
                        style={[styles.progressFill, { width: `${progress}%` }]}
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
                  disabled={isInstalling}
                  onPress={startLocalUpdate}
                >
                  {isInstalling ? 'Installing...' : 'Install This Build'}
                </Button>
              </View>
            )}
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

  actionArea: {
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
