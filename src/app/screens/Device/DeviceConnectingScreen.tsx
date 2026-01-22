import React, { useState } from 'react';
import { View, ScrollView, useWindowDimensions, Image } from 'react-native';
import {
  Text,
  Button,
  useTheme,
  ProgressBar,
  Divider,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Cpu, Bell, Home, Settings, User, Activity } from 'lucide-react-native';

interface AppItem {
  id: string;
  name: string;
  description: string;
  size: string;
}

const APPS: AppItem[] = [
  {
    id: 'keyword',
    name: 'Keyword Spotting',
    description: 'Voice-activated wake word detection using microphone input',
    size: '128 kB',
  },
  {
    id: 'anomaly',
    name: 'Anomaly Detection',
    description:
      'Real-time anomaly detection from vibration and acoustic patterns',
    size: '96 kB',
  },
  {
    id: 'imu',
    name: 'IMU Gesture',
    description: 'Motion gesture recognition using 6-axis IMU sensor data',
    size: '112 kB',
  },
  {
    id: 'vision',
    name: 'Vision Lite',
    description: 'Lightweight image classification for object detection',
    size: '256 kB',
  },
];

const DeviceApplicationsScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const spacing = width < 375 ? 12 : 16;
  const horizontalPadding = width < 375 ? 16 : 20;
  const maxWidth = width >= 768 ? 720 : width;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* ================= HEADER ================= */}
      <View
        style={{
          paddingTop: insets.top,
          paddingHorizontal: horizontalPadding,
          paddingBottom: spacing,
          backgroundColor: '#111111',
        }}
      >
        <View
          style={{
            maxWidth,
            width: '100%',
            alignSelf: 'center',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          {/* Left */}
          <View>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
              brainchip*
            </Text>
            <Text style={{ color: '#aaa', fontSize: 11 }}>
              Akida Mobile Connect
            </Text>
          </View>

          {/* Right */}
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
              BrainChip-AKD1000-A7F3
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: '#0BD6A5',
                  marginRight: 6,
                }}
              />
              <Text style={{ color: '#0BD6A5', fontSize: 11 }}>Connected</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ================= CONTENT ================= */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: horizontalPadding,
          paddingBottom: insets.bottom + 90,
          alignItems: 'center',
        }}
      >
        <View style={{ width: '100%', maxWidth }}>
          <Text
            variant="headlineMedium"
            style={{ fontWeight: '700', marginTop: spacing * 1.5 }}
          >
            Select the Application
          </Text>

          {/* Default configuration */}
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.outline,
              padding: spacing,
              marginTop: spacing,
            }}
          >
            <Text variant="labelMedium" style={{ marginBottom: 4 }}>
              Default Configuration
            </Text>
            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              No specific firmware build installed. All 4 AI use cases are
              currently available on your device. You can install a specialized
              build from Settings → Firmware Update.
            </Text>
          </View>

          {/* Applications */}
          {APPS.map(app => (
            <View
              key={app.id}
              style={{
                backgroundColor: theme.colors.surface,
                borderWidth: 1,
                borderColor: theme.colors.outline,
                padding: spacing,
                marginTop: spacing * 1.25,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Cpu size={20} color={theme.colors.primary} />
                <Text
                  variant="titleMedium"
                  style={{ fontWeight: '600', marginLeft: 8 }}
                >
                  {app.name}
                </Text>
              </View>

              <Text
                variant="bodySmall"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  marginTop: 6,
                }}
              >
                {app.description}
              </Text>

              <Text
                variant="bodySmall"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  marginTop: 4,
                }}
              >
                ◦ Size: {app.size}
              </Text>

              <View
                style={{
                  flexDirection: 'row',
                  gap: spacing,
                  marginTop: spacing,
                }}
              >
                <Button mode="outlined" style={{ flex: 1 }}>
                  More Information
                </Button>
                <Button mode="contained" style={{ flex: 1 }}>
                  Deploy Application
                </Button>
              </View>
            </View>
          ))}

          {/* Device Status */}
          <Text
            variant="titleMedium"
            style={{ fontWeight: '600', marginTop: spacing * 2 }}
          >
            Device Status
          </Text>

          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderWidth: 1,
              borderColor: theme.colors.outline,
              padding: spacing,
              marginTop: spacing,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                marginBottom: 6,
              }}
            >
              <Text variant="bodySmall">Battery</Text>
              <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                87%
              </Text>
            </View>

            <ProgressBar
              progress={0.87}
              color={theme.colors.secondary}
              style={{ height: 6, marginBottom: 6 }}
            />

            <Text
              variant="bodySmall"
              style={{ color: theme.colors.onSurfaceVariant }}
            >
              Power Mode: Balanced · 342 minutes left
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ================= BOTTOM NAV ================= */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: insets.bottom,
          backgroundColor: theme.colors.surface,
          borderTopWidth: 1,
          borderTopColor: theme.colors.outline,
        }}
      >
        <View
          style={{
            maxWidth,
            width: '100%',
            alignSelf: 'center',
            flexDirection: 'row',
            justifyContent: 'space-around',
            paddingVertical: 10,
          }}
        >
          <Home size={20} color={theme.colors.primary} />
          <Bell size={20} color={theme.colors.onSurfaceVariant} />
          <Settings size={20} color={theme.colors.onSurfaceVariant} />
          <User size={20} color={theme.colors.onSurfaceVariant} />
        </View>
      </View>
    </View>
  );
};

export default DeviceApplicationsScreen;
