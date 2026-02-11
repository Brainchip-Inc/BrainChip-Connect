import React from 'react';
import { View, ScrollView, useWindowDimensions } from 'react-native';
import { Text, Button, useTheme, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bluetooth, Shield } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootParamList } from '../../../../App';

type DevicePreviewRouteProp = RouteProp<RootParamList, 'DevicePreview'>;

const DevicePreviewScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootParamList>>();
  const route = useRoute<DevicePreviewRouteProp>();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const {
    deviceId,
    deviceName,
    rssi,
    deviceInfo, // 👈 optional future object
  } = route.params as any;

  // Fallback-safe values
  const deviceType = deviceInfo?.type || deviceName;
  const firmware = deviceInfo?.firmware || '—';
  const protocol = deviceInfo?.protocol || 'BLE';
  const macAddress = deviceId || '—';

  const spacing = width < 375 ? 12 : 16;
  const horizontalPadding = width < 375 ? 16 : 20;
  const maxWidth = width >= 768 ? 600 : width;

  const deviceDetails = [
    { label: 'Device Type', value: deviceType },
    { label: 'Firmware', value: firmware },
    { label: 'Protocol', value: protocol },
    { label: 'MAC Address', value: macAddress },
  ];

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: spacing * 2,
          paddingBottom: insets.bottom + spacing * 2,
          alignItems: 'center',
        }}
      >
        <View style={{ width: '100%', maxWidth }}>
          {/* TOP ICON */}
          <View style={{ alignItems: 'center', marginBottom: spacing * 2 }}>
            <View
              style={{
                width: 100,
                height: 100,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.outline,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: spacing,
              }}
            >
              <Bluetooth size={56} color={theme.colors.primary} />
            </View>

            <Text
              variant="headlineMedium"
              style={{ fontWeight: '700', textAlign: 'center' }}
            >
              {deviceName}
            </Text>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 6,
              }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: theme.colors.secondary,
                  marginRight: 6,
                }}
              />
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Ready to connect
              </Text>
            </View>
          </View>

          {/* DEVICE INFO */}
          <Text
            variant="titleMedium"
            style={{ fontWeight: '600', marginBottom: spacing }}
          >
            Device Information
          </Text>

          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.outline,
              marginBottom: spacing * 2,
            }}
          >
            {deviceDetails.map((item, index) => (
              <View key={item.label}>
                <View
                  style={{
                    padding: spacing,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text
                    variant="bodySmall"
                    style={{ color: theme.colors.onSurfaceVariant }}
                  >
                    {item.label}
                  </Text>
                  <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                    {item.value}
                  </Text>
                </View>
                {index < deviceDetails.length - 1 && <Divider />}
              </View>
            ))}
          </View>

          {/* SECURE CONNECTION — theme matched */}
          <View
            style={{
              backgroundColor: 'rgba(0,97,237,0.05)',
              borderWidth: 1,
              borderColor: 'rgba(0,97,237,0.2)',
              padding: spacing * 1.25,
              marginBottom: spacing * 2,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Shield size={20} color={theme.colors.primary} />
            <View style={{ marginLeft: spacing }}>
              <Text variant="labelMedium" style={{ fontWeight: '600' }}>
                Secure Connection
              </Text>
              <Text
                variant="bodySmall"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                Communication is encrypted using BLE pairing
              </Text>
            </View>
          </View>

          {/* BUTTONS */}
          <Button
            mode="contained"
            style={{ marginBottom: spacing }}
            onPress={() =>
              navigation.navigate('DeviceConnecting', {
                deviceId,
                deviceName,
                rssi,
              })
            }
          >
            Connect to Device
          </Button>

          <Button mode="outlined" onPress={() => navigation.goBack()}>
            Back
          </Button>
        </View>
      </ScrollView>
    </View>
  );
};

export default DevicePreviewScreen;
