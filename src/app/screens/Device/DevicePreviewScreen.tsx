import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bluetooth, Shield } from 'lucide-react-native';
import React, { useEffect } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
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
  const { width } = useWindowDimensions();
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
                deviceInfo,
                serviceUUIDs,
                deviceType,
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
