import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Text, Button, Portal, Modal, RadioButton } from 'react-native-paper';
import { Zap, X } from 'lucide-react-native';
import { Colors } from '../../app/theme/theme';

const { width, height } = Dimensions.get('window');

const PowerModeModal = ({ visible, onClose }: any) => {
  const [value, setValue] = useState('balanced');

  const Option = ({
    label,
    description,
    optionValue,
  }: {
    label: string;
    description: string;
    optionValue: string;
  }) => {
    const selected = value === optionValue;

    return (
      <TouchableOpacity
        style={[styles.option, selected && styles.optionActive]}
        onPress={() => setValue(optionValue)}
        activeOpacity={0.8}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.optionTitle}>{label}</Text>
          <Text style={styles.optionSub}>{description}</Text>
        </View>

        <RadioButton
          value={optionValue}
          status={selected ? 'checked' : 'unchecked'}
          color={Colors.primary}
        />
      </TouchableOpacity>
    );
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onClose}
        contentContainerStyle={styles.modalContainer}
        dismissable={true}
      >
        {/* Backdrop */}
        <View style={styles.backdrop} />

        {/* Modal content */}
        <View style={styles.modal}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Zap size={18} />
              <View>
                <Text style={styles.title}>Power Mode</Text>
                <Text style={styles.subtitle}>
                  Optimize for performance or battery
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} />
            </TouchableOpacity>
          </View>

          {/* OPTIONS */}
          <Option
            label="Performance"
            description="Max speed, higher power"
            optionValue="performance"
          />
          <Option
            label="Balanced"
            description="Optimal balance"
            optionValue="balanced"
          />
          <Option
            label="Power Save"
            description="Extended battery life"
            optionValue="save"
          />

          {/* ACTION */}
          <Button mode="contained" onPress={onClose} style={styles.saveBtn}>
            Save
          </Button>
        </View>
      </Modal>
    </Portal>
  );
};

export default PowerModeModal;

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent', // important: keep transparent
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
    borderRadius: 0,
    width: '90%',
    elevation: 5,
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

  /* OPTIONS */
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${Colors.border.light}`,
    padding: 16,
    marginBottom: 12,
  },

  optionActive: {
    borderColor: `${Colors.primary}`,
    borderWidth: 2,
  },

  optionTitle: {
    fontFamily: 'Sora',
    fontSize: 14,
    fontWeight: '600',
    color: `${Colors.black}`,
  },

  optionSub: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: `${Colors.black}`,
    opacity: 0.6,
    marginTop: 2,
  },

  /* ACTION */
  saveBtn: {
    marginTop: 8,
    backgroundColor: `${Colors.primary}`,
  },
});
