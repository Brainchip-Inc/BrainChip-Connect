import React from 'react';
import { View, ScrollView, Linking, TouchableOpacity } from 'react-native';
import { Text, Button, IconButton, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ShieldCheck,
  Bluetooth,
  Cpu,
  Bell,
  Database,
  KeyRound,
  HelpCircle,
  User2,
  X,
} from 'lucide-react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

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

const PrivacyPolicyScreen = () => {
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
          Privacy Policy
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
        {/* Blue Banner */}
        <View
          style={{
            marginTop: 20,
            backgroundColor: '#0B5FFF',
            padding: 20,
            borderRadius: 6,
            marginBottom: 16,
          }}
        >
          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            <ShieldCheck size={20} color="#fff" />
            <Text
              style={{
                color: '#fff',
                fontWeight: '700',
                marginLeft: 8,
              }}
            >
              Your Privacy is Our Priority
            </Text>
          </View>
          <Text variant="bodyMedium" style={{ color: '#fff', lineHeight: 20 }}>
            Akida Mobile Connect is designed with privacy at its core. All data
            processing happens locally on your device and your connected
            BrainChip hardware. We do not collect, store, or transmit your
            personal data to external servers.
          </Text>
        </View>

        {/* What Data We Access */}
        <SectionCard title="What Data We Access">
          <Text
            variant="bodyMedium"
            style={{ marginBottom: 10, color: theme.colors.onSurfaceVariant }}
          >
            This app accesses the following data solely for device operation:
          </Text>

          <Row
            icon={Bluetooth}
            title="Bluetooth Connection Data"
            description="Device names, signal strength, and pairing information to establish and maintain connection with your BrainChip device"
          />

          <Row
            icon={Cpu}
            title="Sensor Data"
            description="IMU, audio, and environmental sensor readings displayed in real-time. All processing occurs on-device"
          />

          <Row
            icon={Bell}
            title="Notification Preferences"
            description="Your notification settings and event history, stored locally on your mobile device only"
          />
        </SectionCard>

        {/* Storage */}
        <SectionCard title="How We Store Your Data">
          <Text
            variant="bodyMedium"
            style={{ marginBottom: 10, color: theme.colors.onSurfaceVariant }}
          >
            All application data is stored locally on your mobile device using
            device secure local storage:
          </Text>

          <Row
            icon={Database}
            title="Device pairing information and connection preferences"
          />

          <Row
            icon={Cpu}
            title="AI model configurations and deployment history"
          />

          <Row icon={Bell} title="Notification history and alert preferences" />

          <Row
            icon={KeyRound}
            title="Power management and sensor configuration settings"
          />

          <Row
            icon={User2}
            title="User profile preferences and customization"
          />
        </SectionCard>

        {/* Data Sharing */}
        <SectionCard title="Data Sharing">
          <Text variant="bodyMedium" style={{ marginBottom: 6 }}>
            <Text style={{ fontWeight: '700' }}>
              We do not share, sell, or transmit your data.
            </Text>
          </Text>
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            All processing happens locally. The app communicates only with your
            paired BrainChip device via Bluetooth. No data leaves your device
            unless you explicitly choose to export or share it.
          </Text>
        </SectionCard>

        {/* Required Permissions */}
        <SectionCard title="Required Permissions">
          <Text
            variant="bodyMedium"
            style={{ marginBottom: 10, color: theme.colors.onSurfaceVariant }}
          >
            The app requires following permissions to function:
          </Text>

          <Row
            icon={Bluetooth}
            title="Bluetooth: To discover, connect, and communicate with BrainChip devices"
          />
          <Row
            icon={Database}
            title="Location: Required by Android/iOS for Bluetooth scanning"
          />
          <Row
            icon={Bell}
            title="Notifications: To alert you about AI model events and system updates"
          />
        </SectionCard>

        {/* Security */}
        <SectionCard title="Security">
          <Text
            variant="bodyMedium"
            style={{ color: theme.colors.onSurfaceVariant }}
          >
            Bluetooth connections are authenticated and encrypted. Your device
            pairing is secured with industry-standard cryptographic protocols.
            All communication between the app and your BrainChip device uses
            secure Bluetooth Low Energy (BLE) with pairing authentication.
          </Text>
        </SectionCard>

        {/* Questions */}
        <SectionCard title="Questions?">
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text>
              If you have questions about our privacy practices, please contact
              us at{' '}
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

export default PrivacyPolicyScreen;
