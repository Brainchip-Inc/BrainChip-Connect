import { useNavigation, useRoute } from '@react-navigation/native';
import { FileText, Snowflake, X } from 'lucide-react-native';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTermsStore } from '../../store/useTermsStore';
import { Colors } from '../../theme/theme';
import { PrivacySectionCard } from '../../../components/common/PrivacySectionCard';

const TermsAndConditionsScreen = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const onAccept = route.params?.onAccept;

  const { terms, loading, error, fetchTerms } = useTermsStore();

  useEffect(() => {
    fetchTerms();
  }, [fetchTerms]);

  const content = terms;

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
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top,
      }}
    >
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#fff',
          padding: 25,
          borderBottomWidth: 1,
          borderBottomColor: '#ddd',
        }}
      >
        <Text variant="titleLarge" style={{ fontWeight: '700', color: '#000' }}>
          {content.title}
        </Text>

        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <X size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 100,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Banner */}
        {content.banners?.map((banner, idx) => (
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
        {content.sections?.map((section, idx) => (
          <PrivacySectionCard
            key={idx}
            title={`${idx + 1}. ${section.title}`}
          >
            {section.description && (
              <Text
                variant="bodyMedium"
                style={{
                  marginBottom: 10,
                  color: theme.colors.onSurfaceVariant,
                }}
              >
                {section.description}
              </Text>
            )}

            {section.items?.map((item, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 12 }}>
                <Snowflake size={16} color={theme.colors.primary} />
                <Text style={{ marginLeft: 8 }}>{item.title}</Text>
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
      </ScrollView>

      {/* Accept Button */}
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

export default TermsAndConditionsScreen;
