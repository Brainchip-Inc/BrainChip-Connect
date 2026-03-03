import { CheckCircle, ChevronLeft, RefreshCw } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
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

  useEffect(() => {
    if (token) {
      fetchModels(token);
    }
  }, [token]);

  const startUpdate = async (model: AIModel) => {
    if (!connectedDevice?.id) {
      Alert.alert('No device connected');
      return;
    }

    if (!token) {
      Alert.alert('Device not authenticated');
      return;
    }

    setScreen('updating');
    setProgress(0);

    let ackSub: ReturnType<typeof BleService.subscribeToModelAck> | null = null;

    try {
      const filePath = await downloadModel(model.id, token, model.filename);

      if (!filePath) {
        Alert.alert('Download failed', 'Unable to download the model');
        setScreen('list');
        return;
      }

      // Subscribe to ACKs (Flash Erase & Flash Write Done)
      ackSub = BleService.subscribeToModelAck(deviceId, ack => {
        if (ack === BleService.getAckFlashErase()) {
          setProgress(50); // Update progress after erase
        }

        if (ack === BleService.getAckFlashWrite()) {
          setProgress(100); // Update progress after write
        }
      });

      // Start model file transfer
      await BleService.sendModelFile(deviceId, filePath, false, percent => {
        setProgress(percent);
      });

      // ✅ Only if sendModelFile succeeds and ACKs are received
      Alert.alert(
        'Update Complete',
        'The device has been successfully updated.',
      );
      setScreen('completed');
    } catch (error) {
      // console.error('Update failed:', error);
      Alert.alert('Update Failed', String(error));
      setScreen('list');
    } finally {
      // Clean up the ACK subscription
      if (ackSub) {
        ackSub.remove();
        ackSub = null;
        // console.log('ACK subscription removed');
      }
    }
  };

  /* ---------------- STOP UPDATE ---------------- */
  const stopUpdate = () => {
    setProgress(0);
    setScreen('list');
  };

  return (
    <View style={styles.root}>
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

            <Text style={styles.headerTitle}>AI Model Update</Text>
          </View>
        </View>
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>Current Version</Text>
            <Text style={styles.version}>Not Found</Text>
          </View>
          {/* ---------------- SCREEN 1 ---------------- */}
          {screen === 'list' &&
            models.map((model, index) => {
              const isNew = index === 0; // first item is newest

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

          {/* ---------------- SCREEN 2 ---------------- */}
          {screen === 'updating' && (
            <View style={styles.card}>
              <RefreshCw size={36} color={Colors.warning} />
              <Text style={styles.centerTitle}>Rebooting device...</Text>

              <ProgressBar
                progress={progress / 100}
                color={Colors.warning}
                style={styles.progress}
              />

              <Text style={styles.percent}>{progress.toFixed(2)}%</Text>

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

          {/* ---------------- SCREEN 3 ---------------- */}
          {screen === 'completed' && (
            <View style={styles.card}>
              <CheckCircle size={42} color={Colors.success} />
              <Text style={styles.centerTitle}>Update complete!</Text>

              <Text style={styles.subText}>
                Your device has been successfully updated to v2.5.0
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

  scroll: { alignItems: 'center' },
  container: {
    alignSelf: 'center',
    padding: 24,
    width: '100%',
  },

  header: {
    width: '100%',
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
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
    backgroundColor: Colors.primary, // blue like screenshot
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
