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
  const { parsedDeviceInfo, setParsedDeviceInfo} = useBleStore();

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

    const deviceType = manufacturerInfo.slice(5, 12);
    const deviceInfoObj = {
      deviceType: deviceType,
      firmwareVersion: `${firmwareVersion.major}.${firmwareVersion.minor}.${firmwareVersion.patch}`,
      bleVersion: `BLE ${bleVersion.major}.${bleVersion.minor}`,
    }
    setParsedDeviceInfo(deviceInfoObj)
  };


  useEffect(()=>{
    if(deviceInfo){
      parseManufacturerData(deviceInfo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- parseManufacturerData is re-created every render; the parse only needs to run when deviceInfo changes
  },[deviceInfo, setParsedDeviceInfo])

  const { deviceType, firmwareVersion, bleVersion } = parsedDeviceInfo || {
    deviceType: 'Unknown',
    firmwareVersion: 'Unknown',
    bleVersion: 'Unknown',
  };
  const macAddress = deviceId || '—';

  const spacing = width < 375 ? 12 : 16;
  const horizontalPadding = width < 375 ? 16 : 20;
  const maxWidth = width >= 768 ? 600 : width;

  // The whole screen has to fit without scrolling, so the vertical rhythm is
  // driven by the height actually left after the safe area insets. The
  // breakpoints match GetStartedScreen so the two flows compact in step.
  const availableHeight = height - insets.top - insets.bottom;
  const isCompact = availableHeight < 780;
  const isVeryCompact = availableHeight < 680;

  const verticalPadding = isVeryCompact ? 12 : isCompact ? 16 : 24;
  const blockGap = isVeryCompact ? spacing : isCompact ? spacing * 1.5 : spacing * 2;
  const iconBoxSize = isVeryCompact ? 56 : isCompact ? 72 : 88;
  const iconSize = isVeryCompact ? 30 : isCompact ? 40 : 48;
  const iconBoxGap = isVeryCompact ? 8 : isCompact ? 12 : spacing;
  const rowPaddingVertical = isVeryCompact ? 8 : isCompact ? 10 : 12;
  const noticePadding = isVeryCompact ? 10 : isCompact ? 16 : spacing * 1.25;
  const buttonGap = isVeryCompact ? 8 : isCompact ? 12 : spacing;

  const deviceDetails = [
    { label: 'Device Type', value: deviceType },
    { label: 'Firmware', value: firmwareVersion },
    { label: 'Protocol', value: bleVersion },
    { label: 'MAC Address', value: macAddress },
    { label: 'Device ID', value: serviceUUIDs![0] },
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
          paddingTop: verticalPadding,
          paddingBottom: insets.bottom + verticalPadding,
        }}
      >
        {/* CONTENT — takes the room left above the pinned buttons */}
        <View
          style={{
            flex: 1,
            justifyContent: isCompact ? 'flex-start' : 'center',
          }}
        >
          {/* TOP ICON */}
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: iconBoxSize,
                height: iconBoxSize,
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.outline,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: iconBoxGap,
              }}
            >
              <Bluetooth size={iconSize} color={theme.colors.primary} />
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
                marginTop: isVeryCompact ? 4 : 6,
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
              marginTop: blockGap,
              marginBottom: isVeryCompact ? 8 : spacing,
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
                    paddingVertical: rowPaddingVertical,
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
                    style={{ fontWeight: '600', flexShrink: 1, textAlign: 'right', marginLeft: 8 }}
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
              padding: noticePadding,
              marginTop: blockGap,
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
        <View style={{ marginTop: blockGap }}>
          <Button
            mode="contained"
            style={{ marginBottom: buttonGap }}
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
