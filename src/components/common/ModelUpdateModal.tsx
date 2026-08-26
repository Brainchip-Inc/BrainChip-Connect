import { pick } from '@react-native-documents/picker';
import {
  CheckCircle,
  Download,
  Folder,
  RefreshCw,
  X,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Portal, Modal, ProgressBar, Text } from 'react-native-paper';
import BleService from '../../services/ble/bleManager';
import { useBleStore } from '../../app/store/useBleStore';
import { AIModel } from '../../types/AIModel';
import { useBleCommandStore } from '../../app/store/useBleCommandStore';
import { Colors } from '../../app/theme/theme';
import RNFS from 'react-native-fs';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type ScreenState = 'list' | 'updating' | 'completed';

interface ModelUpdateModalProps {
  visible: boolean;
  onClose: () => void;
}

const ModelUpdateModal: React.FC<ModelUpdateModalProps> = ({
  visible,
  onClose,
}) => {
  const [screen, setScreen] = useState<ScreenState>('list');
  const [progress, setProgress] = useState(0);

  const { connectedDevice } = useBleStore();
  const deviceId = connectedDevice?.id ?? 'Unknown Device';
  const [localModel, setLocalModel] = useState<AIModel | null>(null);
  const appList = useBleCommandStore(state => state.appsList);
  const reportedVersion = appList[0]?.modelVersion;
  const currentVersion =
    reportedVersion && reportedVersion !== '-' ? reportedVersion : undefined;

  const ackSubRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      ackSubRef.current?.remove();
    };
  }, []);

  // Reset state on every open/close transition
  useEffect(() => {
    setScreen('list');
    setProgress(0);
    setLocalModel(null);
  }, [visible]);

  const startUpdate = async (model: AIModel) => {
    if (screen === 'updating') return;

    if (!connectedDevice?.id) {
      Alert.alert('No device connected');
      return;
    }

    setScreen('updating');
    setProgress(0);

    try {
      const zipPath = model.localPath;

      ackSubRef.current = BleService.subscribeToModelAck(deviceId, ack => {
        if (ack === BleService.getAckFlashErase()) {
          setProgress(10);
        }
        if (ack === BleService.getAckFlashWrite()) {
          setProgress(prev => Math.min(prev + 5, 95));
        }
      });

      await new Promise(r => setTimeout(r, 200));
      await BleService.sendModelZip(deviceId, zipPath, percent => {
        setProgress(Math.round(percent));
      });

      setScreen('completed');
    } catch (error) {
      Alert.alert('Update Failed', String(error));
      setScreen('list');
    } finally {
      ackSubRef.current?.remove();
      ackSubRef.current = null;
    }
  };

  const stopUpdate = () => {
    ackSubRef.current?.remove();
    ackSubRef.current = null;
    BleService.stopModelTransfer();
    setProgress(0);
    setScreen('list');
  };

  const browseLocalModel = async () => {
    setScreen('list');
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
      const sourceUri = (result as any).fileCopyUri ?? result.uri;
      if (!sourceUri) return;

      const cleanUri = sourceUri.replace('file://', '');
      const fileName = result.name ?? 'model.zip';

      if (!fileName.toLowerCase().endsWith('.zip')) {
        Alert.alert('Invalid File', 'Please select a .zip model package');
        return;
      }

      const localPath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      if (await RNFS.exists(localPath)) await RNFS.unlink(localPath);
      await RNFS.copyFile(cleanUri, localPath);
      const stat = await RNFS.stat(localPath);

      const model: AIModel = {
        filename: fileName,
        size_kb: Math.round(stat.size / 1024),
        localPath: localPath,
        description: 'Local model selected from device',
      };

      setLocalModel(model);
    } catch (err: any) {
      if (__DEV__) console.log('File picker error:', err?.message);
      if (err?.message !== 'User cancelled the picker') {
        Alert.alert('File selection failed');
      }
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={styles.modalContainer}
        dismissable={screen !== 'updating'}
      >
        {/* Backdrop */}
        <View style={styles.backdrop} />

        {/* Modal content */}
        <View style={styles.modal}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Download size={18} color={Colors.primary} />
              <View>
                <Text style={styles.title}>Model Update</Text>
                <Text style={styles.subtitle}>Manage AI models on device</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              disabled={screen === 'updating'}
            >
              <X
                size={18}
                color={
                  screen === 'updating' ? Colors.text.disabled : Colors.black
                }
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={true}
            style={styles.scrollContent}
          >
            {/* CURRENT VERSION */}
            <View style={styles.card}>
              <Text style={styles.label}>Current Version</Text>
              <Text style={styles.version}>
                {currentVersion ? currentVersion : 'Not Found'}
              </Text>
            </View>

            {/* ACTION BUTTON - only in list mode */}
            {screen === 'list' && (
              <View style={styles.actionArea}>
                <Button
                  mode="contained"
                  icon={({ size, color }) => (
                    <Folder size={size} color={color} />
                  )}
                  onPress={browseLocalModel}
                  style={styles.actionBtn}
                >
                  Browse Local Model
                </Button>
              </View>
            )}

            {/* LOCAL MODEL CARD */}
            {screen === 'list' && localModel && (
              <View style={styles.card}>
                <View style={styles.buildHeaderRow}>
                  <Text style={styles.label}>Available Version</Text>
                  <View style={styles.localBadge}>
                    <Text style={styles.badgeText}>LOCAL</Text>
                  </View>
                </View>

                <Text style={styles.newVersion}>{localModel.filename}</Text>
                <Text style={styles.subText}>{localModel.description}</Text>
                <Text style={styles.label}>Size: {localModel.size_kb} KB</Text>

                <Button
                  mode="contained"
                  style={styles.primaryBtn}
                  onPress={() => startUpdate(localModel)}
                >
                  Install Model
                </Button>
              </View>
            )}

            {/* UPDATING SCREEN */}
            {screen === 'updating' && (
              <View style={[styles.card, { alignItems: 'center' }]}>
                <RefreshCw size={36} color={Colors.warning} />
                <Text style={styles.centerTitle}>Flashing model...</Text>

                <ProgressBar
                  progress={progress / 100}
                  color={Colors.warning}
                  style={styles.progress}
                />

                <Text style={styles.percent}>{progress.toFixed(0)}%</Text>

                <Button
                  mode="outlined"
                  textColor={Colors.error}
                  style={styles.stopBtn}
                  onPress={stopUpdate}
                >
                  Stop Update
                </Button>

                <View style={styles.warningBox}>
                  <Text style={styles.warningText}>
                    Do not disconnect or power off the device during the update
                    process.
                  </Text>
                </View>
              </View>
            )}

            {/* COMPLETED SCREEN */}
            {screen === 'completed' && (
              <View style={[styles.card, { alignItems: 'center' }]}>
                <CheckCircle size={42} color={Colors.success} />
                <Text style={styles.centerTitle}>Update complete!</Text>

                <Text style={styles.subText}>
                  Your device has been successfully updated to the new model.
                </Text>

                <Button
                  mode="contained"
                  style={styles.primaryBtn}
                  onPress={onClose}
                >
                  Done
                </Button>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    </Portal>
  );
};

export default ModelUpdateModal;

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

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },

  version: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },

  newVersion: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },

  subText: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },

  actionArea: {
    marginBottom: 16,
    paddingTop: 8,
  },

  actionBtn: {
    borderRadius: 0,
  },

  primaryBtn: {
    marginTop: 16,
    width: '100%',
    borderRadius: 0,
    backgroundColor: Colors.primary,
  },

  buildHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },

  localBadge: {
    backgroundColor: '#6B7280',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.5,
  },

  centerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginVertical: 16,
  },

  progress: {
    width: '100%',
    height: 6,
    marginVertical: 12,
  },

  percent: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },

  stopBtn: {
    width: '100%',
    borderColor: Colors.error,
    borderRadius: 0,
  },

  warningBox: {
    marginTop: 20,
    padding: 12,
    backgroundColor: '#FFF4E5',
    borderWidth: 1,
    borderColor: '#FFD199',
    width: '100%',
  },

  warningText: {
    fontSize: 12,
    color: '#92400E',
    textAlign: 'center',
  },
});
