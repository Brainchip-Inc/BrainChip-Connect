import React, { useState } from 'react';
import {
  View,
  ScrollView,
  useWindowDimensions,
  Platform,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {
  Text,
  Button,
  Portal,
  Modal,
  useTheme,
  IconButton,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckSquare, Square, X } from 'lucide-react-native';
import CardComponent from '../../../components/common/CardComponent';
import BleIcon from '../../assets/images/00_Permissions/Bluetooth Icon.svg';
import LocationIcon from '../../assets/images/00_Permissions/Location Icon.svg';
import NotificationIcon from '../../assets/images/00_Permissions/NotificationsIcon.svg';
import SensorData from '../../assets/images/00_Start/SensorData.svg';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootParamList } from '../../../../App';
import BleService from '../../../services/ble/bleManager';
import PermissionCard from '../../../components/common/PermissionCard';

const cardData = [
  {
    title: 'Bluetooth',
    subtitle:
      'Required to discover and connect to your Brainchip Edge AI devices via BLE.',
    Icon: BleIcon,
    required: true,
  },
  {
    title: 'Location',
    subtitle:
      'Needed for Bluetooth Low Energy scanning on Android. Your location is not tracked.',
    Icon: LocationIcon,
    required: false,
  },
  {
    title: 'Notifications',
    subtitle:
      'Receive alerts about AI model events, firmware updates, and device status changes.',
    Icon: NotificationIcon,
    required: false,
  },
];

const PRIVACY_POLICY = `Privacy Policy

Last updated: January 2026

1. Information We Collect
We do not collect, store, or transmit any personal information. All data remains on your device.

2. Device Permissions
- Bluetooth: Required for connecting to Edge AI devices
- Location: Only used for Bluetooth scanning on Android (not for tracking)
- Notifications: Only for device alerts

3. Data Storage
All application data is stored locally on your device. We do not have access to your data.

4. Third-Party Services
This app does not integrate with any third-party analytics or tracking services.

5. Changes to This Policy
We may update this policy from time to time. Changes will be posted in the app.

Contact: support@brainchip.com`;

const TERMS_CONDITIONS = `Terms and Conditions

Last updated: January 2026

1. Acceptance of Terms
By using this application, you agree to these terms and conditions.

2. Purpose
This is a development and testing tool for BrainChip Edge AI devices. It is not designed for collecting or processing sensitive data.

3. User Responsibilities
- Use the app only with authorized devices
- Do not use for unauthorized data collection
- Ensure compliance with local regulations

4. Limitations
- The app is provided "as is" without warranties
- We are not responsible for device misuse
- Not intended for medical or safety-critical applications

5. Updates
The app may receive updates to improve functionality and security.

6. Termination
We reserve the right to discontinue the service at any time.

Contact: support@brainchip.com`;

const PermissionsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootParamList>>();
  const { width } = useWindowDimensions();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState('');
  const [modalTitle, setModalTitle] = useState('');
  const [isGranting, setIsGranting] = useState(false);

  const isSmallDevice = width < 375;
  const isMediumDevice = width >= 375 && width < 768;
  const isLargeDevice = width >= 768;

  const spacing = isSmallDevice ? 10 : isMediumDevice ? 12 : 20;
  const horizontalPadding = isSmallDevice
    ? 16
    : isMediumDevice
    ? 20
    : Math.min(width * 0.1, 80);
  const maxWidth = isLargeDevice ? 600 : width;

  const canProceed = privacyAccepted && termsAccepted;

  // const openPrivacyPolicy = () => {
  //   setModalTitle('Privacy Policy');
  //   setModalContent(PRIVACY_POLICY);
  //   setModalVisible(true);
  // };
  const openPrivacyPolicy = () => {
    navigation.navigate('PrivacyPolicy', {
      onAccept: () => setPrivacyAccepted(true),
    });
  };

  // const openTermsAndConditions = () => {
  //   setModalTitle('Terms and Conditions');
  //   setModalContent(TERMS_CONDITIONS);
  //   setModalVisible(true);
  // };

  const openTermsAndConditions = () => {
    navigation.navigate('TermsAndConditions', {
      onAccept: () => setTermsAccepted(true),
    });
  };

  const handleGrantPermissions = async () => {
    setIsGranting(true);

    try {
      console.log('Requesting all permissions...');

      // Request all permissions (Bluetooth, Location, Notifications)
      const permissions = await BleService.requestAllPermissions();

      console.log('Permission results:', permissions);

      // Check if Bluetooth permission is granted (required)
      if (!permissions.bluetooth) {
        setIsGranting(false);
        Alert.alert(
          'Bluetooth Permission Required',
          'Bluetooth permission is required to discover and connect to Edge AI devices. Please grant the permission to continue.',
          [{ text: 'OK' }],
        );
        return;
      }

      // Check if Location permission is granted (required for BLE scanning)
      if (!permissions.location) {
        setIsGranting(false);
        Alert.alert(
          'Location Permission Required',
          'Location permission is required for Bluetooth scanning. Please grant the permission to continue.',
          [{ text: 'OK' }],
        );
        return;
      }

      // Notification permission is optional, just log if not granted
      if (!permissions.notifications) {
        console.log('Notification permission not granted (optional)');
      }

      // Check if Bluetooth is enabled
      console.log('Checking Bluetooth state...');
      const isEnabled = await BleService.isBluetoothEnabled();
      console.log('Bluetooth enabled:', isEnabled);

      if (!isEnabled) {
        setIsGranting(false);
        Alert.alert(
          'Bluetooth Not Enabled',
          'Please turn on Bluetooth to discover and connect to devices.',
          [{ text: 'OK' }],
        );
        return;
      }

      // All required permissions granted and Bluetooth is enabled
      console.log('All permissions granted, navigating to DeviceDiscovery');
      setIsGranting(false);
      navigation.navigate('DeviceDiscovery');
    } catch (error) {
      console.error('Error granting permissions:', error);
      setIsGranting(false);
      Alert.alert(
        'Error',
        'An error occurred while requesting permissions. Please try again.',
        [{ text: 'OK' }],
      );
    }
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        paddingTop: insets.top,
      }}
    >
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingTop: spacing * 2,
          paddingBottom: insets.bottom + 160,
          alignItems: 'center',
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ width: '100%', maxWidth }}>
          {/* Header */}
          <View style={{ marginBottom: spacing * 1.5 }}>
            <Text
              variant={isSmallDevice ? 'headlineSmall' : 'headlineMedium'}
              style={{ fontWeight: '700', marginBottom: spacing * 0.5 }}
            >
              Permissions Required
            </Text>
            <Text
              variant="bodyMedium"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              To provide the best experience, we need access to the following
              device features:
            </Text>
          </View>

          {/* Permission Cards */}
          <View style={{ gap: spacing, marginBottom: spacing * 1.5 }}>
            {cardData.map((card, index) => (
              <PermissionCard
                key={index}
                title={card.title}
                subtitle={card.subtitle}
                Icon={card.Icon}
                required={card.required}
              />
            ))}
          </View>

          {/* Terms and Privacy */}
          <View style={{ gap: spacing }}>
            {/* Privacy Policy Checkbox */}
            <TouchableOpacity
              onPress={() => setPrivacyAccepted(!privacyAccepted)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                backgroundColor: theme.colors.surface,
                padding: spacing,
                borderWidth: 1,
                borderColor: theme.colors.outline,
              }}
            >
              <View style={{ paddingTop: 2 }}>
                {privacyAccepted ? (
                  <CheckSquare
                    size={22}
                    color={theme.colors.primary}
                    strokeWidth={2}
                  />
                ) : (
                  <Square
                    size={22}
                    color={theme.colors.outline}
                    strokeWidth={2}
                  />
                )}
              </View>
              <View style={{ flex: 1, marginLeft: spacing * 0.75 }}>
                <Text variant="bodyMedium">
                  I accept the{' '}
                  <Text
                    style={{
                      color: theme.colors.primary,
                      textDecorationLine: 'underline',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                    onPress={e => {
                      e?.stopPropagation?.();
                      openPrivacyPolicy();
                    }}
                  >
                    Privacy Policy
                  </Text>
                </Text>
                <Text
                  variant="bodySmall"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    marginTop: 4,
                  }}
                >
                  Your data stays on your device. We don't collect personal
                  information.
                </Text>
              </View>
            </TouchableOpacity>

            {/* Terms and Conditions Checkbox */}
            <TouchableOpacity
              onPress={() => setTermsAccepted(!termsAccepted)}
              activeOpacity={0.7}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                backgroundColor: theme.colors.surface,
                padding: spacing,
                borderWidth: 1,
                borderColor: theme.colors.outline,
              }}
            >
              <View style={{ paddingTop: 2 }}>
                {termsAccepted ? (
                  <CheckSquare
                    size={22}
                    color={theme.colors.primary}
                    strokeWidth={2}
                  />
                ) : (
                  <Square
                    size={22}
                    color={theme.colors.outline}
                    strokeWidth={2}
                  />
                )}
              </View>
              <View style={{ flex: 1, marginLeft: spacing * 0.75 }}>
                <Text variant="bodyMedium">
                  I accept the{' '}
                  <Text
                    style={{
                      color: theme.colors.primary,
                      textDecorationLine: 'underline',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                    onPress={e => {
                      e?.stopPropagation?.();
                      openTermsAndConditions();
                    }}
                  >
                    Terms and Conditions
                  </Text>
                </Text>
                <Text
                  variant="bodySmall"
                  style={{
                    color: theme.colors.onSurfaceVariant,
                    marginTop: 4,
                  }}
                >
                  Development tool for Edge AI devices. Not designed for
                  collecting sensitive data.
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Bottom Action Buttons */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            width: '100%',
            alignItems: 'center',
            paddingBottom: insets.bottom + 24,
            backgroundColor: 'transparent',
          }}
        >
          <View style={{ width: '100%', maxWidth }}>
            {/* Grant Permissions */}
            <Button
              mode="contained"
              onPress={handleGrantPermissions}
              disabled={!canProceed || isGranting}
              loading={isGranting}
              contentStyle={{ height: 58 }}
              style={{
                borderRadius: 0,
                backgroundColor: canProceed ? '#0061ED' : '#E5E7EB',
              }}
              labelStyle={{
                fontSize: 16,
                fontWeight: '600',
                color: canProceed ? '#FFFFFF' : 'rgba(0,0,0,0.4)',
              }}
            >
              {isGranting ? 'Requesting Permissions...' : 'Grant Permissions'}
            </Button>

            {/* Back */}
            <Button
              mode="outlined"
              onPress={() => navigation.goBack()}
              disabled={isGranting}
              contentStyle={{ height: 48 }}
              style={{
                borderRadius: 0,
                borderColor: '#E5E7EB',
                marginTop: 12,
                backgroundColor: '#FFFFFF',
              }}
              labelStyle={{
                fontSize: 14,
                fontWeight: '500',
                color: '#000000',
              }}
            >
              Back
            </Button>
          </View>
        </View>
      </ScrollView>

      {/* Modal for Privacy Policy / Terms */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          dismissable={true}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
          }}
          contentContainerStyle={{
            backgroundColor: theme.colors.surface,
            marginHorizontal: horizontalPadding,
            marginVertical: spacing * 4,
            padding: spacing * 1.5,
            maxHeight: '80%',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: spacing,
            }}
          >
            <Text
              variant="headlineSmall"
              style={{ fontWeight: '700', flex: 1 }}
            >
              {modalTitle}
            </Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              hitSlop={10}
            >
              <X size={24} color={theme.colors.onSurface} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text variant="bodyMedium" style={{ lineHeight: 22 }}>
              {modalContent}
            </Text>
          </ScrollView>
          <Button
            mode="contained"
            onPress={() => setModalVisible(false)}
            style={{ marginTop: spacing * 1.5 }}
            contentStyle={{ paddingVertical: 8 }}
          >
            Close
          </Button>
        </Modal>
      </Portal>
    </View>
  );
};

export default PermissionsScreen;
