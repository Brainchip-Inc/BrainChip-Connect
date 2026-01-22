import React from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, Surface, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface DeviceHeaderProps {
  deviceName?: string;
  showConnectionStatus?: boolean;
}

const DeviceHeader: React.FC<DeviceHeaderProps> = ({
  deviceName = 'BrainChip-AKD1000-A7F3',
  showConnectionStatus = false,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
        {/* LEFT LOGO ONLY */}
        <Image
          source={require('../../app/assets/images/00_Start/Logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {/* RIGHT DEVICE */}
        {deviceName && (
          <View style={styles.rightBlock}>
            <Text variant="labelMedium" style={{ fontWeight: '600' }}>
              {deviceName}
            </Text>

            {showConnectionStatus && (
              <View style={styles.statusRow}>
                <View style={styles.statusDot} />
                <Text
                  variant="labelSmall"
                  style={{ color: theme.colors.secondary, fontWeight: '600' }}
                >
                  Connected
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  logo: {
    width: 120,
    height: 60,
  },

  rightBlock: {
    alignItems: 'flex-end',
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
    backgroundColor: '#0BD6A5',
    marginRight: 6,
  },
});

export default DeviceHeader;
