import React from 'react';
import { View, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Text, Surface, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootParamList } from '../../../App';
import { useBleStore } from '../../app/store/useBleStore';

interface DeviceHeaderProps {
  deviceName?: string;
  showConnectionStatus?: boolean;
  onDeviceInfoPress?: () => void;
}

const DeviceHeader: React.FC<DeviceHeaderProps> = ({
  deviceName = 'Unknown Device',
  showConnectionStatus = false,
  onDeviceInfoPress,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootParamList>>();
  const { connectedDevice } = useBleStore();
  const currentRouteName = useNavigationState(
    state => state.routes[state.index]?.name,
  );

  const handleLogoPress = () => {
    if (currentRouteName !== 'DeviceApplications') {
      navigation.navigate('DeviceApplications', {
        deviceId: connectedDevice?.id ?? '',
        deviceName: connectedDevice?.name ?? 'Unknown Device',
        rssi: connectedDevice?.rssi ?? null,
      });
    }
  };

  return (
    <Surface
      elevation={0}
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,
          backgroundColor: theme.colors.surface,
          borderBottomColor: theme.colors.outline,
        },
      ]}
    >
      <View style={styles.row}>
        {/* LEFT: BRAINCHIP LOGO + CONNECT */}
        <TouchableOpacity onPress={handleLogoPress} activeOpacity={0.7}>
          <View style={styles.logoBlock}>
            <Image
              source={require('../../app/assets/images/00_Start/BrainChipLogo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text
              style={[styles.connectText, { color: theme.colors.primary }]}
            >
              Connect
            </Text>
          </View>
        </TouchableOpacity>

        {/* RIGHT: DEVICE NAME + STATUS */}
        {deviceName && (
          <TouchableOpacity
            onPress={onDeviceInfoPress}
            activeOpacity={onDeviceInfoPress ? 0.7 : 1}
            disabled={!onDeviceInfoPress}
          >
            <View style={styles.rightBlock}>
              <Text variant="labelMedium" style={{ fontWeight: '600' }}>
                {deviceName}
              </Text>

              {showConnectionStatus && (
                <View style={styles.statusRow}>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: theme.colors.secondary },
                    ]}
                  />
                  <Text
                    variant="labelSmall"
                    style={{ color: theme.colors.secondary, fontWeight: '600' }}
                  >
                    Connected
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 10,
    borderBottomWidth: 1,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
  },

  logoBlock: {
    alignItems: 'flex-start',
  },

  logo: {
    width: 120,
    height: 32,
  },

  connectText: {
    fontFamily: 'Sora-Bold',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },

  rightBlock: {
    alignItems: 'flex-end',
    paddingBottom: 2,
  },

  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
});

export default DeviceHeader;
