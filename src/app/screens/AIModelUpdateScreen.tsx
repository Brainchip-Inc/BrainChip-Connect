import { ChevronLeft, Folder } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNavigationBar from '../../components/custom/BottomNavigationBar';
import DeviceHeader from '../../components/custom/DeviceHeader';
import ModelUpdateStatus from '../../components/common/ModelUpdateStatus';
import { RouteName, ROUTES } from '../../types/routes';
import { useBleStore } from '../store/useBleStore';
import { useBleCommandStore } from '../store/useBleCommandStore';
import { useModelUpdate } from '../hooks/useModelUpdate';
import { Colors } from '../theme/theme';

const AIModelUpdateScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();

  const [activeRoute, setActiveRoute] = useState<RouteName>(ROUTES.SETTINGS);
  const { connectedDevice } = useBleStore();

  const deviceName = connectedDevice?.name ?? 'Unknown Device';
  const appList = useBleCommandStore(state => state.appsList);
  const reportedVersion = appList[0]?.modelVersion;
  const currentVersion =
    reportedVersion && reportedVersion !== '-' ? reportedVersion : undefined;

  const {
    selected,
    stage,
    deviceName: updatedDeviceName,
    isBusy,
    browseForModel,
    startUpdate,
    stopUpdate,
    dismissOutcome,
  } = useModelUpdate();

  return (
    <View style={styles.root}>
      <DeviceHeader deviceName={deviceName} showConnectionStatus={true} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[{ paddingBottom: insets.bottom + 32 }]}
      >
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <ChevronLeft size={20} color={Colors.black} />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>Model Update</Text>
          </View>
        </View>

        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>Current Version</Text>
            <Text style={styles.version}>
              {currentVersion ? currentVersion : 'Not Found'}
            </Text>
          </View>

          <View style={styles.actionArea}>
            <Button
              mode="contained"
              icon={({ size, color }) => <Folder size={size} color={color} />}
              disabled={isBusy}
              onPress={browseForModel}
            >
              Browse Local Model
            </Button>
          </View>

          {stage.kind === 'idle' && selected && (
            <View style={[styles.card]}>
              <View style={styles.versionHeaderRow}>
                <Text style={styles.title}>Available Version</Text>
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>LOCAL</Text>
                </View>
              </View>

              <Text style={styles.newVersion}>{selected.name}</Text>
              <Text style={styles.releaseTitle}>Description</Text>
              <Text style={styles.bullet}>
                • Local model selected from device
              </Text>
              <Text style={styles.title}>
                Size: {Math.round(selected.sizeBytes / 1024)} KB
              </Text>

              <Button
                mode="contained"
                style={styles.primaryBtn}
                onPress={startUpdate}
              >
                Install Model
              </Button>
            </View>
          )}

          <ModelUpdateStatus
            stage={stage}
            deviceName={updatedDeviceName}
            onStop={stopUpdate}
            onDone={dismissOutcome}
          />
        </View>
      </ScrollView>

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

  actionArea: {
    marginBottom: 20,
    paddingTop: 10,
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
    fontSize: 20,
    fontWeight: '700',
    marginTop: 4,
  },

  versionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },

  newBadge: {
    backgroundColor: '#6B7280',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },

  newBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.5,
  },

  newVersion: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 8,
  },

  releaseTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },

  bullet: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
  },

  primaryBtn: {
    marginTop: 16,
    width: '100%',
    borderRadius: 0,
    backgroundColor: Colors.primary,
  },
});
