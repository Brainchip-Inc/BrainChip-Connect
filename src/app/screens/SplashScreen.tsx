import React, { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, ActivityIndicator, useTheme } from 'react-native-paper';
import BrainChipTheme, { Colors } from '../theme/theme';

interface SplashScreenProps {
  navigation: any;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ navigation }) => {
  const theme = useTheme();
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('GetStarted');
    }, 2000); // slightly longer for better UX

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Logo with shadow */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../assets/images/00_Start/Logo.png')}
          resizeMode="contain"
          style={styles.logo}
        />
      </View>

      {/* App Title */}
      <Text style={[styles.title, { color: theme.colors.primary }]}>
        Akida Mobile Connect
      </Text>

      {/* Subtitle */}
      <Text style={styles.subtitle}>Initializing Edge AI</Text>

      {/* Loader */}
      <ActivityIndicator
        animating
        size="large"
        color={Colors.primary}
        style={styles.loader}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    width: 180,
    height: 180,
    marginBottom: 32,
    borderRadius: 90,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 140,
    height: 140,
  },
  title: {
    fontFamily: 'Sora-Bold',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: 'Inter-Regular',
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    color: 'rgba(0, 0, 0, 0.5)',
    textAlign: 'center',
    marginBottom: 28,
  },
  loader: {
    marginTop: 10,
  },
});

export default SplashScreen;
