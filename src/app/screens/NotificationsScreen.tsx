import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, BellOff, ChevronLeft } from 'lucide-react-native';
import DeviceHeader from '../../components/custom/DeviceHeader';
import BottomNavigationBar from '../../components/custom/BottomNavigationBar';
import { RouteName, ROUTES } from '../../types/routes';
import { useBleStore } from '../store/useBleStore';
import { useNotificationsStore } from '../store/useNotificationStore';
import { Colors } from '../theme/theme';

const CONTENT_WIDTH = 382;

const NotificationsScreen = ({ navigation }: any) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [activeRoute, setActiveRoute] = useState<RouteName>(ROUTES.SETTINGS);
  const { connectedDevice } = useBleStore();
  const notificationsData = useNotificationsStore(state => state.notifications);

  const deviceName = connectedDevice?.name ?? 'Unknown Device';
  const { muteStatus, updateMuteStatus } = useNotificationsStore();

  const handleMuteNotifications = () => {
    const newMuteStatus = !muteStatus; // Toggle mute/unmute
    updateMuteStatus(newMuteStatus);

    Alert.alert(
      newMuteStatus
        ? 'Notifications are now muted.'
        : 'Notifications are now enabled.',
    );
  };

  const handleMoreDetails = () => {
    Alert.alert('This feature will be implemented later.');
  };

  return (
    <View style={[styles.root, { backgroundColor: `${Colors.background}` }]}>
      <DeviceHeader deviceName={deviceName} showConnectionStatus={true} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 140,
          flexGrow: 1,
        }}
      >
        {/* HEADER */}
        <View style={styles.container}>
          <View style={styles.header}>
            {/* ROW 1 */}
            <View style={styles.headerTopRow}>
              <TouchableOpacity onPress={() => navigation.goBack()}>
                <ChevronLeft size={30} />
              </TouchableOpacity>

              <Text style={styles.headerTitle}>Notifications</Text>
            </View>

            {/* ROW 2 */}
            <TouchableOpacity
              style={styles.muteRow}
              onPress={handleMuteNotifications}
            >
              {muteStatus ? (
                <BellOff size={20} color={Colors.lightGrey} />
              ) : (
                <Bell size={20} color={Colors.lightGrey} />
              )}

              <Text style={styles.muteText}>
                {muteStatus ? 'Unmute Notifications' : 'Mute Notifications'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* CONTENT */}
        <View style={styles.container}>
          {notificationsData.map(section => (
            <View key={section.date} style={styles.section}>
              <Text style={styles.date}>{section.date}</Text>

              {section.items.map((n, i) => (
                <View key={i} style={styles.card}>
                  <View style={styles.cardInner}>
                    <Bell size={20} color={Colors.primary} />

                    <View style={styles.cardContent}>
                      <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>{n.title}</Text>
                        <Text style={styles.time}>{n.time}</Text>
                      </View>

                      <Text style={styles.message}>{n.msg}</Text>

                      <View style={styles.footer}>
                        <Text style={styles.conf}>
                          Confidence:{' '}
                          <Text style={styles.confValue}>{n.conf}</Text>
                        </Text>
                        <Text style={styles.link} onPress={handleMoreDetails}>
                          See more details →
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavigationBar
        activeRoute={activeRoute}
        onNavigate={route => setActiveRoute(route)}
      />
    </View>
  );
};

export default NotificationsScreen;
const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    gap: 16,
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: `${Colors.border.light}`,
  },

  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },

  headerTitle: {
    marginLeft: 12,
    fontSize: 22,
    fontWeight: '700',
  },

  muteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginLeft: 8,
    gap: 8,
  },

  muteText: {
    fontSize: 14,
    color: `${Colors.lightGrey}`,
  },

  container: {
    alignSelf: 'center',
    width: CONTENT_WIDTH,
    gap: 24,
  },

  section: { gap: 12 },

  date: {
    fontFamily: 'Sora',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.13,
    marginLeft: 24,
    marginTop: 20,
  },

  card: {
    height: 98,
    backgroundColor: `${Colors.white}`,
    borderWidth: 1,
    borderColor: `${Colors.border.light}`,
    marginLeft: 24,
    marginRight: 24,
  },

  cardInner: {
    flexDirection: 'row',
    gap: 14,
    padding: 16,
  },

  cardContent: { flex: 1, gap: 4 },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  cardTitle: {
    fontFamily: 'Sora',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },

  time: {
    fontFamily: 'Inter',
    fontSize: 11,
    opacity: 0.7,
  },

  message: {
    fontFamily: 'Inter',
    fontSize: 12,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  conf: {
    fontFamily: 'Inter',
    fontSize: 11,
  },

  confValue: {
    fontWeight: '700',
    color: `${Colors.primary}`,
  },

  link: {
    fontFamily: 'Inter',
    fontSize: 11,
    fontWeight: '700',
    color: `${Colors.primary}`,
  },
});
