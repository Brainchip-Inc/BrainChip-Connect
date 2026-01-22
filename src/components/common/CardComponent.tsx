import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

interface CardProps {
  title: string;
  subtitle: string;
  Icon: React.ReactNode;
}

const CardComponent: React.FC<CardProps> = ({ title, subtitle, Icon }) => {
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
      {/* Icon Container */}
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: theme.colors.primaryContainer },
        ]}
      >
        {Icon}
      </View>

      {/* Text Content */}
      <View style={styles.textContainer}>
        <Text
          variant="titleMedium"
          style={{ fontWeight: '600', marginBottom: 2 }}
        >
          {title}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
};

export default CardComponent;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  textContainer: {
    flex: 1,
  },
});
