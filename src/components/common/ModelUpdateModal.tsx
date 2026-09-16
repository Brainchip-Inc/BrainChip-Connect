import { Download, Folder, X } from 'lucide-react-native';
import React, { useEffect } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Modal, Portal, Text } from 'react-native-paper';
import { useBleCommandStore } from '../../app/store/useBleCommandStore';
import { useModelUpdate } from '../../app/hooks/useModelUpdate';
import { Colors } from '../../app/theme/theme';
import ModelUpdateStatus from './ModelUpdateStatus';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ModelUpdateModalProps {
  visible: boolean;
  onClose: () => void;
}

const ModelUpdateModal: React.FC<ModelUpdateModalProps> = ({
  visible,
  onClose,
}) => {
  const appList = useBleCommandStore(state => state.appsList);
  const reportedVersion = appList[0]?.modelVersion;
  const currentVersion =
    reportedVersion && reportedVersion !== '-' ? reportedVersion : undefined;

  const {
    selected,
    stage,
    isBusy,
    browseForModel,
    startUpdate,
    stopUpdate,
    dismissOutcome,
    reset,
  } = useModelUpdate();

  useEffect(() => {
    reset();
  }, [visible, reset]);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={styles.modalContainer}
        dismissable={!isBusy}
      >
        <View style={styles.backdrop} />

        <View style={styles.modal}>
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
              disabled={isBusy}
            >
              <X
                size={18}
                color={isBusy ? Colors.text.disabled : Colors.black}
              />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={true}
            style={styles.scrollContent}
          >
            <View style={styles.card}>
              <Text style={styles.label}>Current Version</Text>
              <Text style={styles.version}>
                {currentVersion ? currentVersion : 'Not Found'}
              </Text>
            </View>

            {stage.kind === 'idle' && (
              <View style={styles.actionArea}>
                <Button
                  mode="contained"
                  icon={({ size, color }) => (
                    <Folder size={size} color={color} />
                  )}
                  onPress={browseForModel}
                  style={styles.actionBtn}
                >
                  Browse Local Model
                </Button>
              </View>
            )}

            {stage.kind === 'idle' && selected && (
              <View style={styles.card}>
                <View style={styles.buildHeaderRow}>
                  <Text style={styles.label}>Available Version</Text>
                  <View style={styles.localBadge}>
                    <Text style={styles.badgeText}>LOCAL</Text>
                  </View>
                </View>

                <Text style={styles.newVersion}>{selected.name}</Text>
                <Text style={styles.subText}>
                  Local model selected from device
                </Text>
                <Text style={styles.label}>
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
              onStop={stopUpdate}
              onDone={dismissOutcome}
            />
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
});
