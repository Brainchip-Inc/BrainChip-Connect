import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  TextInput,
} from 'react-native';
import { Text, Portal, Modal } from 'react-native-paper';
import { Bluetooth, Pencil, X } from 'lucide-react-native';
import { Colors } from '../../app/theme/theme';
import { useAboutStore } from '../../app/store/useAboutStore';

const { width, height } = Dimensions.get('window');

interface DeviceInfoModalProps {
  visible: boolean;
  onClose: () => void;
  deviceName: string;
}

const DeviceInfoModal: React.FC<DeviceInfoModalProps> = ({
  visible,
  onClose,
  deviceName,
}) => {
  const [editedName, setEditedName] = useState(deviceName);
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const { sections } = useAboutStore();

  // Reset state when modal visibility changes
  useEffect(() => {
    if (visible) {
      setEditedName(deviceName);
      setIsEditing(false);
    }
  }, [visible, deviceName]);

  const handleEditPress = () => {
    setIsEditing(true);
    // Focus the input after the re-render
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  // Get hardware section from about store
  const hardwareSection = sections.find(s => s.id === 'hardware');

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
              <Bluetooth size={18} color={Colors.primary} />
              <View>
                <Text style={styles.title}>Device Information</Text>
                <Text style={styles.subtitle}>
                  View and manage device details
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={18} />
            </TouchableOpacity>
          </View>

          {/* DEVICE NAME */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Device Name</Text>
            <View style={styles.nameInputWrapper}>
              <TextInput
                ref={inputRef}
                style={styles.nameInput}
                value={editedName}
                onChangeText={setEditedName}
                editable={isEditing}
                onBlur={() => setIsEditing(false)}
                placeholder="Enter device name"
                placeholderTextColor="rgba(0,0,0,0.4)"
              />
              <TouchableOpacity
                onPress={handleEditPress}
                style={styles.editBtn}
                activeOpacity={0.7}
              >
                <Pencil size={16} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* HARDWARE DETAILS */}
          {hardwareSection && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Device Hardware</Text>
              <View style={styles.hardwareCard}>
                {hardwareSection.items.map((item, index) => {
                  if (item.type === 'kv') {
                    return (
                      <View key={index} style={styles.hardwareRow}>
                        <Text style={styles.hardwareLabel} numberOfLines={1}>
                          {item.label}
                        </Text>
                        <Text
                          style={styles.hardwareValue}
                          numberOfLines={1}
                          adjustsFontSizeToFit
                          minimumFontScale={0.75}
                        >
                          {item.value}
                        </Text>
                      </View>
                    );
                  }
                  return null;
                })}
              </View>
            </View>
          )}
        </View>
      </Modal>
    </Portal>
  );
};

export default DeviceInfoModal;

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

  section: {
    marginBottom: 16,
  },

  sectionLabel: {
    fontFamily: 'Sora',
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(0,0,0,0.6)',
    marginBottom: 8,
  },

  nameInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border.light,
    backgroundColor: Colors.white,
  },

  nameInput: {
    flex: 1,
    padding: 12,
    fontFamily: 'Inter',
    fontSize: 14,
    color: Colors.black,
  },

  editBtn: {
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  hardwareCard: {
    borderWidth: 1,
    borderColor: Colors.border.light,
    backgroundColor: Colors.white,
  },

  hardwareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },

  hardwareLabel: {
    fontFamily: 'Sora',
    fontSize: 13,
    fontWeight: '600',
    color: Colors.black,
    width: 110,
    marginRight: 8,
  },

  hardwareValue: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: 'rgba(0,0,0,0.7)',
    flex: 1,
    textAlign: 'right',
  },
});
