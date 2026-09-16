import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bluetooth, Shield } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { useWindowDimensions, View } from 'react-native';
import base64 from 'react-native-base64';
import { Base64 } from 'react-native-ble-plx';
import { Button, Divider, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootParamList } from '../../../../App';
import { useBleStore } from '../../store/useBleStore';

type DevicePreviewRouteProp = RouteProp<RootParamList, 'DevicePreview'>;

const DevicePreviewScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootParamList>>();
  const route = useRoute<DevicePreviewRouteProp>();
  const { width, height } = useWindowDimensions();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { parsedDeviceInfo, setParsedDeviceInfo } = useBleStore();

  const { deviceId, deviceName, rssi, deviceInfo, serviceUUIDs } = route.params;

  const parseManufacturerData = (mfData: Base64) => {
    const manufacturerInfo = base64.decode(mfData);
    const bleVersion = {
      major: manufacturerInfo[0],
      minor: manufacturerInfo[1],
    };

    const firmwareVersion = {
      major: manufacturerInfo[2],
      minor: manufacturerInfo[3],
      patch: manufacturerInfo[4],
    };

    const aiAccelerator = manufacturerInfo.slice(5, 12);
    const deviceInfoObj = {
      aiAccelerator: aiAccelerator,
      firmwareVersion: `${firmwareVersion.major}.${firmwareVersion.minor}.${firmwareVersion.patch}`,
      bleVersion: `BLE ${bleVersion.major}.${bleVersion.minor}`,
    };
    setParsedDeviceInfo(deviceInfoObj);
  };

  useEffect(() => {
    if (deviceInfo) {
      parseManufacturerData(deviceInfo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parseManufacturerData is re-created every render; the parse only needs to run when deviceInfo changes
  }, [deviceInfo, setParsedDeviceInfo]);

  const { aiAccelerator, firmwareVersion, bleVersion } = parsedDeviceInfo || {
    aiAccelerator: 'Unknown',
    firmwareVersion: 'Unknown',
    bleVersion: 'Unknown',
  };
  const macAddress = deviceId || '—';

  const spacing = width < 375 ? 12 : 16;
  const horizontalPadding = width < 375 ? 16 : 20;
  const maxWidth = width >= 768 ? 600 : width;

  // The whole screen has to fit without scrolling, so the vertical rhythm is
  // driven by the height actually left after the safe area insets. It is
  // interpolated rather than snapped to a few breakpoints: at 480pt of usable
  // height everything is at its tightest and the content only just fits, from
  // 760pt up it is at its roomiest, and in between it scales with the screen
  // so the content keeps filling it instead of pooling the slack into one
  // large gap above the buttons.
  const availableHeight = height - insets.top - insets.bottom;
  const roominess = Math.max(0, Math.min(1, (availableHeight - 480) / 280));
  const scale = (tight: number, roomy: number) =>
    tight + (roomy - tight) * roominess;

  const metrics = {
    padding: scale(6, 24),
    iconBox: Math.round(scale(40, 88)),
    icon: Math.round(scale(22, 48)),
    iconGap: scale(4, spacing),
    blockGap: scale(8, spacing * 2),
    headerGap: scale(4, spacing),
    rowPadding: scale(5, 12),
    noticePadding: scale(8, spacing * 1.25),
    buttonGap: scale(6, spacing),
  };

  // No Device ID row: the hardware serial is no longer advertised, so nothing
  // before connecting can fill it. It appears on the device details screen
  // once the device-info burst has arrived over the connection.
  const deviceDetails = [
    // The part number the board broadcasts is the accelerator inside it, which
    // both boards share, so it is labelled for what it identifies. The board
    // itself is named by the device name above.
    { label: 'AI Accelerator', value: aiAccelerator },
    { label: 'Firmware', value: firmwareVersion },
    { label: 'Protocol', value: bleVersion },
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
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth,
          alignSelf: 'center',
          paddingHorizontal: horizontalPadding,
          paddingTop: metrics.padding,
          paddingBottom: insets.bottom + metrics.padding,
        }}
      >
        {/* CONTENT — takes the room left above the pinned buttons. Centred so
            whatever room is left over is shared above and below the
            information; top-aligned at the very tightest, where there is
            nothing left to share and losing the top would be the worst of it. */}
        <View
          style={{
            flex: 1,
            justifyContent: roominess === 0 ? 'flex-start' : 'center',
          }}
        >
          {/* TOP ICON */}
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: metrics.iconBox,
                height: metrics.iconBox,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.outline,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: metrics.iconGap,
              }}
            >
              <Bluetooth size={metrics.icon} color={theme.colors.primary} />
            </View>

            <Text
              variant="headlineMedium"
              numberOfLines={2}
              style={{ fontWeight: '700', textAlign: 'center' }}
            >
              {deviceName}
            </Text>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: scale(4, 6),
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
            style={{
              fontWeight: '600',
              marginTop: metrics.blockGap,
              marginBottom: metrics.headerGap,
            }}
          >
            Device Information
          </Text>

          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.outline,
            }}
          >
            {deviceDetails.map((item, index) => (
              <View key={item.label}>
                <View
                  style={{
                    paddingHorizontal: spacing,
                    paddingVertical: metrics.rowPadding,
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
                  <Text
                    variant="bodySmall"
                    style={{
                      fontWeight: '600',
                      flexShrink: 1,
                      textAlign: 'right',
                      marginLeft: 8,
                    }}
                  >
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
              padding: metrics.noticePadding,
              marginTop: metrics.blockGap,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Shield size={20} color={theme.colors.primary} />
            <View style={{ marginLeft: spacing, flex: 1 }}>
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
        </View>

        {/* BUTTONS — pinned to the bottom */}
        <View style={{ marginTop: metrics.blockGap }}>
          <Button
            mode="contained"
            style={{ marginBottom: metrics.buttonGap }}
            onPress={() =>
              navigation.navigate('DeviceConnecting', {
                deviceId,
                deviceName,
                rssi,
                deviceInfo,
                serviceUUIDs,
              })
            }
          >
            Connect to Device
          </Button>

          <Button mode="outlined" onPress={() => navigation.goBack()}>
            Back
          </Button>
        </View>
      </View>
    </View>
  );
};

export default DevicePreviewScreen;
