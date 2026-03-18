import {
  NavigationProp,
  useNavigation,
  useRoute,
} from '@react-navigation/native';
import {
  Accessibility,
  Activity,
  Box,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeClosed,
  History,
  Mic,
  Play,
  Square,
} from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ProgressBar, Switch, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import BottomNavigationBar from '../../components/custom/BottomNavigationBar';
import DeviceHeader from '../../components/custom/DeviceHeader';
import BleService from '../../services/ble/bleManager';
import { RouteName, ROUTES } from '../../types/routes';
import { useBleStore } from '../store/useBleStore';
import { AppType, useLiveSensorStore } from '../store/useLiveSensorStore';
import { Colors } from '../theme/theme';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootParamList } from '../../../App';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 48 - 32; // margins + card padding
const CHART_HEIGHT = 120;

// ─── Reusable Section Row (same as SettingsScreen's SettingRow) ───────────────
const SectionHeader = ({
  icon,
  title,
}: {
  icon: React.ReactNode;
  title: string;
}) => (
  <View style={styles.sectionHeader}>
    {icon}
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

// ─── Line Chart ───────────────────────────────────────────────────────────────
const LineChart = ({
  datasets,
}: {
  datasets: { data: number[]; color: string }[];
}) => {
  const toPoints = (data: number[]) => {
    const len = data.length;
    if (len < 2) return '';

    const max = 5000;
    const min = 0;
    const range = max - min || 1; // avoid divide by zero

    return data
      .map((v, i) => {
        const x = (i / (len - 1)) * CHART_WIDTH;

        // auto-scale based on actual data
        const normalized = (v - min) / range;
        const y = CHART_HEIGHT - normalized * CHART_HEIGHT;

        return `${x},${y}`;
      })
      .join(' ');
  };

  return (
    <View style={styles.chartBox}>
      <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
        {datasets.map((ds, idx) => (
          <Polyline
            key={idx}
            points={toPoints(ds.data)}
            fill="none"
            stroke={ds.color}
            strokeWidth="2"
          />
        ))}
      </Svg>
    </View>
  );
};

// ─── Screen ───────────────────────────────────────────────────────────────────
const LiveSensorDataScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootParamList>>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const { connectedDevice } = useBleStore();
  const deviceName = connectedDevice?.name ?? 'Unknown Device';
  const deviceId = connectedDevice?.id ?? 'Unknown';

  const [activeRoute, setActiveRoute] = useState<RouteName>(ROUTES.HOME);

  const { appType, title } = route.params as {
    appType: AppType;
    title: string;
  };

  const {
    startStreaming,
    stopStreaming,
    simulateData,
    keywordConfidence,
    detectedWord,
    anomalyScore,
    systemStatus,
    accel,
    gyro,
  } = useLiveSensorStore();

  const isStreaming = useLiveSensorStore(s => s.isStreaming);
  const micWave = useLiveSensorStore(s => s.micWave);
  const [showDeviceInfo, setShowDeviceInfo] = useState(false);
  const [edgeLearningMode, setEdgeLearningMode] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      simulateData();
    }, 1000);
    return () => clearInterval(interval);
  }, [isStreaming]);

  // ─── App type icon ──────────────────────────────────────────────────────────
  const getAppIcon = () => {
    if (appType === 'keyword') return <Mic size={20} />;
    if (appType === 'vision') return <Box size={20} />;
    return <Activity size={20} />;
  };

  useEffect(() => {
    const sub = BleService.subscribeToEdgeLearningAck(deviceId, ack => {
      if (ack === BleService.getAckEdgeMode()) {
        Alert.alert(
          'Activated',
          'Edge Learning Mode is activated successfully',
        );
      }
    });

    return () => sub.remove();
  }, [deviceId]);

  const sendEdgeCmd = async (value: number) => {
    try {
      console.log('Sending EDGE command:', value);

      await BleService.sendEdgeCommand(deviceId, value);
    } catch (err) {
      console.log('Edge command error', err);

      Alert.alert('Command Failed', 'Unable to send command to the device.');
    }
    Alert.alert('Command Send', 'Command Send successfully');
  };

  const handleMode = () => {
    const newMode = !edgeLearningMode;
    sendEdgeCmd(0); // Switch to inference or edge learning mode
    setEdgeLearningMode(newMode);
  };

  // ─── Model Output Card ──────────────────────────────────────────────────────
  const renderModelOutput = () => {
    if (appType === 'keyword') {
      return (
        <View
          style={[
            styles.outputCard,
            styles.keywordOutputBox,
            isStreaming ? styles.keywordActive : null,
          ]}
        >
          <Text style={styles.placeholderCenter}>
            Start streaming to see model output
          </Text>
          <View style={styles.modelOutputHeaderRow}>
            <Text style={styles.labelMuted}>Detected Keyword</Text>
            {isStreaming && <View style={styles.streamingDot} />}
          </View>

          <View style={styles.keywordRow}>
            <Text style={styles.keywordText}>
              {detectedWord ? `"${detectedWord}"` : 'Waiting...'}
            </Text>
            <Text style={styles.keywordPercent}>
              {keywordConfidence ? keywordConfidence.toFixed(1) : '0.0'}%
            </Text>
          </View>

          <Text style={styles.labelMuted}>Confidence Score</Text>
          <ProgressBar
            progress={keywordConfidence ? keywordConfidence / 100 : 0}
            color={Colors.success}
            style={styles.progress}
          />
          <Text style={styles.confidenceText}>
            {keywordConfidence ? keywordConfidence.toFixed(1) : '0.0'}%
          </Text>
        </View>
      );
    }

    if (appType === 'anomaly' || appType === 'imu') {
      return (
        <View style={[styles.outputCard, styles.anomalyActive]}>
          <Text style={styles.placeholderCenter}>
            Start streaming to see model output
          </Text>
          <Text style={styles.labelMuted}>System Status</Text>

          <View style={styles.keywordRow}>
            <Text style={styles.keywordText}>{systemStatus}</Text>
            <Text style={styles.keywordPercent}>
              {anomalyScore.toFixed(1)}%
            </Text>
          </View>

          <Text style={styles.labelMuted}>Anomaly Score</Text>
          <ProgressBar
            progress={anomalyScore / 100}
            color={Colors.success}
            style={styles.progress}
          />
        </View>
      );
    }

    if (appType === 'vision') {
      return (
        <View style={[styles.outputCard, styles.keywordActive]}>
          <Text style={styles.placeholderCenter}>
            Start streaming to see model output
          </Text>
          <View style={styles.visionPreview}>
            <Box size={40} color={Colors.primary} />
            <Text style={styles.labelMuted}>Live Camera Feed</Text>
          </View>
        </View>
      );
    }

    return null;
  };
  // ─── Sensor Charts ──────────────────────────────────────────────────────────
  const renderSensors = () => {
    if (appType === 'keyword') {
      // Create empty data for the mic waveform when not streaming
      const emptyMicData = new Array(50).fill(0);

      return (
        <>
          <SectionHeader icon={<Mic size={20} />} title="Microphone" />
          <View style={[styles.chartCard, styles.dashedGrid]}>
            <LineChart
              datasets={[
                {
                  data: isStreaming ? micWave : emptyMicData,
                  color: '#3B82F6',
                },
              ]}
            />
          </View>
        </>
      );
    }

    if (appType === 'anomaly') {
      return (
        <>
          <SectionHeader icon={<Activity size={20} />} title="Accelerometer" />
          <View style={styles.chartCard}>
            <LineChart
              datasets={[
                { data: accel.x, color: '#EF4444' },
                { data: accel.y, color: '#22C55E' },
                { data: accel.z, color: '#3B82F6' },
              ]}
            />
            <View style={styles.legend}>
              {[
                { label: 'X-axis', color: '#EF4444' },
                { label: 'Y-axis', color: '#22C55E' },
                { label: 'Z-axis', color: '#3B82F6' },
              ].map(l => (
                <View key={l.label} style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: l.color }]}
                  />
                  <Text style={styles.legendLabel}>{l.label}</Text>
                </View>
              ))}
            </View>
          </View>
          <SectionHeader icon={<Accessibility size={20} />} title="Gyroscope" />
          <View style={styles.chartCard}>
            <LineChart
              datasets={[
                { data: gyro.x, color: '#EF4444' },
                { data: gyro.y, color: '#22C55E' },
                { data: gyro.z, color: '#3B82F6' },
              ]}
            />
            <View style={styles.legend}>
              {[
                { label: 'X-axis', color: '#EF4444' },
                { label: 'Y-axis', color: '#22C55E' },
                { label: 'Z-axis', color: '#3B82F6' },
              ].map(l => (
                <View key={l.label} style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: l.color }]}
                  />
                  <Text style={styles.legendLabel}>{l.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      );
    }

    if (appType === 'imu') {
      return (
        <>
          <SectionHeader icon={<Activity size={20} />} title="Accelerometer" />
          <View style={styles.chartCard}>
            <LineChart
              datasets={[
                { data: accel.x, color: '#EF4444' },
                { data: accel.y, color: '#22C55E' },
                { data: accel.z, color: '#3B82F6' },
              ]}
            />
            <View style={styles.legend}>
              {[
                { label: 'X-axis', color: '#EF4444' },
                { label: 'Y-axis', color: '#22C55E' },
                { label: 'Z-axis', color: '#3B82F6' },
              ].map(l => (
                <View key={l.label} style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: l.color }]}
                  />
                  <Text style={styles.legendLabel}>{l.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <SectionHeader icon={<Accessibility size={20} />} title="Gyroscope" />
          <View style={styles.chartCard}>
            <LineChart
              datasets={[
                { data: gyro.x, color: '#EF4444' },
                { data: gyro.y, color: '#22C55E' },
                { data: gyro.z, color: '#3B82F6' },
              ]}
            />
            <View style={styles.legend}>
              {[
                { label: 'X-axis', color: '#EF4444' },
                { label: 'Y-axis', color: '#22C55E' },
                { label: 'Z-axis', color: '#3B82F6' },
              ].map(l => (
                <View key={l.label} style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: l.color }]}
                  />
                  <Text style={styles.legendLabel}>{l.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      );
    }

    return null;
  };

  const renderDeviceInfo = () => {
    return (
      <>
        <View style={styles.deviceHeaderRow}>
          <SectionHeader icon={<Box size={20} />} title="Device Control" />

          <TouchableOpacity onPress={() => setShowDeviceInfo(!showDeviceInfo)}>
            {!showDeviceInfo && <EyeClosed size={20} color={Colors.primary} />}
            {showDeviceInfo && <Eye size={20} color={Colors.primary} />}
          </TouchableOpacity>
        </View>
        {showDeviceInfo && (
          <>
            {/* Inference Meta Information */}
            {/* <View style={styles.chartCard}>
              <Text style={styles.sectionSubTitle}>
                Inference Meta Information
              </Text>
              <InfoRow label="Model Name" value="Keyword Spotting" />
              <InfoRow label="Model Version" value="1.0.0" />
              <InfoRow label="Inference Time" value="12 ms" />
            </View> */}

            {/* Akida Core Information */}
            {/* <View style={styles.chartCard}>
              <Text style={styles.sectionSubTitle}>Akida Core Information</Text>
              <InfoRow label="Akida Version" value="2.0" />
              <InfoRow label="Neurons" value="1024" />
              <InfoRow label="Clusters" value="4" />
            </View> */}

            {/* Prediction Information */}
            {/* <View style={styles.chartCard}>
              <Text style={styles.sectionSubTitle}>Prediction Information</Text>
              <InfoRow label="Last Prediction" value={detectedWord ?? 'None'} />
              <InfoRow
                label="Confidence"
                value={`${keywordConfidence ?? 0}%`}
              />
            </View> */}

            {/* Board Metrics */}
            {/* <View style={styles.chartCard}>
              <Text style={styles.sectionSubTitle}>Board Metrics</Text>
              <InfoRow label="Temperature" value="36°C" />
              <InfoRow label="Voltage" value="3.3V" />
              <InfoRow label="Power" value="120 mW" />
            </View> */}

            {/* MCU Information */}
            {/* <View style={styles.chartCard}>
              <Text style={styles.sectionSubTitle}>MCU Information</Text>
              <InfoRow label="MCU" value="STM32" />
              <InfoRow label="Flash" value="512 KB" />
              <InfoRow label="RAM" value="128 KB" />
            </View> */}

            <View style={styles.chartCard}>
              <View style={styles.edgeLearningRow}>
                <Text style={styles.modeText}>Inference Mode</Text>

                <Switch
                  value={edgeLearningMode}
                  onValueChange={handleMode}
                  trackColor={{ false: '#ccc', true: Colors.primary }}
                  thumbColor="#fff"
                />

                <Text style={styles.modeText}>Edge Learning Mode</Text>
              </View>

              {edgeLearningMode && (
                <View style={styles.trainingButtons}>
                  <TouchableOpacity
                    style={styles.trainingBtn}
                    onPress={() => sendEdgeCmd(1)}
                  >
                    <Text style={styles.trainingBtnText}>Start Learning</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.trainingBtn}
                    onPress={() => sendEdgeCmd(3)}
                  >
                    <Text style={styles.trainingBtnText}>Next Class</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.trainingBtn,
                      { backgroundColor: Colors.error },
                    ]}
                    onPress={() => sendEdgeCmd(2)}
                  >
                    <Text style={styles.trainingBtnText}>Delete Class</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </>
        )}
      </>
    );
  };

  // ─── Streaming indicator dot (same as SettingsScreen green dot pattern) ─────
  const StreamingDot = () =>
    isStreaming ? <View style={styles.streamingDot} /> : null;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* Same top bar as SettingsScreen */}
      <DeviceHeader deviceName={deviceName} showConnectionStatus={true} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
      >
        {/* Header — same style as SettingsScreen */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={30} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Live Sensor Data</Text>
        </View>

        <View style={styles.container}>
          {/* App type row — icon + title like SettingRow */}
          <View style={styles.appRow}>
            <View style={styles.appIconBox}>{getAppIcon()}</View>
            <Text style={styles.appTitle}>{title}</Text>
          </View>

          {/* Model Output */}
          <View style={styles.modelOutputHeader}>
            <SectionHeader icon={null} title="Model Output" />
          </View>
          {renderModelOutput()}

          {/* Sensor charts */}
          {renderSensors()}

          {renderDeviceInfo()}

          {/* Event History — same card style as SettingRow */}
          <TouchableOpacity
            style={styles.eventHistoryCard}
            onPress={() => navigation.navigate('Eventhistory')}
          >
            <View style={styles.cardRow}>
              <History size={20} />
              <Text style={styles.cardTitle}>Event History</Text>
              <ChevronRight size={18} />
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Streaming button*/}
      <View
        style={[styles.container, { paddingHorizontal: 24, marginTop: 16 }]}
      >
        <View style={styles.streamingButtonWrapper}>
          {!isStreaming ? (
            <TouchableOpacity
              style={[
                styles.streamingButton,
                { backgroundColor: Colors.primary },
              ]}
              onPress={() => startStreaming(appType)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Play fill={Colors.white} size={25} />
                <Text style={[styles.streamingButtonText, { marginLeft: 8 }]}>
                  Start Streaming
                </Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.streamingButton,
                { backgroundColor: Colors.error },
              ]}
              onPress={() => stopStreaming(appType)}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Square fill={Colors.white} size={25} />
                <Text style={[styles.streamingButtonText, { marginLeft: 8 }]}>
                  Stop Streaming
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Same bottom nav as SettingsScreen */}
      <BottomNavigationBar
        activeRoute={activeRoute}
        onNavigate={route => setActiveRoute(route)}
      />
    </View>
  );
};

export default LiveSensorDataScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ─── Header (matches SettingsScreen exactly) ────────────────────────────────
  header: {
    width: '100%',
    flexDirection: 'row',
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border.light,
    gap: 16,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Sora',
    fontSize: 24,
    fontWeight: '700',
  },

  container: {
    padding: 24,
  },

  // ─── App row (icon + title like SettingRow) ──────────────────────────────────
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  appIconBox: {
    width: 44,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border.light,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: {
    fontFamily: 'Sora',
    fontSize: 18,
    fontWeight: '700',
  },

  // ─── Section headers ────────────────────────────────────────────────────────
  modelOutputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    marginTop: 16,
  },
  sectionTitle: {
    fontFamily: 'Sora',
    fontSize: 15,
    fontWeight: '700',
  },

  // ─── Streaming dot ───────────────────────────────────────────────────────────

  keywordOutputBox: {
    borderColor: '#3B82F6', // bright blue border
    backgroundColor: '#EFF6FF', // very light blue background
    borderWidth: 1,
    padding: 16,
    marginBottom: 8,
  },

  modelOutputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  confidenceText: {
    fontFamily: 'Sora',
    fontSize: 14,
    fontWeight: '700',
    color: Colors.success,
    textAlign: 'right',
    marginTop: 4,
  },

  keywordText: {
    fontFamily: 'Sora',
    fontSize: 24,
    fontWeight: '700',
    color: '#3B82F6', // blue text
  },

  keywordPercent: {
    fontFamily: 'Sora',
    fontSize: 18,
    fontWeight: '700',
    color: Colors.success, // green
  },

  labelMuted: {
    fontFamily: 'Inter',
    fontSize: 13,
    opacity: 0.6,
  },

  streamingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.success,
    marginBottom: 0,
  },

  // ─── Model output card ───────────────────────────────────────────────────────
  outputCard: {
    borderWidth: 1,
    borderColor: Colors.border.light,
    padding: 16,
    backgroundColor: Colors.white,
    marginBottom: 4,
  },
  placeholder: {
    fontFamily: 'Inter',
    opacity: 0.4,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  outputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  outputLabel: {
    fontFamily: 'Inter',
    fontSize: 13,
    opacity: 0.6,
  },
  outputValue: {
    fontFamily: 'Sora',
    fontSize: 20,
    fontWeight: '700',
  },
  outputPercent: {
    fontFamily: 'Sora',
    fontSize: 14,
    fontWeight: '700',
  },
  progress: {
    height: 6,
    marginTop: 8,
    borderRadius: 0,
  },
  visionPlaceholder: {
    alignItems: 'center',
    paddingVertical: 40,
  },

  // ─── Chart card (matches SettingRow card style) ──────────────────────────────
  chartCard: {
    borderWidth: 1,
    borderColor: Colors.border.light,
    padding: 16,
    backgroundColor: Colors.white,
    marginBottom: 8,
  },
  chartBox: {
    overflow: 'hidden',
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendLabel: {
    fontFamily: 'Inter',
    fontSize: 12,
    opacity: 0.7,
  },

  // ─── Event History card (matches SettingRow exactly) ────────────────────────
  eventHistoryCard: {
    borderWidth: 2,
    borderColor: Colors.black,
    backgroundColor: Colors.white,
    marginTop: 20,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  cardTitle: {
    fontFamily: 'Sora',
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },

  // ─── Full-width streaming button ──────────────────────────
  streamingButtonWrapper: {
    paddingHorizontal: 0,
  },
  streamingButton: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamingButtonText: {
    color: '#fff',
    fontFamily: 'Sora',
    fontSize: 16,
    fontWeight: '700',
  },
  placeholderCenter: {
    fontFamily: 'Inter',
    opacity: 0.4,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 10,
  },

  keywordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },

  keywordActive: {
    borderColor: Colors.primary,
    backgroundColor: '#EFF6FF',
  },

  anomalyActive: {
    borderColor: Colors.success,
    backgroundColor: '#F0FFF4',
  },

  dashedGrid: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    padding: 8,
  },

  visionPreview: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },

  infoLabel: {
    fontFamily: 'Inter',
    fontSize: 13,
    opacity: 0.6,
  },

  infoValue: {
    fontFamily: 'Sora',
    fontSize: 13,
    fontWeight: '600',
  },

  sectionSubTitle: {
    fontFamily: 'Sora',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  deviceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },

  edgeLearningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 10,
  },

  modeText: {
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
  },

  trainingButtons: {
    marginTop: 12,
    gap: 10,
  },

  trainingBtn: {
    height: 44,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  trainingBtnText: {
    color: Colors.white,
    fontFamily: 'Sora',
    fontWeight: '700',
  },
});
