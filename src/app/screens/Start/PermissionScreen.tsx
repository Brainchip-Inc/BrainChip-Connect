import React, { useState, useEffect } from 'react';
import {
  View,
  useWindowDimensions,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { Text, Button, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckSquare, Square } from 'lucide-react-native';
import BleIcon from '../../assets/images/00_Permissions/Bluetooth Icon.svg';
import LocationIcon from '../../assets/images/00_Permissions/Location Icon.svg';
import NotificationIcon from '../../assets/images/00_Permissions/NotificationsIcon.svg';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootParamList } from '../../../../App';
import BleService from '../../../services/ble/bleManager';
import PermissionCard from '../../../components/common/PermissionCard';
import { useBleStore } from '../../store/useBleStore';
import {
  getAcceptanceState,
  setPrivacyAcceptedPersisted,
  setTermsAcceptedPersisted,
} from '../../store/acceptanceStorage';

const cardData = [
  {
    title: 'Bluetooth',
    subtitle:
      'Required to discover and connect to your BrainChip Edge AI devices via BLE.',
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

const PermissionsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootParamList>>();
  const { width, height } = useWindowDimensions();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const {
    privacyAccepted,
    setPrivacyAccepted,
    termsAccepted,
    setTermsAccepted,
    setPermissions,
  } = useBleStore();

  const [isGranting, setIsGranting] = useState(false);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);

  // Load persisted acceptance state on mount
  useEffect(() => {
    const loadAcceptance = async () => {
      const { privacyAccepted: privacy, termsAccepted: terms } =
        await getAcceptanceState();
      setPrivacyAccepted(privacy);
      setTermsAccepted(terms);
      if (privacy && terms) {
        setAlreadyAccepted(true);
      }
    };
    loadAcceptance().catch(() => {});
  }, [setPrivacyAccepted, setTermsAccepted]);

  const isSmallDevice = width < 375;
  const isLargeDevice = width >= 768;

  // Available height after safe area insets
  const availableHeight = height - insets.top - insets.bottom;
  const isCompact = availableHeight < 780;
  const isVeryCompact = availableHeight < 680;

  const cardGap = isVeryCompact ? 6 : isCompact ? 8 : 12;
  const sectionGap = isVeryCompact ? 12 : isCompact ? 16 : 20;
  const verticalPadding = isVeryCompact ? 12 : isCompact ? 16 : 20;
  const maxWidth = isLargeDevice ? 600 : width;

  const canProceed = alreadyAccepted || (privacyAccepted && termsAccepted);

  const openPrivacyPolicy = () => {
    navigation.navigate('PrivacyPolicy', {
      onAccept: () => {
        setPrivacyAccepted(true);
        setPrivacyAcceptedPersisted(true).catch(() => {});
      },
    });
  };

  const openTermsAndConditions = () => {
    navigation.navigate('TermsAndConditions', {
      onAccept: () => {
        setTermsAccepted(true);
        setTermsAcceptedPersisted(true).catch(() => {});
      },
    });
  };

  const togglePrivacyAccepted = () => {
    const nextValue = !privacyAccepted;
    setPrivacyAccepted(nextValue);
    setPrivacyAcceptedPersisted(nextValue).catch(() => {});
  };

  const toggleTermsAccepted = () => {
    const nextValue = !termsAccepted;
    setTermsAccepted(nextValue);
    setTermsAcceptedPersisted(nextValue).catch(() => {});
  };

  const handleGrantPermissions = async () => {
    setIsGranting(true);

    try {
      const permissions = await BleService.requestAllPermissions();
      setPermissions(permissions);

      if (!permissions.bluetooth) {
        setIsGranting(false);
        Alert.alert(
          'Bluetooth Permission Required',
          'Bluetooth permission is required to discover and connect to Edge AI devices. Please grant the permission to continue.',
          [{ text: 'OK' }],
        );
        return;
      }

      if (!permissions.location) {
        setIsGranting(false);
        Alert.alert(
          'Location Permission Required',
          'Location permission is required for Bluetooth scanning. Please grant the permission to continue.',
          [{ text: 'OK' }],
        );
        return;
      }

      const isEnabled = await BleService.isBluetoothEnabled();

      if (!isEnabled) {
        setIsGranting(false);
        Alert.alert(
          'Bluetooth Not Enabled',
          'Please turn on Bluetooth to discover and connect to devices.',
          [{ text: 'OK' }],
        );
        return;
      }

      setIsGranting(false);
      navigation.navigate('DeviceDiscovery');
    } catch {
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
        paddingTop: insets.top + verticalPadding,
        paddingBottom: insets.bottom + verticalPadding,
        paddingHorizontal: 20,
      }}
    >
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth,
          alignSelf: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* TOP CONTENT */}
        <View>
          {/* Header */}
          <View style={{ marginBottom: sectionGap }}>
            <Text
              variant={isSmallDevice ? 'headlineSmall' : 'headlineMedium'}
              style={{ fontWeight: '700', marginBottom: 4 }}
            >
              Permissions Required
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              To provide the best experience, we need access to the following
              device features:
            </Text>
          </View>

          {/* Permission Cards */}
          <View style={{ gap: cardGap, marginBottom: sectionGap }}>
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

          {/* Terms and Privacy — only shown if not already accepted */}
          {!alreadyAccepted && (
            <View style={{ gap: cardGap }}>
              {/* Privacy Policy Checkbox */}
              <TouchableOpacity
                onPress={togglePrivacyAccepted}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  backgroundColor: theme.colors.surface,
                  padding: isVeryCompact ? 10 : 12,
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
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text variant="bodyMedium">
                    I accept the{' '}
                    <Text
                      style={{
                        color: theme.colors.primary,
                        textDecorationLine: 'underline',
                        fontWeight: 'bold',
                      }}
                      onPress={e => {
                        e?.stopPropagation?.();
                        openPrivacyPolicy();
                      }}
                    >
                      Privacy Policy
                    </Text>
                  </Text>
                  {!isVeryCompact && (
                    <Text
                      variant="bodySmall"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        marginTop: 2,
                      }}
                    >
                      Your data stays on your device. We don't collect personal
                      information.
                    </Text>
                  )}
                </View>
              </TouchableOpacity>

              {/* Terms and Conditions Checkbox */}
              <TouchableOpacity
                onPress={toggleTermsAccepted}
                activeOpacity={0.7}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  backgroundColor: theme.colors.surface,
                  padding: isVeryCompact ? 10 : 12,
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
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text variant="bodyMedium">
                    I accept the{' '}
                    <Text
                      style={{
                        color: theme.colors.primary,
                        textDecorationLine: 'underline',
                        fontWeight: 'bold',
                      }}
                      onPress={e => {
                        e?.stopPropagation?.();
                        openTermsAndConditions();
                      }}
                    >
                      Terms and Conditions
                    </Text>
                  </Text>
                  {!isVeryCompact && (
                    <Text
                      variant="bodySmall"
                      style={{
                        color: theme.colors.onSurfaceVariant,
                        marginTop: 2,
                      }}
                    >
                      Development tool for Edge AI devices. Not designed for
                      collecting sensitive data.
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Bottom Action Buttons */}
        <View>
          {/* Grant Permissions */}
          <Button
            mode="contained"
            onPress={handleGrantPermissions}
            disabled={!canProceed || isGranting}
            loading={isGranting}
            style={{
              borderRadius: 0,
              backgroundColor: canProceed ? '#0061ED' : '#E5E7EB',
            }}
            labelStyle={{
              fontFamily: 'Inter-SemiBold',
              fontSize: 16,
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
            style={{
              borderRadius: 0,
              borderColor: '#E5E7EB',
              marginTop: 10,
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
    </View>
  );
};

export default PermissionsScreen;
