import { useNavigation, useRoute } from '@react-navigation/native';
import { X } from 'lucide-react-native';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrivacySectionCard } from '../../../components/common/PrivacySectionCard';
import { PRIVACY_POLICY } from '../../content/privacyPolicy';
import { Colors } from '../../theme/theme';
import { iconMap } from '../../utils/privacyIconMap';

const PrivacyPolicyScreen = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const onAccept = route.params?.onAccept;

  const content = PRIVACY_POLICY;

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
        {content.banners?.map((banner, idx) => (
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
          <PrivacySectionCard key={idx} title={section.title}>
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
          onPress={() => {
            if (onAccept) onAccept();
            navigation.goBack();
          }}
          style={styles.button}
          labelStyle={styles.buttonLabel}
        >
          Accept
        </Button>
      </View>
    </View>
  );
};

export default PrivacyPolicyScreen;

const styles = StyleSheet.create({
  button: {
    borderRadius: 0,
    backgroundColor: '#0061ED',
  },

  buttonLabel: {
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
});
