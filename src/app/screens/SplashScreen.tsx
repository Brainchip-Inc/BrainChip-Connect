import React, { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import { Text, ActivityIndicator, useTheme } from 'react-native-paper';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootParamList } from '../../../App';
import { Colors } from '../theme/theme';

interface SplashScreenProps {
  navigation: NativeStackNavigationProp<RootParamList>;
}

const SplashScreen: React.FC<SplashScreenProps> = ({ navigation }) => {
  const theme = useTheme();

  useEffect(() => {
    let isMounted = true;

    const resolveStartupRoute = async () => {
      // Brief delay for splash branding
      await new Promise(resolve => setTimeout(resolve, 800));
      if (!isMounted) return;
      navigation.replace('GetStarted');
    };

    resolveStartupRoute().catch(() => {
      if (isMounted) {
        navigation.replace('GetStarted');
      }
    });

    return () => {
      isMounted = false;
    };
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Logo with shadow */}
      <View style={styles.logoContainer}>
        <Image
          source={require('../assets/images/00_Start/NeuronLogo.png')}
          resizeMode="contain"
          style={styles.logo}
        />
      </View>

      {/* App Title */}
      <Text style={[styles.title, { color: theme.colors.primary }]}>
        BrainChip Connect
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
