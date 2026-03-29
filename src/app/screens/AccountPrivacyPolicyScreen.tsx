import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Button, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrivacySectionCard } from '../../components/common/PrivacySectionCard';
import BottomNavigationBar from '../../components/custom/BottomNavigationBar';
import DeviceHeader from '../../components/custom/DeviceHeader';
import { RouteName, ROUTES } from '../../types/routes';
import { useBleStore } from '../store/useBleStore';
import { usePolicyStore } from '../store/usePolicyStore';
import { Colors } from '../theme/theme';
import { iconMap } from '../utils/privacyIconMap';

const AccountPrivacyPolicyScreen = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [activeRoute, setActiveRoute] = useState<RouteName>(ROUTES.PROFILE);
  const { connectedDevice } = useBleStore();
  const navigation = useNavigation();

  const deviceName = connectedDevice?.name ?? 'Unknown Device';

  const { privacyPolicy, loading, error, fetchPrivacyPolicy } =
    usePolicyStore();

  useEffect(() => {
    fetchPrivacyPolicy();
  }, []);

  const content = privacyPolicy?.content;

  /* ================= LOADING ================= */
  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ marginTop: 12, color: theme.colors.onSurfaceVariant }}>
          Loading Privacy Policy…
        </Text>
      </View>
    );
  }

  /* ================= ERROR ================= */
  if (error) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
          backgroundColor: theme.colors.background,
        }}
      >
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>
          Failed to load policy
        </Text>
        <Text
          style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}
        >
          {error}
        </Text>
        <Button mode="contained" onPress={fetchPrivacyPolicy}>
          Retry
        </Button>
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
          <Text style={styles.headerTitle}>Privacy & Data</Text>
        </View>
        <View style={[styles.container]}>
          {/* BANNER */}
          <View
            style={{
              marginTop: 20,
              backgroundColor: Colors.primary,
              padding: 20,
              marginBottom: 16,
            }}
          >
            <Text style={{ color: Colors.white, fontWeight: '700' }}>
              {content.banner.title}
            </Text>
            <Text style={{ color: Colors.white, marginTop: 6 }}>
              {content.banner.content}
            </Text>
          </View>

          {/* SECTIONS */}
          {content.sections?.map((section, idx) => (
            <PrivacySectionCard key={idx} title={section.heading}>
              {section.description && (
                <Text
                  style={{
                    marginBottom: 10,
                    color: theme.colors.onSurfaceVariant,
                  }}
                >
                  {section.description}
                </Text>
              )}

              {section.items?.map((item, i) => {
                const Icon = iconMap[item.icon ?? 'default'] ?? null;

                return (
                  <View
                    key={i}
                    style={{ flexDirection: 'row', marginBottom: 12 }}
                  >
                    {Icon && <Icon size={18} color={theme.colors.primary} />}

                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text variant="titleSmall">{item.title}</Text>

                      {item.description && (
                        <Text
                          variant="titleSmall"
                          style={{ color: theme.colors.onSurfaceVariant }}
                        >
                          {item.description}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </PrivacySectionCard>
          ))}

          {/* FOOTER */}
          <Text
            style={{
              textAlign: 'center',
              color: theme.colors.onSurfaceVariant,
              marginBottom: 8,
            }}
          >
            Last Updated: {content.effective_date}
          </Text>

          <Text
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

export default AccountPrivacyPolicyScreen;

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    width: '100%',
    flexDirection: 'row',
    paddingTop: 48,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: `${Colors.border.light}`,
    gap: 16,
  },

  headerTitle: {
    fontFamily: 'Sora',
    fontSize: 24,
    fontWeight: '700',
  },

  scroll: { alignItems: 'center' },
  container: {
    alignSelf: 'center',
    padding: 24,
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
