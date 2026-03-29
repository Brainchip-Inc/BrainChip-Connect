import React from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Button, Portal, Modal } from 'react-native-paper';
import { AlertTriangle, X } from 'lucide-react-native';
import { Colors } from '../../app/theme/theme';

const { width, height } = Dimensions.get('window');

const UnpairDeviceModal = ({ visible, onCancel, onConfirm }: any) => {
  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onCancel}
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
              <Text style={styles.title}>Unpair Device?</Text>
            </View>

            <TouchableOpacity onPress={onCancel} style={styles.closeBtn}>
              <X size={18} />
            </TouchableOpacity>
          </View>

          {/* DESCRIPTION */}
          <Text style={styles.subText}>
            This will disconnect your device and return you to the welcome
            screen. You'll need to pair again to reconnect.
          </Text>

          {/* ACTIONS */}
          <View style={styles.actions}>
            <Button mode="outlined" onPress={onCancel} style={styles.cancelBtn}>
              Cancel
            </Button>

            <Button
              mode="contained"
              onPress={onConfirm}
              style={styles.resetBtn}
            >
              Unpair
            </Button>
          </View>
        </View>
      </Modal>
    </Portal>
  );
};

export default UnpairDeviceModal;
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
});
