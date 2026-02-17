import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Button, Portal, Modal } from 'react-native-paper';
import Slider from '@react-native-community/slider';
import { Sliders, X } from 'lucide-react-native';
import { Colors } from '../../app/theme/theme';

const { width, height } = Dimensions.get('window');

const SensorConfigModal = ({ visible, onClose }: any) => {
  const [value, setValue] = useState(10);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={styles.modalContainer} // transparent container
        dismissable={true}
      >
        {/* Backdrop */}
        <View style={styles.backdrop} />

        {/* Modal content */}
        <View style={styles.modal}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Sliders size={18} />
              <View>
                <Text style={styles.title}>Sensor Configuration</Text>
                <Text style={styles.subtitle}>Adjust sampling rate</Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} />
            </TouchableOpacity>
          </View>

          {/* SAMPLING RATE HEADER */}
          <View style={styles.rateHeader}>
            <Text style={styles.rateLabel}>Sampling Rate</Text>
            <Text style={styles.rateValue}>{value} Hz</Text>
          </View>

          {/* SLIDER */}
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={100}
            step={1}
            value={value}
            onValueChange={setValue}
            minimumTrackTintColor={Colors.primary}
            maximumTrackTintColor={Colors.border.light}
            thumbTintColor={Colors.primary}
          />

          {/* RANGE */}
          <View style={styles.rangeRow}>
            <Text style={styles.rangeText}>1 Hz</Text>
            <Text style={styles.rangeText}>100 Hz</Text>
          </View>

          {/* ACTIONS */}
          <View style={styles.actions}>
            <Button mode="outlined" onPress={onClose} style={styles.cancelBtn}>
              Cancel
            </Button>

            <Button mode="contained" onPress={onClose} style={styles.saveBtn}>
              Save
            </Button>
          </View>
        </View>
      </Modal>
    </Portal>
  );
};

export default SensorConfigModal;

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent', // important: no background color here
  },

  backdrop: {
    position: 'absolute',
    width,
    height,
    backgroundColor: 'rgba(0,0,0,0.4)', // dimming overlay
    top: 0,
    left: 0,
  },

  modal: {
    backgroundColor: `${Colors.white}`,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 8,
    width: '90%',
    shadowColor: `${Colors.black}`,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
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
    marginRight: 8,
    gap: 8,
  },

  closeBtn: {
    padding: 6,
    backgroundColor: `${Colors.background}`,
    borderRadius: 4,
  },

  title: {
    fontFamily: 'Sora',
    fontSize: 16,
    fontWeight: '700',
    color: `${Colors.black}`,
  },

  subtitle: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: `${Colors.black}`,
    opacity: 0.6,
    marginTop: 2,
  },

  /* RATE */
  rateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },

  rateLabel: {
    fontFamily: 'Sora',
    fontSize: 14,
    fontWeight: '600',
    color: `${Colors.black}`,
  },

  rateValue: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '700',
    color: `${Colors.primary}`,
  },

  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },

  rangeText: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: `${Colors.black}`,
  },

  slider: {
    width: '100%',
    height: 40,
  },

  /* ACTIONS */
  actions: {
    flexDirection: 'row',
    marginTop: 20,
  },

  cancelBtn: {
    flex: 1,
    borderColor: `${Colors.border.light}`,
    marginRight: 6,
  },

  saveBtn: {
    flex: 1,
    backgroundColor: `${Colors.primary}`,
    marginLeft: 6,
  },
});
