import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  Linking,
  Image,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { ChevronLeft } from 'lucide-react-native';
import DeviceHeader from '../../components/custom/DeviceHeader';
import BottomNavigationBar from '../../components/custom/BottomNavigationBar';
import { useBleStore } from '../store/useBleStore';
import { useAboutStore } from '../store/useAboutStore';
import { Colors } from '../theme/theme';
import { RouteName, ROUTES } from '../../types/routes';

const Section = ({ title, children }: any) => (
  <View style={{ marginBottom: 20 }}>
    {title && <Text style={styles.sectionTitle}>{title}</Text>}
    <View style={styles.card}>{children}</View>
  </View>
);

const Bullet = ({ children }: any) => (
  <View style={styles.bulletRow}>
    <View style={styles.bullet} />
    <Text style={styles.body}>{children}</Text>
  </View>
);

const AboutScreen = ({ navigation }: any) => {
  const theme = useTheme();
  const { connectedDevice } = useBleStore();
  const { version, build, sections } = useAboutStore();

  const [activeRoute, setActiveRoute] = useState<RouteName>(ROUTES.PROFILE);

  const deviceName = connectedDevice?.name ?? 'Unknown Device';

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      <DeviceHeader deviceName={deviceName} showConnectionStatus />

      <View style={styles.content}>
        {/* HEADER - FIXED */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={28} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>About</Text>
        </View>

        {/* SCROLLABLE CONTENT */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {/* APP HEADER */}
          <View style={styles.appHeader}>
            <Image
              source={require('../assets/images/00_Start/BrainChipLogo.png')}
              resizeMode="contain"
              style={styles.logo}
            />
            <Text style={styles.connectLabel}>Connect</Text>
            <Text style={styles.aboutTitle}>About the App</Text>
            <Text style={styles.meta}>Version {version}</Text>
            <Text style={styles.meta}>Build {build}</Text>
          </View>

          {/* SECTIONS */}
          {sections.map(section => (
            <Section key={section.id} title={section.title}>
              {section.items.map((item: any, i: number) => {
                if (item.type === 'text') {
                  return (
                    <Text key={i} style={styles.body}>
                      {item.content}
                    </Text>
                  );
                }

                if (item.type === 'kv') {
                  return (
                    <Bullet key={i}>
                      <Text style={styles.bold}>{item.label}: </Text>
                      <Text
                        style={
                          item.label === 'AI Processor'
                            ? styles.linkBlue
                            : styles.body
                        }
                      >
                        {item.value}
                      </Text>
                    </Bullet>
                  );
                }

                if (item.type === 'list') {
                  return item.items.map((li: string, idx: number) => (
                    <Bullet key={idx}>{li}</Bullet>
                  ));
                }

                return null;
              })}
            </Section>
          ))}

          {/* FOOTER */}
          <Text style={styles.supportText}>
            For support and documentation, visit{' '}
            <Text
              style={styles.linkBlue}
              onPress={() => Linking.openURL('https://brainchip.com')}
            >
              brainchip.com
            </Text>
          </Text>
        </ScrollView>
      </View>

      <BottomNavigationBar
        activeRoute={activeRoute}
        onNavigate={route => setActiveRoute(route)}
      />
    </View>
  );
};

export default AboutScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },

  content: {
    flex: 1,
    paddingHorizontal: 20,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    gap: 12,
  },

  headerTitle: {
    fontFamily: 'Sora',
    fontSize: 24,
    fontWeight: '700',
  },

  appHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },

  aboutTitle: {
    fontFamily: 'Sora',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 12,
  },

  meta: {
    fontFamily: 'Inter',
    fontSize: 13,
  },

  sectionTitle: {
    fontFamily: 'Sora',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },

  card: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border.light,
    padding: 16,
  },

  body: {
    fontFamily: 'Inter',
    fontSize: 13,
    lineHeight: 22,
  },

  bold: {
    fontWeight: '600',
  },

  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },

  bullet: {
    width: 6,
    height: 6,
    backgroundColor: '#0061ED',
    borderRadius: 3,
    marginTop: 7,
    marginRight: 8,
  },

  linkBlue: {
    color: '#0061ED',
    fontFamily: 'Inter',
    fontSize: 13,
  },

  supportText: {
    textAlign: 'center',
    fontFamily: 'Inter',
    fontSize: 11,
    marginTop: 16,
  },
  logo: {
    width: 200,
    height: 54,
  },

  connectLabel: {
    fontFamily: 'Sora-Bold',
    fontSize: 15,
    fontWeight: '600',
    color: '#0061ED',
    marginTop: 2,
  },
});
