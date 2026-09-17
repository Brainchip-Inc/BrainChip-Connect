import { useNavigation, useRoute } from '@react-navigation/native';
import {
  Accessibility,
  Activity,
  AlertTriangle,
  Box,
  Camera,
  ChevronLeft,
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
import {
  Button,
  ProgressBar,
  Switch,
  Text,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline } from 'react-native-svg';
import CameraPreview from '../../components/common/CameraPreview';
import AppControlsSection from '../../components/custom/AppControlsSection';
import BottomNavigationBar from '../../components/custom/BottomNavigationBar';
import DeviceHeader from '../../components/custom/DeviceHeader';
import BleService from '../../services/ble/bleManager';
import { RouteName, ROUTES } from '../../types/routes';
import { nameForDevice, useBleStore } from '../store/useBleStore';
import { AppType, useLiveSensorStore } from '../store/useLiveSensorStore';
import { Colors } from '../theme/theme';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootParamList } from '../../../App';
import { useBleCommandStore } from '../store/useBleCommandStore';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = SCREEN_WIDTH - 40 - 32; // margins (20*2) + card padding
const CHART_HEIGHT = 120;

// Fall detection tab: once a "fall" label is reported, keep the alert banner
// up for this long even.
const FALL_ALERT_HOLD_MS = 30000;

/** How the two classes the human detection model scores read on screen. */
const VISION_DETECTION_WORDING: Record<string, string> = {
  person: 'Person detected',
  no_person: 'No person detected',
};

/**
 * Put a vision detection label into words.
 *
 * @param label - The class label the board reported.
 */
const describeVisionDetection = (label: string): string =>
  VISION_DETECTION_WORDING[label] ?? `"${label}" detected`;

/**
 * Say whether a detection label is a real result rather than the store's
 * placeholder from before the first one arrived.
 *
 * @param label - What the store holds as the latest detection.
 */
const isDetectionLabel = (label: string | undefined): label is string =>
  label !== undefined && !label.startsWith('Waiting');

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

// ─── Line Chart ───────────────────────────────────────────────────────────────
type ChartData = ArrayLike<number>;

// Straight-forward rescale used for the sensor (accel/gyro) charts — assumes a
// small, already-normalized value range and maps evenly across the chart width.
const legacyPoints = (data: ChartData) => {
  const len = data.length;
  if (len < 2) return '';
  const max = 5000;
  const min = 0;
  const range = max - min || 1;
  const out: string[] = [];
  for (let i = 0; i < len; i++) {
    const x = (i / (len - 1)) * CHART_WIDTH;
    const y = CHART_HEIGHT - ((data[i] - min) / range) * CHART_HEIGHT;
    out.push(`${x},${y}`);
  }
  return out.join(' ');
};

// PCM path: dynamic y-range (clamped to a ±2000 minimum span so silence doesn't
// produce a nervous autoscale) with per-pixel min/max downsampling so the
// polyline point count stays bounded even at 2048 samples.
const pcmPoints = (data: ChartData) => {
  const len = data.length;
  if (len < 2) return '';

  let dMin = Infinity;
  let dMax = -Infinity;
  for (let i = 0; i < len; i++) {
    const v = data[i];
    if (v < dMin) dMin = v;
    if (v > dMax) dMax = v;
  }
  const MIN_SPAN = 2000;
  const yTop = Math.max(dMax, MIN_SPAN);
  const yBot = Math.min(dMin, -MIN_SPAN);
  const yRange = yTop - yBot || 1;

  const pixels = Math.max(2, Math.floor(CHART_WIDTH));
  const points: string[] = [];
  for (let p = 0; p < pixels; p++) {
    const startIdx = Math.floor((p / pixels) * len);
    const endIdx = Math.min(len, Math.floor(((p + 1) / pixels) * len));
    if (startIdx >= endIdx) continue;

    let min = Infinity;
    let max = -Infinity;
    for (let i = startIdx; i < endIdx; i++) {
      const v = data[i];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const yMaxPx = CHART_HEIGHT - ((max - yBot) / yRange) * CHART_HEIGHT;
    const yMinPx = CHART_HEIGHT - ((min - yBot) / yRange) * CHART_HEIGHT;
    // Alternate top/bottom per column → zigzag envelope.
    points.push(`${p},${yMaxPx}`, `${p},${yMinPx}`);
  }
  return points.join(' ');
};

const LineChart = ({
  datasets,
  pcm = false,
}: {
  datasets: { data: ChartData; color: string }[];
  pcm?: boolean;
}) => {
  const toPoints = pcm ? pcmPoints : legacyPoints;
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
  const boardName = nameForDevice(connectedDevice);

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
  // Read PCM samples directly from the BLE command store so the chart updates
  // at the ~16 fps cadence the firmware sends, instead of the 1 Hz simulator.
  const micWave = useBleCommandStore(s => s.micWave);
  // Vision results and preview frames come straight from the BLE command store
  // for the same reason: the board scores many frames a second, and the 1 Hz
  // simulator tick would show a detection long after the camera moved on.
  const cameraPreview = useBleCommandStore(s => s.cameraPreview);
  const latestDetection = useBleCommandStore(s => s.latestDetection);
  const latestConfidence = useBleCommandStore(s => s.confidence);
  const [edgeLearningMode, setEdgeLearningMode] = useState(false);

  const activeApp = useBleCommandStore(state => state.activeApp);
  const isInferenceRunning = useBleCommandStore(s => s.isInferenceRunning);
  const appTransition = useBleCommandStore(s => s.appTransition);
  const deployApp = useBleCommandStore(s => s.deployApp);
  const stopApp = useBleCommandStore(s => s.stopApp);
  const isTogglingInference = appTransition !== null;
  
  // Fall detection uses the BLE command store directly,
  // This gives us the latest detection and confidence immediately,
  // instead of waiting for the sensor data polling to update once per second.
  const liveDetectionConfidence = useBleCommandStore(s => s.confidence);
  const receivedAt = useBleCommandStore(s => s.receivedAt);

  // Fall detection state is derived directly from the BLE store instead of
  // keeping a separate local flag. This prevents stale fall alerts when the
  // app is stopped or restarted. The store resets receivedAt when detection
  // stops, so isFallHeld automatically becomes false. This keeps the UI in
  // sync with the actual detection state in the store.
  const liveWord = (latestDetection ?? '').toLowerCase().trim();
  const isFallHeld =
    liveWord === 'fall' &&
    receivedAt !== null &&
    Date.now() - receivedAt.getTime() < FALL_ALERT_HOLD_MS;

  // Re-check the fall alert when its hold time expires.
  // Without this timer, the UI may continue showing "Fall Detected"
  // until another state update causes a re-render. This ensures it
  // automatically changes back to "Detecting…" when the hold time ends.
  const [, forceFallHoldRecheck] = useState(0);
  useEffect(() => {
    if (!receivedAt) return;
    const msRemaining = receivedAt.getTime() + FALL_ALERT_HOLD_MS - Date.now();
    if (msRemaining <= 0) {
      forceFallHoldRecheck(n => n + 1);
      return;
    }
    const timer = setTimeout(() => forceFallHoldRecheck(n => n + 1), msRemaining + 50);
    return () => clearTimeout(timer);
  }, [receivedAt]);

  const handleToggleInference = async () => {
    if (isTogglingInference) return;
    try {
      if (isInferenceRunning) {
        await stopApp(appType);
      } else {
        await deployApp(appType);
      }
    } catch (err) {
      Alert.alert(
        isInferenceRunning ? 'Stop Inference Failed' : 'Start Inference Failed',
        err instanceof Error ? err.message : 'Unknown error',
      );
    }
  };

  const inferenceButtonLabel = () => {
    if (appTransition?.kind === 'starting') return 'Starting…';
    if (appTransition?.kind === 'stopping') return 'Stopping…';
    return isInferenceRunning ? 'Stop Inference' : 'Start Inference';
  };

  useEffect(() => {
    const interval = setInterval(() => {
      simulateData();
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- simulateData is re-created every render, so adding it would restart the 1s tick on each one
  }, [activeApp]);

  useEffect(() => {
    const sub = BleService.subscribeToEdgeLearningAck(deviceId, ack => {
      if (ack === BleService.getAckEdgeMode()) {
        Alert.alert('Completed', 'Edge Learning is completed');
      }
      if (ack === BleService.getAckEdgeStartMode()) {
        Alert.alert(
          'Ready to Speak',
          'Edge Learning Mode is active. Please start speaking now.',
        );
      }
    });

    return () => sub.remove();
  }, [deviceId]);

  const sendEdgeCmd = async (value: number) => {
    try {
      if (__DEV__) console.log('Sending EDGE command:', value);

      await BleService.sendEdgeCommand(deviceId, value);
    } catch (err) {
      if (__DEV__) console.error('Edge command error', err);

      Alert.alert('Command Failed', 'Unable to send command to the device.');
    }
    if (value === 2 || value === 3)
      Alert.alert('Command Send', 'Command Send successfully');
  };

  const handleMode = () => {
    const newMode = !edgeLearningMode;
    sendEdgeCmd(0); // Switch to inference or edge learning mode
    setEdgeLearningMode(newMode);
  };

  // ─── Detection Card ─────────────────────────────────────────────────────────
  const renderModelOutput = () => {
    if (appType === 'keyword') {
      return (
        <View
          style={[
            styles.detectionBlock,
            styles.detectionBlockTint,
            { borderColor: theme.colors.primary },
          ]}
        >
          {detectedWord && detectedWord !== 'Waiting...' ? (
            <View style={styles.detectionRow}>
              <Text
                style={[styles.detectionValue, { color: theme.colors.primary }]}
              >
                "{detectedWord}" detected
              </Text>
              <Text
                style={[
                  styles.detectionPercent,
                  { color: theme.colors.secondary },
                ]}
              >
                {keywordConfidence ? keywordConfidence.toFixed(1) : '0.0'}%
                Confidence
              </Text>
            </View>
          ) : (
            <Text
              style={[
                styles.detectionValue,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              No keyword detected
            </Text>
          )}
        </View>
      );
    }

    if (appType === 'imu') {
      // Fall detection states:
      // - No fall detected yet -> "Detecting…"
      // - Fall detected -> show "⚠ Fall Detected" with confidence
      // - Keep the fall alert visible for FALL_ALERT_HOLD_MS
      // - A new fall detection updates the confidence and restarts the timer
      // - When the timer expires, go back to "Detecting…"

      const isFallDetected = isFallHeld;
      const displayedConfidence = liveDetectionConfidence;

      return (
        <View
          style={[
            styles.detectionBlock,
            {
              borderColor: isFallDetected
                ? theme.colors.error
                : theme.colors.primary,
              backgroundColor: isFallDetected
                ? 'rgba(239,68,68,0.08)'
                : 'rgba(34,197,94,0.05)',
            },
          ]}
        >
          <View style={styles.detectionRow}>
            <Text
              style={[
                styles.detectionValue,
                { color: isFallDetected ? theme.colors.error : Colors.success },
              ]}
            >
              {isFallDetected ? '⚠ Fall Detected' : 'Detecting…'}
            </Text>
            {isFallDetected && (
              <Text
                style={[
                  styles.detectionPercent,
                  { color: theme.colors.secondary },
                ]}
              >
                {displayedConfidence ? displayedConfidence.toFixed(1) : '0.0'}%
                Confidence
              </Text>
            )}
          </View>
        </View>
      );
    }

    if (appType === 'anomaly') {
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
        <View
          style={[
            styles.detectionBlock,
            styles.detectionBlockTint,
            { borderColor: theme.colors.primary },
          ]}
        >
          {isDetectionLabel(latestDetection) ? (
            <View style={styles.detectionRow}>
              <Text
                style={[styles.detectionValue, { color: theme.colors.primary }]}
              >
                {describeVisionDetection(latestDetection)}
              </Text>
              <Text
                style={[
                  styles.detectionPercent,
                  { color: theme.colors.secondary },
                ]}
              >
                {(latestConfidence ?? 0).toFixed(1)}% Confidence
              </Text>
            </View>
          ) : (
            <Text
              style={[
                styles.detectionValue,
                { color: theme.colors.onSurfaceVariant },
              ]}
            >
              No frame scored yet
            </Text>
          )}
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
              pcm
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

    if (appType === 'vision') {
      return (
        <>
          <SectionHeader icon={<Camera size={20} />} title="Camera" />
          <View style={styles.chartCard}>
            <CameraPreview
              frame={cameraPreview}
              streaming={isStreaming}
              deviceName={boardName}
              maxWidth={CHART_WIDTH}
            />
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

  const renderEdgeLearning = () => {
    return (
      <>
        <View style={styles.edgeHeaderRow}>
          <SectionHeader icon={<Box size={20} />} title="Edge Learning" />
          <Switch
            value={edgeLearningMode}
            onValueChange={handleMode}
            trackColor={{ false: '#ccc', true: Colors.primary }}
            thumbColor="#fff"
          />
        </View>
        {edgeLearningMode && (
          <View style={styles.trainingButtons}>
            <Button mode="contained" onPress={() => sendEdgeCmd(1)}>
              Start Learning
            </Button>
            <Button mode="contained" onPress={() => sendEdgeCmd(3)}>
              Next Class
            </Button>
            <Button
              mode="contained"
              buttonColor={Colors.error}
              onPress={() => sendEdgeCmd(2)}
            >
              Delete Class
            </Button>
          </View>
        )}
      </>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* Same top bar as SettingsScreen */}
      <DeviceHeader deviceName={deviceName} showConnectionStatus={true} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* Header — same style as SettingsScreen */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Application Dashboard</Text>
        </View>

        <View style={styles.container}>
          <View style={styles.subtitleRow}>
            {appType === 'keyword' ? (
              <Mic size={22} />
            ) : appType === 'imu' ? (
              <AlertTriangle size={22} />
            ) : appType === 'vision' ? (
              <Box size={22} />
            ) : (
              <Activity size={22} />
            )}
            <Text style={styles.subtitleText}>{title}</Text>
          </View>

          {/* Detection */}
          <View style={styles.modelOutputHeader}>
            <SectionHeader icon={null} title="Detection" />
          </View>
          {renderModelOutput()}

          {renderEdgeLearning()}

          {/* Sensor charts */}
          {renderSensors()}

          <Button
            mode="contained"
            buttonColor={isInferenceRunning ? Colors.error : undefined}
            onPress={handleToggleInference}
            loading={isTogglingInference}
            disabled={isTogglingInference}
            icon={() =>
              isInferenceRunning ? (
                <Square fill={Colors.white} size={16} color={Colors.white} />
              ) : (
                <Play fill={Colors.white} size={16} color={Colors.white} />
              )
            }
            style={{ marginTop: 12 }}
          >
            {inferenceButtonLabel()}
          </Button>

          <Button
            mode="outlined"
            onPress={() =>
              isStreaming ? stopStreaming(appType) : startStreaming(appType)
            }
            icon={() =>
              isStreaming ? (
                <Square size={16} color={Colors.primary} />
              ) : (
                <Play size={16} color={Colors.primary} />
              )
            }
            style={{ marginTop: 8 }}
          >
            {isStreaming ? 'Stop Streaming' : 'Start Streaming'}
          </Button>

          <AppControlsSection appType={appType} />
        </View>
      </ScrollView>

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
    flexDirection: 'row',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Sora',
    fontSize: 20,
    fontWeight: '700',
  },

  container: {
    paddingHorizontal: 20,
  },

  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  subtitleText: {
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

  detectionBlock: {
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  detectionBlockTint: {
    backgroundColor: 'rgba(0,97,237,0.05)',
  },
  detectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detectionValue: { fontSize: 12, fontWeight: '600' },
  detectionPercent: { fontSize: 12, fontWeight: '600' },

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

  // ─── Detection output card (anomaly / imu / vision branches) ────────────────
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

  edgeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },

  trainingButtons: {
    marginTop: 12,
    gap: 10,
  },
});
