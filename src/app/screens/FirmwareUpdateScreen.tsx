import { ChevronLeft, Cpu, Folder } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FirmwareUpdateStatus, {
  SigningKeyWarningCard,
} from '../../components/common/FirmwareUpdateStatus';
import BottomNavigationBar from '../../components/custom/BottomNavigationBar';
import DeviceHeader from '../../components/custom/DeviceHeader';
import { RouteName, ROUTES } from '../../types/routes';
import { useFirmwareUpdate } from '../hooks/useFirmwareUpdate';
import { useBleStore } from '../store/useBleStore';
import { useFirmwareStore } from '../store/useFirmwareStore';
import { Colors } from '../theme/theme';

const FirmwareUpdateScreen = ({ navigation }: any) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [activeRoute, setActiveRoute] = useState<RouteName>(ROUTES.SETTINGS);
  const { connectedDevice } = useBleStore();

  const {
    selected,
    stage,
    keyWarning,
    deviceName: updatedDeviceName,
    isBusy,
    canInstall,
    browseForFirmware,
    startUpdate,
    dismissOutcome,
  } = useFirmwareUpdate();

  const { installedBuild, setInstalledBuild } = useFirmwareStore();

  const deviceName = connectedDevice?.name ?? 'Unknown Device';

  const [showUninstallConfirm, setShowUninstallConfirm] = useState(false);
  const [showUninstallProgress, setShowUninstallProgress] = useState(false);
  const [uninstallProgress, setUninstallProgress] = useState(0);

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
                  {installedBuild.size}
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

          <FirmwareUpdateStatus
            stage={stage}
            sentVersion={selected?.version ?? null}
            deviceName={updatedDeviceName}
            onDone={dismissOutcome}
          />

          <View style={styles.actionArea}>
            <Button
              mode="contained"
              icon={({ size, color }) => <Folder size={size} color={color} />}
              onPress={browseForFirmware}
              disabled={isBusy}
            >
              Browse Local Firmware
            </Button>
          </View>

          {selected && (
            <View style={styles.card}>
              <Text style={styles.buildTitle}>{selected.name}</Text>
              <Text style={styles.subText}>
                Local firmware selected from device
              </Text>

              <Text style={styles.label}>Source</Text>

              <View style={styles.tagRow}>
                <Text style={styles.tag}>Local File</Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Text style={styles.meta}>Version: {selected.version}</Text>
                <Text style={styles.meta}>
                  Size: {(selected.sizeBytes / 1024).toFixed(2)} KB
                </Text>
              </View>

              {keyWarning ? (
                <SigningKeyWarningCard
                  fileName={selected.name}
                  onSendAnyway={startUpdate}
                  disabled={!canInstall}
                />
              ) : (
                <Button
                  mode="contained"
                  style={styles.installBtn}
                  disabled={!canInstall}
                  onPress={startUpdate}
                >
                  {isBusy ? 'Installing…' : 'Install This Build'}
                </Button>
              )}
            </View>
          )}
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

  scroll: {},
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
    color: '#000000',
  },

  back: {
    fontSize: 24,
  },

  actionArea: {
    marginBottom: 20,
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
