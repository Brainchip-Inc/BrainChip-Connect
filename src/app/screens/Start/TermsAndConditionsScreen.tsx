import { useNavigation, useRoute } from '@react-navigation/native';
import {
  Bell,
  Bluetooth,
  Cpu,
  Database,
  FileText,
  HelpCircle,
  KeyRound,
  Snowflake,
  User2,
  X,
} from 'lucide-react-native';
import React from 'react';
import { Linking, ScrollView, TouchableOpacity, View } from 'react-native';
import { Button, Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SectionCard = ({ title, children }: any) => {
  const theme = useTheme();
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.outline,
        borderRadius: 6,
        padding: 16,
        marginBottom: 16,
      }}
    >
      <Text
        variant="titleMedium"
        style={{ fontWeight: '700', marginBottom: 8 }}
      >
        {title}
      </Text>
      {children}
    </View>
  );
};

const Row = ({ icon: Icon, title, description }: any) => {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', marginBottom: 12 }}>
      <Icon size={18} color={theme.colors.primary} />
      <View style={{ marginLeft: 10, flex: 1 }}>
        <Text style={{ fontWeight: '600' }}>{title}</Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {description}
        </Text>
      </View>
    </View>
  );
};

const TermsAndConditionsScreen = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const onAccept = route.params?.onAccept;

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
          backgroundColor: '#fff', // White background like your screenshot
          padding: 25,
          borderBottomWidth: 1,
          borderBottomColor: '#ddd', // Light gray border line at bottom
        }}
      >
        <Text
          variant="titleLarge" // modal style heading
          style={{
            fontWeight: '700',
            color: '#000', // black text color for strong heading
          }}
        >
          Terms and Conditions
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
        <View
          style={{
            marginTop: 20,
            padding: 20,
            borderRadius: 6,
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            <FileText size={20} color={theme.colors.primary} />
            <Text
              style={{
                fontWeight: '700',
                marginLeft: 8,
              }}
            >
              Terms of Service
            </Text>
          </View>
          <Text variant="bodyMedium" style={{ lineHeight: 20 }}>
            By using Akida Mobile Connect, you agree to this terms and
            conditions. Please read them carefully before using the application.
          </Text>
        </View>

        {/* Acceptance of Terms */}
        <SectionCard title="1. Acceptance of Terms">
          <Text
            variant="bodyMedium"
            style={{ marginBottom: 10, color: theme.colors.onSurfaceVariant }}
          >
            By downloading, installing, or using Akida Mobile Connect, you
            acknowledge that you have read, understood, and agree to be bound by
            these Terms and Conditions. If you do not agree to these terms,
            please do not use this application.
          </Text>
        </SectionCard>

        {/* License Grant */}
        <SectionCard title="2. License Grant">
          <Text
            variant="bodyMedium"
            style={{ marginBottom: 10, color: theme.colors.onSurfaceVariant }}
          >
            BrainChip grants you a limited, non-exclusive, non-transferable,
            revocable license to use Akida Mobile Connect for personal or
            commercial purposes in connection with BrainChip Edge AI IoT
            devices. This license does not permit you to:
          </Text>

          <Row
            icon={Snowflake}
            title="Modify, reverse engineer, or decompile the application"
          />

          <Row
            icon={Snowflake}
            title="Use the application for any unlawful purpose"
          />

          <Row
            icon={Snowflake}
            title="Distribute, Sublicense, or transfer the application to third parties"
          />

          <Row
            icon={Snowflake}
            title="Remove or modify any proprietary notices or labels"
          />
        </SectionCard>

        {/* Device compatibility */}
        <SectionCard title="3. Device Compatibility">
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Akida Mobile Connect is designed to work with BrainChip Edge AI IoT
            devices. The application required compatible hardware and firmware
            versions. BrainChip does not guarantee compatibility with all mobile
            devices or operating system versions.
          </Text>
        </SectionCard>

        {/* User Responsibilities */}
        <SectionCard title="4. User Responsibilities">
          <Text
            variant="bodyMedium"
            style={{
              marginBottom: 10,
              color: theme.colors.onSurfaceVariant,
            }}
          >
            You are responsible for:
          </Text>

          <Row
            icon={Snowflake}
            title="Maintaining the security of your device and BrainChip hardware"
          />
          <Row
            icon={Snowflake}
            title="Ensuring proper use of connected devices and AI models"
          />
          <Row
            icon={Snowflake}
            title="Complying with applicable laws and regulations"
          />
          <Row
            icon={Snowflake}
            title="Maintaining adequate backups of important configurations"
          />
          <Row
            icon={Snowflake}
            title="Using the application in a safe and responsible manner"
          />
        </SectionCard>

        {/* Disclaimer of Warranties */}
        <SectionCard title="5. Disclaimer of Warranties">
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            The application is provided as is without warranties of any kind,
            either express or implied. BrainChip does not warrant that the
            application will be error-free, uninterrupted, or meet your specific
            requirements. Use of the application is at your own risk.
          </Text>
        </SectionCard>

        {/* Limitation of Liability */}
        <SectionCard title="6. Limitation of Liability">
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            To the maximum extent permitted by law, BrainChip shall not be
            liable for any indirect, incidental, special, consequential, or
            punitive damages, or any loss of profits or revenues, whether
            incurred directly or indirectly, or any loss of data, use, goodwill,
            or other intangible losses resulting from your use of the
            application.
          </Text>
        </SectionCard>

        {/* Updates and Modifications */}
        <SectionCard title="7. Updates and Modifications">
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            BrainChip may update, modify, or discontinue the application at any
            time without notice. We may also update these Terms and Conditions
            periodically. Continued use of the application after changes
            constitutes acceptance of the new terms.
          </Text>
        </SectionCard>

        {/* Intellectual Property */}
        <SectionCard title="8. Intellectual Property">
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            All intellectual property rights in Akida Mobile Connect, including
            but not limited to trademarks, logos, software, and documentation,
            are owned by BrainChip Holdings Ltd. The AkidaTM name and logo are
            trademarks of BrainChip.
          </Text>
        </SectionCard>

        {/* Termination */}
        <SectionCard title="9. Termination">
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            BrainChip may terminate your access to the application at any time
            for violation of these terms. Upon termination, you must cease all
            use of the application and delete all copies from your devices.
          </Text>
        </SectionCard>

        {/* Governing Law */}
        <SectionCard title="10. Governing Law">
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            These Terms and Conditions shall be governed by and construed in
            accordance with the laws of the jurisdiction where BrainChip
            Holdings Ltd. is incorporated, without regard to its conflict of law
            provisions.
          </Text>
        </SectionCard>

        {/* Contact Information */}
        <SectionCard title="Contact Information">
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text>
              For questions about this Terms and Conditions, please visit{' '}
              <Text
                style={{ color: theme.colors.primary }}
                onPress={() =>
                  Linking.openURL('https://brainchip.com/contact/')
                }
              >
                brainchip.com/contact/
              </Text>
            </Text>
          </View>
        </SectionCard>

        {/* Footer */}
        <Text
          variant="bodyMedium"
          style={{
            textAlign: 'center',
            color: theme.colors.onSurfaceVariant,
            marginBottom: 8,
          }}
        >
          Last updated: December 15, 2025
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
          onPress={() => {
            if (onAccept) {
              onAccept(); // ✅ enable checkbox
            }
            navigation.goBack(); // ✅ return to Permissions screen
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
