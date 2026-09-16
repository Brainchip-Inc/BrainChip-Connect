import React from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Text, Button, Portal, Modal } from 'react-native-paper';
import { Compass, X } from 'lucide-react-native';
import { Colors } from '../../app/theme/theme';
import { useBleCommandStore } from '../../app/store/useBleCommandStore';

const { width, height } = Dimensions.get('window');

// Shown once after a successful Fall Detection deploy, whenever the
// firmware reports it hasn't been calibrated since its last boot
// (calibrationRequired in useBleCommandStore, driven by the CALIBRATION_
// STATUS push -  "Start Calibration" triggers the
// same firmware flow as the `fall_calibrate` CLI command.
const CalibrationModal = ({ visible, onDismiss }: any) => {
  // calibrationInProgress lives in the store (set true/false by
  // requestCalibration() itself) - reading it here instead of keeping a
  // separate local "isCalibrating" flag avoids two states tracking the
  // same in-flight request.
  const {
    calibrationError,
    calibrationInProgress,
    requestCalibration,
    setCalibrationError,
  } = useBleCommandStore();

  const handleStartCalibration = async () => {
    try {
      const ok = await requestCalibration();
      if (ok) {
        onDismiss();
      }
    } catch (error) {
      if (__DEV__) console.error('Calibration failed:', error);
    }
  };

  const handleDismiss = () => {
    if (calibrationInProgress) return; // ignore backdrop/close taps mid-calibration
    onDismiss();
    setCalibrationError('');
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleDismiss}
        contentContainerStyle={styles.modalContainer}
        dismissable={!calibrationInProgress}
      >
        {/* BACKDROP */}
        <View style={styles.backdrop} />

        {/* MODAL CARD */}
        <View style={styles.modal}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBox}>
                <Compass size={20} color={Colors.primary} />
              </View>
              <Text style={styles.title}>IMU Calibration Required</Text>
            </View>

            <TouchableOpacity
              onPress={handleDismiss}
              style={styles.closeBtn}
              disabled={calibrationInProgress}
            >
              <X size={18} />
            </TouchableOpacity>
          </View>

          {/* DESCRIPTION */}
          <Text style={styles.subText}>
            Please place the device on a flat and stable surface and keep it
            still during calibration.
          </Text>

          {/* ACTIONS */}
          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={handleDismiss}
              style={styles.cancelBtn}
              disabled={calibrationInProgress}
            >
              Cancel
            </Button>

            <Button
              mode="contained"
              onPress={handleStartCalibration}
              style={styles.startBtn}
              disabled={calibrationInProgress}
            >
              {calibrationInProgress ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                'Start Calibration'
              )}
            </Button>
          </View>

          {calibrationInProgress && (
            <Text style={styles.hintText}>
              Calibrating… keep the device still (about 25 seconds).
            </Text>
          )}

          {calibrationError && !calibrationInProgress && (
            <Text style={styles.errorText}>{calibrationError}</Text>
          )}
        </View>
      </Modal>
    </Portal>
  );
};

export default CalibrationModal;

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },

  backdrop: {
    position: 'absolute',
    width,
    height,
    backgroundColor: 'rgba(0,0,0,0.45)',
    top: 0,
    left: 0,
  },

  modal: {
    width: '90%',
    backgroundColor: `${Colors.white}`,
    padding: 20,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: `${Colors.primary}`,
  },

  /* HEADER */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },

  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  iconBox: {
    width: 36,
    height: 36,
    backgroundColor: `${Colors.lightWhite}`,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
  },

  closeBtn: {
    padding: 6,
    backgroundColor: `${Colors.background}`,
    borderRadius: 4,
  },

  title: {
    fontFamily: 'Sora',
    fontSize: 18,
    fontWeight: '700',
    color: `${Colors.primary}`,
    flexShrink: 1,
  },

  /* TEXT */
  subText: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: `${Colors.black}`,
    opacity: 0.8,
    lineHeight: 18,
  },

  /* ACTIONS */
  actions: {
    flexDirection: 'row',
    marginTop: 24,
  },

  cancelBtn: {
    flex: 1,
    borderColor: `${Colors.border.light}`,
    marginRight: 8,
  },

  startBtn: {
    flex: 1,
    backgroundColor: `${Colors.primary}`,
    marginLeft: 8,
  },

  hintText: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: `${Colors.black}`,
    opacity: 0.6,
    marginTop: 12,
    textAlign: 'center',
  },

  errorText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    color: `${Colors.error}`,
    marginTop: 12,
    textAlign: 'center',
  },
});
