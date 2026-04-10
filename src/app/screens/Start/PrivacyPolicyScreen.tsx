import { useNavigation, useRoute } from '@react-navigation/native';
import { X } from 'lucide-react-native';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrivacySectionCard } from '../../../components/common/PrivacySectionCard';
import { usePolicyStore } from '../../store/usePolicyStore';
import { Colors } from '../../theme/theme';
import { iconMap } from '../../utils/privacyIconMap';

const PrivacyPolicyScreen = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const onAccept = route.params?.onAccept;

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
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top,
      }}
    >
      {/* HEADER */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: Colors.white,
          padding: 25,
          borderBottomWidth: 1,
          borderBottomColor: Colors.border.light,
        }}
      >
        <Text
          variant="titleLarge"
          style={{ fontWeight: '700', color: Colors.black }}
        >
          {content.title}
        </Text>

        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <X size={24} color={Colors.black} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* BANNER */}
        {content.banners.map((banner, idx) => (
          <View
            style={{
              marginTop: 20,
              backgroundColor: Colors.primary,
              padding: 20,
              marginBottom: 16,
            }}
            key={idx}
          >
            <Text style={{ color: Colors.white, fontWeight: '700' }}>
              {banner.title}
            </Text>
            <Text style={{ color: Colors.white, marginTop: 6 }}>
              {banner.content}
            </Text>
          </View>
        ))}

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
          Last Updated: {content.last_updated}
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
      </ScrollView>

      {/* ACCEPT BUTTON */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: 16,
          paddingBottom: insets.bottom + 16,
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.outline,
        }}
      >
        <Button
          mode="contained"
          disabled={loading}
          onPress={() => {
            if (onAccept) onAccept();
            navigation.goBack();
          }}
          contentStyle={{ paddingVertical: 8 }}
        >
          Accept
        </Button>
      </View>
    </View>
  );
};

export default PrivacyPolicyScreen;
