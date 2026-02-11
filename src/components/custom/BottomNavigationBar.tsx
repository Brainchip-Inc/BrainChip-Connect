import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Bell, Settings, User } from 'lucide-react-native';

interface BottomNavigationProps {
  activeRoute?: 'Home' | 'Notifications' | 'Settings' | 'Profile';
  onNavigate?: (
    route: 'Home' | 'Notifications' | 'Settings' | 'Profile',
  ) => void;
  notificationCount?: number;
}

const BottomNavigationBar: React.FC<BottomNavigationProps> = ({
  activeRoute = 'Home',
  onNavigate,
  notificationCount = 0,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const tabs = [
    { name: 'Home', icon: Home, label: 'Home' },
    { name: 'Notifications', icon: Bell, label: 'Notifications' },
    { name: 'Settings', icon: Settings, label: 'Settings' },
    { name: 'Profile', icon: User, label: 'Profile' },
  ] as const;

  const handlePress = (route: (typeof tabs)[number]['name']) => {
    onNavigate?.(route);
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.outline,
          paddingBottom: insets.bottom || 8,
        },
      ]}
    >
      {tabs.map(tab => {
        const isActive = activeRoute === tab.name;
        const Icon = tab.icon;
        const showBadge = tab.name === 'Notifications' && notificationCount > 0;

        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => handlePress(tab.name)}
            activeOpacity={0.7}
          >
            <View style={styles.iconWrapper}>
              <Icon
                size={24}
                color={
                  isActive
                    ? theme.colors.primary
                    : theme.colors.onSurfaceVariant
                }
                strokeWidth={isActive ? 2 : 1.5}
              />
              {showBadge && (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: theme.colors.error },
                  ]}
                >
                  <Text variant="labelSmall" style={styles.badgeText}>
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </Text>
                </View>
              )}
            </View>
            <Text
              variant="labelSmall"
              style={{
                color: isActive
                  ? theme.colors.primary
                  : theme.colors.onSurfaceVariant,
                fontWeight: isActive ? '600' : '400',
                marginTop: 4,
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  iconWrapper: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
});

export default BottomNavigationBar;
