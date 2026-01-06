import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Image } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { SvgXml } from 'react-native-svg';

interface SplashScreenProps {
  navigation: any;
}

const { width } = Dimensions.get('window');

const SplashScreen: React.FC<SplashScreenProps> = ({ navigation }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('GetStarted'); // Automatically navigate
    }, 1500);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../../assets/images/00_Start/Logo.png')}
        resizeMode="contain" // keeps aspect ratio
      />

      <Text style={styles.title}>Akida Mobile Connect</Text>
      <Text style={styles.subtitle}>Initializing Edge AI</Text>
      <ActivityIndicator
        animating
        size="large"
        color="#0061ED"
        style={{ marginTop: 20 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F9',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  title: {
    fontSize: width * 0.06,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: width * 0.04,
    color: 'gray',
  },
});

export default SplashScreen;
