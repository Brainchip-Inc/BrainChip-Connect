import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Text, Button, Portal, Modal } from 'react-native-paper';
import { AlertTriangle, X } from 'lucide-react-native';
import { Colors } from '../../app/theme/theme';
import { useBleCommandStore } from '../../app/store/useBleCommandStore';

const { width, height } = Dimensions.get('window');

const FactoryResetModal = ({ visible, onCancel, onConfirm }: any) => {
  const { resetError, requestDeviceReset, setResetError } =
    useBleCommandStore();

  // Track the state for reset
  const [isResetting, setIsResetting] = useState(false);

  const handleDeviceReset = async () => {
    // Start the reset process
    setIsResetting(true); // Show loader when the reset starts
    try {
      const status = await requestDeviceReset();
      if (status) {
        onConfirm();
        setResetError('');
      } // Callback after successful reset
    } catch (error) {
      console.error('Reset failed:', error);
    } finally {
      setIsResetting(false); // Hide loader once reset is done (either success or error)
    }
  };

  const handleDismiss = () => {
    onCancel();
    setResetError(''); // Reset error state when closing the modal
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleDismiss}
        contentContainerStyle={styles.modalContainer}
        dismissable
      >
        {/* BACKDROP */}
        <View style={styles.backdrop} />

        {/* MODAL CARD */}
        <View style={styles.modal}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconBox}>
                <AlertTriangle size={20} color={Colors.error} />
              </View>
              <Text style={styles.title}>Factory Reset?</Text>
            </View>

            <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn}>
              <X size={18} />
            </TouchableOpacity>
          </View>

          {/* DESCRIPTION */}
          <Text style={styles.warningText}>
            This will erase all data and settings on the device.
          </Text>

          <Text style={styles.subText}>
            This action cannot be undone. Your device will be restored to
            factory defaults.
          </Text>

          {/* ACTIONS */}
          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={handleDismiss}
              style={styles.cancelBtn}
              disabled={isResetting} // Disable Cancel button while resetting
            >
              Cancel
            </Button>

            <Button
              mode="contained"
              onPress={handleDeviceReset}
              style={styles.resetBtn}
              disabled={isResetting} // Disable Reset button while resetting
            >
              {isResetting ? (
                <ActivityIndicator size="small" color={Colors.white} /> // Show loader while resetting
              ) : (
                'Reset Device'
              )}
            </Button>
          </View>

          {/* Show error message if there's any reset error */}
          {resetError &&
            !isResetting && ( // Only show error if reset is not ongoing
              <Text style={styles.errorText}>{resetError}</Text>
            )}
        </View>
      </Modal>
    </Portal>
  );
};

export default FactoryResetModal;
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
    borderColor: `${Colors.error}`,
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
    color: `${Colors.error}`,
  },

  /* TEXT */
  warningText: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '600',
    color: `${Colors.error}`,
    marginBottom: 8,
  },

  subText: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: `${Colors.black}`,
    opacity: 0.7,
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

  resetBtn: {
    flex: 1,
    backgroundColor: `${Colors.error}`,
    marginLeft: 8,
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
