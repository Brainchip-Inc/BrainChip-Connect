import {
  CheckCircle,
  ChevronLeft,
  CloudDownload,
  Folder,
  RefreshCw,
} from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, ProgressBar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNavigationBar from '../../components/custom/BottomNavigationBar';
import DeviceHeader from '../../components/custom/DeviceHeader';
import BleService from '../../services/ble/bleManager';
import { RouteName, ROUTES } from '../../types/routes';
import { useBleStore } from '../store/useBleStore';
import { useDeviceAuthStore } from '../store/useDeviceAuthStore';
import { AIModel, useModelStore } from '../store/useModelStore';
import { Colors } from '../theme/theme';
import { pick } from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import { useBleCommandStore } from '../store/useBleCommandStore';

type ScreenState = 'list' | 'updating' | 'completed';

const AIModelUpdateScreen = ({ navigation }: any) => {
  const [screen, setScreen] = useState<ScreenState>('list');
  const [progress, setProgress] = useState(0);
  const insets = useSafeAreaInsets();

  const [activeRoute, setActiveRoute] = useState<RouteName>(ROUTES.SETTINGS);
  const { connectedDevice } = useBleStore();

  const deviceName = connectedDevice?.name ?? 'Unknown Device';
  const deviceId = connectedDevice?.id ?? 'Unknown Device';
  const { models, fetchModels, downloadModel, loading } = useModelStore();
  const token = useDeviceAuthStore(state => state.token);
  const [localModel, setLocalModel] = useState<AIModel | null>(null);
  const [showServerModels, setShowServerModels] = useState(false);
  const [serverLoading, setServerLoading] = useState(false);
  const appList = useBleCommandStore(state => state.appsList);
  const currentVersion = appList[0]?.modelVersion

  // Keeps a ref to the ACK subscription so it can be cleaned up on unmount
  const ackSubRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      ackSubRef.current?.remove();
    };
  }, []);

  const startUpdate = async (model: AIModel) => {
    if (screen === 'updating') return;

    if (!connectedDevice?.id) {
      Alert.alert('No device connected');
      return;
    }

    if (!token && !model.local) {
      Alert.alert('Device not authenticated');
      return;
    }

    setScreen('updating');
    setProgress(0);

    try {
      let zipPath = '';

      // Local model — user picked a .zip from device storage
      if (model.local) {
        zipPath = model.localPath!;
      }
      // Server model — download the zip first
      else {
        const downloaded = await downloadModel(
          model.id,
          token!,
          model.filename,
        );

        if (!downloaded) {
          throw new Error('Download failed');
        }

        zipPath = downloaded;
      }

      // Subscribe to raw ACK codes for progress feedback
      ackSubRef.current = BleService.subscribeToModelAck(deviceId, ack => {
        if (ack === BleService.getAckFlashErase()) {
          // Flash erase done — INFO file received, data transfer starting
          setProgress(10);
        }
        if (ack === BleService.getAckFlashWrite()) {
          // Flash write done — transfer chunk acknowledged
          setProgress(prev => Math.min(prev + 5, 95));
        }
      });

      await new Promise(r => setTimeout(r, 200));
      // Run the full INFO + DATA transfer from the zip
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

  /* ---------------- STOP UPDATE ---------------- */
  const stopUpdate = () => {
    ackSubRef.current?.remove();
    ackSubRef.current = null;
    BleService.stopModelTransfer();
    setProgress(0);
    setScreen('list');
  };

  const browseLocalModel = async () => {
    try {
      setShowServerModels(false);

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

      // Only accept .zip files — the transfer requires the full zip bundle
      if (!fileName.toLowerCase().endsWith('.zip')) {
        Alert.alert('Invalid File', 'Please select a .zip model package');
        return;
      }

      const localPath = `${RNFS.CachesDirectoryPath}/${fileName}`;
      if (await RNFS.exists(localPath)) await RNFS.unlink(localPath);
      await RNFS.copyFile(cleanUri, localPath);
      const stat = await RNFS.stat(localPath);

      const model: AIModel = {
        id: -1,
        version: 'Local Model',
        filename: fileName,
        size_kb: Math.round(stat.size / 1024),
        local: true,
        localPath: localPath,
        release_notes: 'NA',
        created_at: new Date().toISOString(),
        description: 'Local model selected from device',
        filepath: localPath,
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
    <View style={styles.root}>
      <DeviceHeader deviceName={deviceName} showConnectionStatus={true} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[{ paddingBottom: insets.bottom + 32 }]}
      >
        {/* HEADER – FULL WIDTH */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <ChevronLeft size={20} color={Colors.black} />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>AI Model Update</Text>
          </View>
        </View>

        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>Current Version</Text>
            <Text style={styles.version}>{currentVersion ? currentVersion : "Not Found"}</Text>
          </View>

          <View
            style={{
              flexDirection: 'column',
              gap: 10,
              marginBottom: 20,
              paddingTop: 10,
            }}
          >
            <Button
              mode="contained"
              icon={({ size, color }) => <Folder size={size} color={color} />}
              onPress={browseLocalModel}
            >
              Browse Local Model
            </Button>

            <Button
              mode="outlined"
              icon={({ size, color }) => (
                <CloudDownload size={size} color={color} />
              )}
              onPress={async () => {
                if (!token) return;

                setLocalModel(null);
                setShowServerModels(true);
                setServerLoading(true);

                await fetchModels(token);

                setServerLoading(false);
              }}
            >
              Download From Server
            </Button>
          </View>

          {/* ---------------- SCREEN 1 : local model card ---------------- */}
          {screen === 'list' && localModel && (
            <View style={[styles.card, { alignItems: 'center' }]}>
              <View style={styles.versionHeaderRow}>
                <Text style={styles.title}>Available Version</Text>
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>LOCAL</Text>
                </View>
              </View>

              <Text style={styles.newVersion}>{localModel.filename}</Text>
              <Text style={styles.releaseTitle}>Description</Text>
              <Text style={styles.bullet}>• {localModel.description}</Text>
              <Text style={styles.title}>Size: {localModel.size_kb} KB</Text>

              <Button
                mode="contained"
                style={styles.primaryBtn}
                onPress={() => startUpdate(localModel)}
              >
                Install Model
              </Button>
            </View>
          )}

          {/* ---------------- SCREEN 1 : server models loading ---------------- */}
          {screen === 'list' && showServerModels && serverLoading && (
            <View style={styles.card}>
              <RefreshCw size={24} color={Colors.primary} />
              <Text style={{ marginTop: 10 }}>
                Fetching models from server...
              </Text>
            </View>
          )}

          {/* ---------------- SCREEN 1 : server model list ---------------- */}
          {screen === 'list' &&
            showServerModels &&
            !serverLoading &&
            models.map((model, index) => {
              const isNew = index === 0;

              return (
                <View key={model.id} style={styles.card}>
                  <View style={styles.versionHeaderRow}>
                    <Text style={styles.title}>Available Version</Text>
                    {isNew && (
                      <View style={styles.newBadge}>
                        <Text style={styles.newBadgeText}>NEW</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.newVersion}>{model.version}</Text>
                  <Text style={styles.releaseTitle}>Release Notes</Text>

                  {model.release_notes
                    ?.split('\n')
                    .filter(line => line.trim() !== '')
                    .map((line, i) => (
                      <Text key={i} style={styles.bullet}>
                        • {line.trim()}
                      </Text>
                    ))}

                  <Text style={styles.title}>Size: {model.size_kb} KB</Text>

                  <Button
                    mode="contained"
                    style={styles.primaryBtn}
                    disabled={loading}
                    onPress={() => startUpdate(model)}
                  >
                    Download and Install
                  </Button>
                </View>
              );
            })}

          {/* ---------------- SCREEN 2 : transfer in progress ---------------- */}
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

          {/* ---------------- SCREEN 3 : completed ---------------- */}
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
                onPress={() => navigation.navigate('FirmwareUpdate')}
              >
                Browse Firmware Builds
              </Button>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavigationBar
        activeRoute={activeRoute}
        onNavigate={route => setActiveRoute(route)}
        notificationCount={0}
      />
    </View>
  );
};

export default AIModelUpdateScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  container: {
    paddingHorizontal: 20,
  },

  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },

  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  headerTitle: {
    fontFamily: 'Sora',
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 31,
    letterSpacing: -0.48,
    color: Colors.black,
  },

  back: {
    fontSize: 24,
  },

  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border.light,
    padding: 24,
    marginTop: 10,
  },

  title: {
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
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },

  releaseTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 20,
    alignSelf: 'flex-start',
  },

  bullet: {
    fontSize: 13,
    color: Colors.primary,
    marginTop: 6,
    alignSelf: 'flex-start',
  },

  primaryBtn: {
    marginTop: 24,
    width: '100%',
    borderRadius: 0,
    backgroundColor: Colors.primary,
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

  subText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },

  versionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
});
