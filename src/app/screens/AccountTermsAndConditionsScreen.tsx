import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, FileText, Snowflake } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrivacySectionCard } from '../../components/common/PrivacySectionCard';
import BottomNavigationBar from '../../components/custom/BottomNavigationBar';
import DeviceHeader from '../../components/custom/DeviceHeader';
import { RouteName, ROUTES } from '../../types/routes';
import { useBleStore } from '../store/useBleStore';
import { useTermsStore } from '../store/useTermsStore';
import { Colors } from '../theme/theme';

const AccountTermsAndConditionsScreen = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [activeRoute, setActiveRoute] = useState<RouteName>(ROUTES.PROFILE);
  const { connectedDevice } = useBleStore();
  const navigation = useNavigation();

  const deviceName = connectedDevice?.name ?? 'Unknown Device';

  const { terms, loading, error, fetchTerms } = useTermsStore();

  useEffect(() => {
    fetchTerms();
  }, []);

  const content = terms?.content;

  /* ===== LOADING ===== */
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 10 }}>Loading Terms…</Text>
      </View>
    );
  }

  /* ===== ERROR ===== */
  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Error loading Terms</Text>
        <Button onPress={fetchTerms}>Retry</Button>
      </View>
    );
  }

  if (!content) return null;

  return (
    <View style={[styles.root, { backgroundColor: theme.colors.background }]}>
      {/* TOP BAR */}
      <DeviceHeader deviceName={deviceName} showConnectionStatus={true} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          {
            paddingBottom: insets.bottom + 140,
            flexGrow: 1,
          },
        ]}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={30} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Terms & Conditions</Text>
        </View>
        <View style={[styles.container]}>
          {/* Banner */}
          {content.banners.map((banner, idx) => (
            <View
              style={{
                marginTop: 20,
                padding: 20,
                borderRadius: 6,
                marginBottom: 16,
                backgroundColor: Colors.white,
              }}
              key={idx}
            >
              <View style={{ flexDirection: 'row', marginBottom: 8 }}>
                <FileText size={20} color={theme.colors.primary} />
                <Text variant="titleMedium" style={{ marginLeft: 8 }}>
                  {banner.title}
                </Text>
              </View>

              <Text variant="bodyMedium" style={{ lineHeight: 20 }}>
                {banner.content}
              </Text>
            </View>
          ))}

          {/* Sections */}
          {content.sections.map((section, idx) => (
            <PrivacySectionCard
              key={idx}
              title={`${idx + 1}. ${section.heading}`}
            >
              {section.content && (
                <Text
                  variant="bodyMedium"
                  style={{
                    marginBottom: 10,
                    color: theme.colors.onSurfaceVariant,
                  }}
                >
                  {section.content}
                </Text>
              )}

              {section.items?.map((item, i) => (
                <View
                  key={i}
                  style={{ flexDirection: 'row', marginBottom: 12 }}
                >
                  <Snowflake size={16} color={theme.colors.primary} />
                  <Text style={{ marginLeft: 8 }}>{item.text}</Text>
                </View>
              ))}
            </PrivacySectionCard>
          ))}

          {/* Footer */}
          <Text
            variant="bodyMedium"
            style={{
              textAlign: 'center',
              color: theme.colors.onSurfaceVariant,
              marginBottom: 8,
            }}
          >
            Last Updated: {content.last_updated}
          </Text>

          <Text
            variant="bodyMedium"
            style={{
              textAlign: 'center',
              color: theme.colors.onSurfaceVariant,
              marginBottom: 24,
            }}
          >
            © 2025 BrainChip Holdings Ltd. All rights reserved.
          </Text>
        </View>
      </ScrollView>

      {/* Bottomnavbar */}
      <BottomNavigationBar
        activeRoute={activeRoute}
        onNavigate={route => setActiveRoute(route)}
      />
    </View>
  );
};

export default AccountTermsAndConditionsScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },

  headerTitle: {
    fontFamily: 'Sora',
    fontSize: 24,
    fontWeight: '700',
  },

  scroll: {},
  container: {
    paddingHorizontal: 20,
  },

  sectionTitle: {
    fontFamily: 'Sora',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 8,
    marginRight: 8,
  },

  card: {
    backgroundColor: `${Colors.white}`,
    borderWidth: 1,
    borderColor: `${Colors.border.light}`,
    marginLeft: 8,
    marginRight: 8,
  },

  secondCard: {
    backgroundColor: `${Colors.white}`,
    borderWidth: 1,
    borderColor: `${Colors.border.light}`,
    marginTop: 10,
    marginLeft: 8,
    marginRight: 8,
  },

  secondcardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  cardText: { flex: 1 },
  cardTitle: {
    fontFamily: 'Sora',
    fontSize: 15,
    fontWeight: '700',
  },
  cardSub: {
    fontFamily: 'Inter',
    fontSize: 13,
  },

  dangerTitle: {
    color: `${Colors.error}`,
    fontFamily: 'Sora',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 8,
    marginRight: 8,
  },

  dangerCard: {
    backgroundColor: `${Colors.verylightWhite}`,
    borderWidth: 2,
    borderColor: `${Colors.error}`,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 12,
  },
  dangerText: {
    fontFamily: 'Sora',
    fontSize: 15,
    fontWeight: '700',
    color: `${Colors.error}`,
  },
  dangerSub: {
    fontFamily: 'Inter',
    fontSize: 12,
    color: `${Colors.error}`,
  },

  footer: {
    marginTop: 32,
    alignItems: 'center',
    paddingBottom: 24,
  },
  footerText: {
    fontSize: 12,
    fontFamily: 'Inter',
  },
});
