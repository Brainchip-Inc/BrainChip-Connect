import React from 'react';
import { ScrollView, Dimensions, View, Image } from 'react-native';
import { Text, Button } from 'react-native-paper';
import CardComponent from '../../../components/common/CardComponent';

// Custom SVGs
const { width } = Dimensions.get('window');

const cardData = [
  {
    title: 'Bluetooth Low Energy',
    subtitle: 'Wireless connectivity optimized for minimal power consumption',
    Icon: '../assets/images/00_Start/BLE.svg',
  },
  {
    title: 'AI Application Control',
    subtitle: 'Deploy and manage neuromorphic models on device',
    Icon: '../assets/images/00_Start/BLE.svg',
  },
  {
    title: 'Real-time Sensor Data',
    subtitle: 'Stream and visualize sensor readings with low latency',
    Icon: '../assets/images/00_Start/BLE.svg',
  },
  {
    title: 'Over-the-Air Updates',
    subtitle: 'Seamless firmware updates without physical access',
    Icon: '../assets/images/00_Start/BLE.svg',
  },
];

const GetStartedScreen: React.FC = () => {
  return (
    <ScrollView
      contentContainerStyle={{
        padding: 20,
        paddingBottom: 40,
        alignItems: 'center',
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Logo */}
      <Image
        source={require('../assets/images/00_Start/Logo.png')}
        resizeMode="contain" // keeps aspect ratio
      />
      <Image
        source={require('../assets/images/00_Start/AIAppControl.svg')}
        resizeMode="contain" // keeps aspect ratio
      />
      {/* Description */}
      <Text
        style={{
          textAlign: 'center',
          fontSize: width * 0.038,
          lineHeight: width * 0.055,
          marginBottom: 30,
        }}
      >
        Edge AI IoT device management with BLE connectivity, OTA updates, and
        live sensor monitoring
      </Text>

      {/* Cards */}
      <View style={{ width: '100%' }}>
        {cardData.map((card, index) => (
          <CardComponent
            key={index}
            title={card.title}
            subtitle={card.subtitle}
            Icon={card.Icon}
          />
        ))}
      </View>

      {/* Get Started Button */}
      <Button
        mode="contained"
        style={{
          marginTop: 20,
          width: '100%',
          paddingVertical: 10,
          borderRadius: 8,
        }}
        onPress={() => {
          console.log('Get Started pressed');
        }}
      >
        Get Started
      </Button>
    </ScrollView>
  );
};

export default GetStartedScreen;
