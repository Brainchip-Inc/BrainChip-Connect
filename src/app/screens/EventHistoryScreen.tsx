import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Card, Text } from 'react-native-paper';
import {
  ChevronLeft,
  Bell,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react-native';
import DeviceHeader from '../../components/custom/DeviceHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomNavigationBar from '../../components/custom/BottomNavigationBar';
import { useBleStore } from '../store/useBleStore';
import { RouteName, ROUTES } from '../../types/routes';
import { useEventsStore } from '../store/useEventStore';
import { Colors } from '../theme/theme';
import { useBleCommandStore } from '../store/useBleCommandStore';

const CONTENT_WIDTH = 382;

const EventHistoryScreen = ({ navigation }: any) => {
  const insets = useSafeAreaInsets();
  const [activeRoute, setActiveRoute] = useState<RouteName>(ROUTES.PROFILE);
  const { connectedDevice } = useBleStore();
  const eventsData = useEventsStore(state => state.events);

  const deviceName = connectedDevice?.name ?? 'Unknown Device';

  const activeApp = useBleCommandStore(state => state.activeApp);

  const { todayEvents, loadEvents } = useEventsStore();

  const handleMoreDetails = () => {
    Alert.alert('This feature will be implemented later.');
  };

  const formatTimeAgo = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);

    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;

    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;

    return new Date(timestamp).toLocaleDateString();
  };

  const todayKey = new Date().toISOString().split('T')[0];

  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr);

    return date.toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredEvents = eventsData
    // 1️⃣ Sort dates newest first
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(section => {
      // 2️⃣ Filter by active app
      const filteredItems = section.items
        .filter(item => item.appId === activeApp)
        // 3️⃣ Sort newest first inside each section
        .sort((a, b) => b.timestamp - a.timestamp)
        .map(item => ({
          ...item,
          time: formatTimeAgo(item.timestamp),
        }));

      return {
        date: formatDisplayDate(section.date),
        items: filteredItems,
      };
    })
    // 4️⃣ Remove empty sections
    .filter(section => section.items.length > 0);

  useEffect(() => {
    loadEvents();
  }, []);

  return (
    <View style={styles.root}>
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

              <Text style={styles.headerTitle}>Event History</Text>
            </View>

            {/* ROW 2 */}
            <Text style={styles.muteText}>
              All notifications and alerts from your{' '}
              <Text style={styles.bold}>{activeApp ?? 'Application'}</Text> on{' '}
              <Text style={styles.bold}>{deviceName}</Text>
            </Text>
          </View>
        </View>

        {/* CONTENT */}
        <View style={styles.container}>
          {filteredEvents.length === 0 && (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                margin: 20,
              }}
            >
              <Card
                style={{
                  width: '80%',
                  padding: 16,
                  backgroundColor: Colors.background,
                }}
              >
                <Card.Content
                  style={{ alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      opacity: 0.6,
                      textAlign: 'center',
                    }}
                  >
                    No events recorded for today.
                  </Text>
                </Card.Content>
              </Card>
            </View>
          )}
          {filteredEvents.map(section => (
            <View key={section.date} style={{ marginTop: 12 }}>
              <Text style={styles.date}>{section.date}</Text>
              {section.items.map((item, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.card}
                  onPress={handleMoreDetails}
                >
                  <View style={styles.cardRow}>
                    <Bell size={18} color={Colors.primary} />

                    <View style={{ flex: 1 }}>
                      <View style={styles.rowBetween}>
                        <View style={styles.row}>
                          {item.status === 'ok' ? (
                            <CheckCircle size={16} color={Colors.success} />
                          ) : (
                            <AlertTriangle size={16} color={Colors.warning} />
                          )}
                          <Text style={styles.cardTitle}>{item.title}</Text>
                        </View>
                        <Text style={styles.time}>{item.time}</Text>
                      </View>

                      <View style={styles.rowBetween}>
                        <Text style={styles.conf}>
                          Confidence:{' '}
                          <Text style={styles.confValue}>
                            {item.confidence}%
                          </Text>
                        </Text>
                        <Text style={styles.link}>See more details →</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
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

export default EventHistoryScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: `${Colors.background}` },
  container: {
    alignSelf: 'center',
    width: CONTENT_WIDTH,
    gap: 24,
  },
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
  bold: { fontWeight: '700' },

  date: {
    fontFamily: 'Sora',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.13,
    marginLeft: 24,
    marginBottom: 10,
  },

  card: {
    backgroundColor: `${Colors.background}`,
    borderWidth: 1,
    borderColor: `${Colors.border.light}`,
    marginBottom: 12,
    padding: 16,
    marginLeft: 24,
    marginRight: 24,
  },

  cardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },

  cardTitle: { fontSize: 12, fontWeight: '700' },
  time: { fontSize: 11 },

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
