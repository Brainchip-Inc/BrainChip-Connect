import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, useTheme, IconButton, ProgressBar } from 'react-native-paper';
import { X } from 'lucide-react-native';

interface NotificationCardProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  confidence?: number; // 0-100
  showProgress?: boolean;
  showMoreButton?: boolean;
  onSeeMore?: () => void;
  onMuteNotifications?: () => void;
  onClose?: () => void;
}

const NotificationCard: React.FC<NotificationCardProps> = ({
  icon,
  title,
  description,
  confidence,
  showProgress = false,
  showMoreButton = false,
  onSeeMore,
  onMuteNotifications,
  onClose,
}) => {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.outline,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          {icon || (
            <View
              style={[
                styles.defaultIcon,
                { backgroundColor: 'rgba(0, 97, 237, 0.1)' },
              ]}
            />
          )}
        </View>
        <View style={styles.headerText}>
          <Text variant="titleMedium" style={{ fontWeight: '600' }}>
            {title}
          </Text>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <X size={20} color={theme.colors.onSurfaceVariant} />
          </TouchableOpacity>
        )}
      </View>

      {/* Description */}
      <Text
        variant="bodyMedium"
        style={{ color: theme.colors.onSurfaceVariant, marginBottom: 12 }}
      >
        {description}
      </Text>

      {/* Confidence Progress */}
      {showProgress && confidence !== undefined && (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Confidence:
            </Text>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.primary, fontWeight: '600' }}
            >
              {confidence}%
            </Text>
          </View>
          <ProgressBar
            progress={confidence / 100}
            color={theme.colors.primary}
            style={{ height: 6, backgroundColor: 'rgba(0, 97, 237, 0.1)' }}
          />
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {showMoreButton && (
          <TouchableOpacity onPress={onSeeMore} style={styles.seeMoreButton}>
            <Text
              variant="labelMedium"
              style={{ color: theme.colors.primary, fontWeight: '600' }}
            >
              See More
            </Text>
          </TouchableOpacity>
        )}
        {onMuteNotifications && (
          <TouchableOpacity
            onPress={onMuteNotifications}
            style={styles.muteButton}
          >
            <Text
              variant="labelSmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              🔕 Mute Notifications
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    padding: 16,
    margin: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconContainer: {
    marginRight: 12,
  },
  defaultIcon: {
    width: 40,
    height: 40,
    borderRadius: 0,
  },
  headerText: {
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seeMoreButton: {
    paddingVertical: 6,
  },
  muteButton: {
    paddingVertical: 6,
  },
});

export default NotificationCard;
