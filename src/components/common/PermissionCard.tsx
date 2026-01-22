import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import BrainChipTheme from '../../app/theme/theme';

interface PermissionCardProps {
  title: string;
  subtitle: string;
  Icon: any;
  required?: boolean;
}

const PermissionCard: React.FC<PermissionCardProps> = ({
  title,
  subtitle,
  Icon,
  required,
}) => {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          shadowColor: theme.colors.shadow,
          borderRadius: 1,
          borderWidth: 1,
          borderColor: theme.colors.outline,
        },
      ]}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: theme.colors.primaryContainer },
        ]}
      >
        <Icon />
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>
            {title}
          </Text>
          {required && (
            <View
              style={[styles.badge, { backgroundColor: theme.colors.error }]}
            >
              <Text style={styles.badgeText}>REQUIRED</Text>
            </View>
          )}
        </View>

        <Text
          variant="bodySmall"
          style={{
            color: theme.colors.onSurfaceVariant,
            fontSize: 13,
          }}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
};

export default PermissionCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 10,
    borderRadius: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    paddingBottom: 2,
  },
  badge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
