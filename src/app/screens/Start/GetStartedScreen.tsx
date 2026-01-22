import React from 'react';
import { View, Image, useWindowDimensions } from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CardComponent from '../../../components/common/CardComponent';
import BLE from '../../assets/images/00_Start/BLE.svg';
import AIAppControl from '../../assets/images/00_Start/AIAppControl.svg';
import OTA from '../../assets/images/00_Start/OTA.svg';
import SensorData from '../../assets/images/00_Start/SensorData.svg';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootParamList } from '../../../../App';

const cardData = [
  {
    title: 'Bluetooth Low Energy',
    subtitle: 'Wireless connectivity optimized for minimal power consumption',
    Icon: <BLE />,
  },
  {
    title: 'AI Application Control',
    subtitle: 'Deploy and manage neuromorphic models on device',
    Icon: <AIAppControl />,
  },
  {
    title: 'Real-time Sensor Data',
    subtitle: 'Stream and visualize sensor readings with low latency',
    Icon: <SensorData />,
  },
  {
    title: 'Over-the-Air Updates',
    subtitle: 'Seamless firmware updates without physical access',
    Icon: <OTA />,
  },
];

const GetStartedScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootParamList>>();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const isSmallDevice = width < 375;
  const contentMaxWidth = width >= 768 ? 520 : '100%';
  const logoSize = Math.min(width * 0.42, 150);
  const spacing = isSmallDevice ? 12 : 16;

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
      <View
        style={{
          flex: 1,
          paddingHorizontal: 20,
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <View
          style={{
            flex: 1,
            width: '100%',
            maxWidth: contentMaxWidth,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Image
            source={require('../../assets/images/00_Start/Logo.png')}
            resizeMode="contain"
            style={{
              width: logoSize,
              height: logoSize,
              marginBottom: 6,
            }}
          />

          <Text
            variant="labelMedium"
            style={{
              color: theme.colors.onSurfaceVariant,
              marginBottom: spacing,
            }}
          >
            Akida Mobile Connect
          </Text>

          <Text
            variant="headlineMedium"
            style={{
              textAlign: 'center',
              fontWeight: '700',
              marginBottom: 6,
            }}
          >
            Edge AI IoT device management
          </Text>

          <Text
            variant="bodyMedium"
            style={{
              textAlign: 'center',
              color: theme.colors.onSurfaceVariant,
              marginBottom: spacing * 1.5,
              paddingHorizontal: 8,
            }}
          >
            with BLE connectivity, OTA updates, and live sensor monitoring
          </Text>

          <View style={{ width: '100%', gap: 12 }}>
            {cardData.map((card, index) => (
              <CardComponent
                key={index}
                title={card.title}
                subtitle={card.subtitle}
                Icon={card.Icon}
              />
            ))}
          </View>
        </View>

        <View style={{ width: '100%', maxWidth: contentMaxWidth }}>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('Permissions')}
            contentStyle={{
              paddingVertical: isSmallDevice ? 12 : 14,
            }}
            labelStyle={{
              fontSize: 15,
              fontWeight: '600',
            }}
            style={{
              borderRadius: 0, // flat like image
              marginBottom: spacing,
            }}
          >
            Get Started
          </Button>
        </View>
      </View>
    </View>
  );
};

export default GetStartedScreen;
