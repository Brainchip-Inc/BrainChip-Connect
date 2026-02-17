import React from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Bell, Settings, User } from 'lucide-react-native';
import { RouteName, ROUTES } from '../../types/routes';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootParamList } from '../../../App';
import { useNavigation } from '@react-navigation/native';
import { useBleStore } from '../../app/store/useBleStore';

interface BottomNavigationProps {
  activeRoute?: RouteName;
  onNavigate?: (route: RouteName) => void;
  notificationCount?: number;
}

const BottomNavigationBar: React.FC<BottomNavigationProps> = ({
  activeRoute = ROUTES.HOME,
  onNavigate,
  notificationCount = 0,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootParamList>>();
  const { connectedDevice } = useBleStore();

  const tabs = [
    { name: ROUTES.HOME, icon: Home, label: 'Home' },
    { name: ROUTES.NOTIFICATIONS, icon: Bell, label: 'Notifications' },
    { name: ROUTES.SETTINGS, icon: Settings, label: 'Settings' },
    { name: ROUTES.PROFILE, icon: User, label: 'Profile' },
  ] as const;

  const handlePress = (route: RouteName) => {
    switch (route) {
      case 'Settings':
        navigation.navigate('Settings');
        break;
      case 'Notifications':
        navigation.navigate('Notifications');
        break;
      case 'Profile':
        navigation.navigate('Eventhistory'); // Temporary, need to replace in future with profile
        break;
      case 'Home':
        navigation.navigate('DeviceApplications', {
          deviceId: connectedDevice?.id ?? '',
          deviceName: connectedDevice?.name ?? 'Unknown Device',
          rssi: connectedDevice?.rssi ?? null,
        });
        break;
    }
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
        const showBadge =
          tab.name === ROUTES.NOTIFICATIONS && notificationCount > 0;

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

export default BottomNavigationBar;

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
    borderRadius: 9,
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
