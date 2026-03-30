import React from 'react';
import {
  View,
  Image,
  StyleSheet,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import BLE from '../../assets/images/00_Start/BLE.svg';
import AIAppControl from '../../assets/images/00_Start/AIAppControl.svg';
import OTA from '../../assets/images/00_Start/OTA.svg';
import SensorData from '../../assets/images/00_Start/SensorData.svg';
import { RootParamList } from '../../../../App';

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
  const { width } = useWindowDimensions();

  const isTablet = width >= 768;
  const maxWidth = isTablet ? 600 : 382;

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F8F9' }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 24,
          paddingVertical: 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* CENTERED CONTENT COLUMN */}
        <View style={{ width: '100%', maxWidth }}>
          {/* LOGO + CONNECT */}
          <View style={styles.logoBlock}>
            <Image
              source={require('../../assets/images/00_Start/BrainChipLogo.png')}
              resizeMode="contain"
              style={styles.logo}
            />
            <Text style={styles.connectText}>Connect</Text>
          </View>

          {/* TEXT */}
          <View style={styles.textBlock}>
            <Text style={styles.title}>Edge AI IoT device management</Text>
            <Text style={styles.description}>
              with BLE connectivity, OTA updates, and live sensor monitoring
            </Text>
          </View>

          {/* CARDS */}
          <View style={styles.cardList}>
            {FEATURES.map((item, index) => {
              const Icon = item.Icon;
              return (
                <View key={index} style={styles.card}>
                  <View style={styles.iconBox}>
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
          <View style={styles.buttonWrap}>
            <Button
              mode="contained"
              onPress={() => navigation.navigate('Permissions')}
              contentStyle={{ height: 56 }}
              style={styles.button}
              labelStyle={styles.buttonLabel}
            >
              Get Started
            </Button>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default GetStartedScreen;

const styles = StyleSheet.create({
  logoBlock: {
    alignItems: 'center',
  },

  logo: {
    width: 229,
    height: 60,
  },

  connectText: {
    fontFamily: 'Sora-Bold',
    fontSize: 15,
    fontWeight: '600',
    color: '#0061ED',
    marginTop: 2,
  },

  textBlock: {
    marginTop: 24,
    alignItems: 'center',
  },

  title: {
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 26,
    textAlign: 'center',
    color: '#000',
  },

  description: {
    fontFamily: 'Inter',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 26,
    textAlign: 'center',
    color: '#000',
    width: 275,
    marginTop: 4,
  },

  cardList: {
    marginTop: 32,
    gap: 12,
  },

  card: {
    flexDirection: 'row',
    paddingTop: 16,
    paddingLeft: 12,
    paddingRight: 16,
    height: 102,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },

  iconBox: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },

  cardText: {
    flex: 1,
    gap: 4,
  },

  cardTitle: {
    fontFamily: 'Sora-SemiBold',
    fontSize: 16,
    lineHeight: 26,
    color: '#000',
    fontWeight: 700,
  },

  cardSubtitle: {
    fontFamily: 'Inter',
    fontSize: 13,
    lineHeight: 20,
    color: '#000',
  },

  buttonWrap: {
    marginTop: 32,
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
