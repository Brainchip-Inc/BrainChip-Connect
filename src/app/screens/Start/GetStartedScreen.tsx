import React from 'react';
import { View, Image, StyleSheet, useWindowDimensions } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import BLE from '../../assets/images/00_Start/BLE.svg';
import AIAppControl from '../../assets/images/00_Start/AIAppControl.svg';
import OTA from '../../assets/images/00_Start/OTA.svg';
import SensorData from '../../assets/images/00_Start/SensorData.svg';
import { RootParamList } from '../../../../App';
import { getAcceptanceState } from '../../store/acceptanceStorage';
import BleService from '../../../services/ble/bleManager';

const FEATURES = [
  {
    title: 'Bluetooth Low Energy',
    subtitle: 'Wireless connectivity optimized for minimal power consumption',
    Icon: BLE,
  },
  {
    title: 'AI Application Control',
    subtitle: 'Deploy and manage neuromorphic models on device',
    Icon: AIAppControl,
  },
  {
    title: 'Real-time Sensor Data',
    subtitle: 'Stream and visualize sensor readings with low latency',
    Icon: SensorData,
  },
  {
    title: 'Over-the-Air Updates',
    subtitle: 'Seamless firmware updates without physical access',
    Icon: OTA,
  },
];

const GetStartedScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootParamList>>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const isTablet = width >= 768;
  const maxWidth = isTablet ? 600 : 382;

  // Available height after safe area insets
  const availableHeight = height - insets.top - insets.bottom;
  const isCompact = availableHeight < 780;
  const isVeryCompact = availableHeight < 680;

  // Dynamically adjust sizes based on available height
  const verticalPadding = isVeryCompact ? 12 : isCompact ? 16 : 24;
  const logoHeight = isVeryCompact ? 40 : isCompact ? 50 : 60;
  const logoWidth = isVeryCompact ? 160 : isCompact ? 200 : 229;
  const sectionGap = isVeryCompact ? 12 : isCompact ? 16 : 24;
  const cardGap = isVeryCompact ? 6 : isCompact ? 8 : 12;
  const cardVerticalPadding = isVeryCompact ? 8 : isCompact ? 10 : 14;
  const iconBoxSize = isVeryCompact ? 40 : isCompact ? 48 : 56;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#F8F8F9',
        paddingTop: insets.top + verticalPadding,
        paddingBottom: insets.bottom + verticalPadding,
        paddingHorizontal: 20,
      }}
    >
      {/* CENTERED CONTENT COLUMN */}
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth,
          alignSelf: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* LOGO + CONNECT */}
        <View style={styles.logoBlock}>
          <Image
            source={require('../../assets/images/00_Start/BrainChipLogo.png')}
            resizeMode="contain"
            style={{ width: logoWidth, height: logoHeight }}
          />
          <Text style={styles.connectText}>Connect</Text>
        </View>

        {/* TEXT */}
        <View style={[styles.textBlock, { marginTop: sectionGap }]}>
          <Text style={styles.title}>Edge AI IoT device management</Text>
          <Text style={styles.description}>
            with BLE connectivity, OTA updates, and live sensor monitoring
          </Text>
        </View>

        {/* CARDS */}
        <View style={{ marginTop: sectionGap, gap: cardGap }}>
          {FEATURES.map((item, index) => {
            const Icon = item.Icon;
            return (
              <View
                key={index}
                style={[
                  styles.card,
                  {
                    paddingTop: cardVerticalPadding,
                    paddingBottom: cardVerticalPadding,
                  },
                ]}
              >
                <View
                  style={[
                    styles.iconBox,
                    { width: iconBoxSize, height: iconBoxSize },
                  ]}
                >
                  <Icon />
                </View>

                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* BUTTON */}
        <View style={{ marginTop: sectionGap }}>
          <Button
            mode="contained"
            onPress={async () => {
              const { privacyAccepted, termsAccepted } =
                await getAcceptanceState();

              if (privacyAccepted && termsAccepted) {
                const [permissions, isBluetoothEnabled] = await Promise.all([
                  BleService.checkAllPermissions(),
                  BleService.isBluetoothEnabled(),
                ]);
                if (
                  permissions.bluetooth &&
                  permissions.location &&
                  isBluetoothEnabled
                ) {
                  navigation.navigate('DeviceDiscovery');
                } else {
                  navigation.navigate('Permissions');
                }
              } else {
                navigation.navigate('Permissions');
              }
            }}
            style={styles.button}
            labelStyle={styles.buttonLabel}
          >
            Get Started
          </Button>
        </View>
      </View>
    </View>
  );
};

export default GetStartedScreen;

const styles = StyleSheet.create({
  logoBlock: {
    alignItems: 'center',
  },

  connectText: {
    fontFamily: 'Sora-Bold',
    fontSize: 15,
    fontWeight: '600',
    color: '#0061ED',
    marginTop: 2,
  },

  textBlock: {
    alignItems: 'center',
  },

  title: {
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'center',
    color: '#000',
  },

  description: {
    fontFamily: 'Inter',
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    textAlign: 'center',
    color: '#000',
    maxWidth: 275,
    width: '100%',
    marginTop: 4,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },

  iconBox: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  cardText: {
    flex: 1,
    gap: 2,
  },

  cardTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 15,
    lineHeight: 20,
    color: '#000',
    fontWeight: 700,
  },

  cardSubtitle: {
    fontFamily: 'Inter',
    fontSize: 12,
    lineHeight: 17,
    color: '#000',
  },

  button: {
    borderRadius: 0,
    backgroundColor: '#0061ED',
  },

  buttonLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
