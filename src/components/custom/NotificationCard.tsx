import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, ProgressBar } from 'react-native-paper';
import { X, Bell } from 'lucide-react-native';
import { Colors } from '../../app/theme/theme';

interface NotificationCardProps {
  title: string;
  description: string;
  confidence?: number;
  onSeeMore?: () => void;
  onMuteNotifications?: () => void;
  onClose?: () => void;
}

const NotificationCard: React.FC<NotificationCardProps> = ({
  title,
  description,
  confidence,
  onSeeMore,
  onMuteNotifications,
  onClose,
}) => {
  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        {/* HEADER */}
        <View style={styles.header}>
          {/* Blue Icon Box */}
          <View style={styles.iconBox}>
            <Bell size={18} color="#FFFFFF" />
          </View>

          <Text style={styles.title}>{title}</Text>

          {onClose && (
            <TouchableOpacity onPress={onClose}>
              <X size={18} color="#6B7280" />
            </TouchableOpacity>
          )}
        </View>

        {/* DETECTED TEXT */}
        <Text style={styles.detectedText}>
          Detected: <Text style={{ fontWeight: '600' }}>{description}</Text>
        </Text>

        {/* CONFIDENCE */}
        {confidence !== undefined && (
          <View style={styles.confidenceRow}>
            <Text style={styles.confidenceLabel}>Confidence:</Text>

            <View style={{ flex: 1 }}>
              <ProgressBar
                progress={confidence / 100}
                color={Colors.primary}
                style={styles.progress}
              />
            </View>

            <Text style={styles.percent}>{confidence}%</Text>
          </View>
        )}

        {/* ACTIONS */}
        <View style={styles.actions}>
          <TouchableOpacity onPress={onSeeMore}>
            <Text style={styles.seeMore}>See More</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onMuteNotifications}
            style={styles.muteRow}
          >
            <Bell size={14} color="#6B7280" />
            <Text style={styles.muteText}>Mute Notifications</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

export default NotificationCard;

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 20,
    marginTop: 20,
  },

  container: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    elevation: 6, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },

  iconBox: {
    width: 40,
    height: 40,
    backgroundColor: '#0A5ED7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },

  detectedText: {
    fontSize: 14,
    marginBottom: 12,
  },

  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },

  confidenceLabel: {
    fontSize: 13,
    color: '#6B7280',
  },

  progress: {
    height: 6,
    backgroundColor: 'rgba(0, 97, 237, 0.1)',
  },

  percent: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0A5ED7',
  },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  seeMore: {
    color: '#0A5ED7',
    fontWeight: '600',
    fontSize: 14,
  },

  muteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  muteText: {
    fontSize: 13,
    color: '#6B7280',
  },
});
