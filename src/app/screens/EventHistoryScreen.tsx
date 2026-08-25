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
import BottomNavigationBar from '../../components/custom/BottomNavigationBar';
import { useBleStore } from '../store/useBleStore';
import { RouteName, ROUTES } from '../../types/routes';
import { useEventsStore } from '../store/useEventStore';
import { Colors } from '../theme/theme';
import { useBleCommandStore } from '../store/useBleCommandStore';

const EventHistoryScreen = ({ navigation }: any) => {
  const [activeRoute, setActiveRoute] = useState<RouteName>(ROUTES.PROFILE);
  const { connectedDevice } = useBleStore();
  const eventsData = useEventsStore(state => state.events);

  const deviceName = connectedDevice?.name ?? 'Unknown Device';

  const activeApp = useBleCommandStore(state => state.activeApp);

  const { loadEvents } = useEventsStore();

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

  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr);

    return date.toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const filteredEvents = eventsData
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(section => {
      const filteredItems = section.items
        .filter(item => item.appId === activeApp)
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
    .filter(section => section.items.length > 0);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  return (
    <View style={styles.root}>
      <DeviceHeader deviceName={deviceName} showConnectionStatus={true} />

      <View style={styles.content}>
        {/* HEADER - FIXED */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ChevronLeft size={28} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Event History</Text>
        </View>

        <Text style={styles.subtitle}>
          All notifications and alerts from your{' '}
          <Text style={styles.bold}>{activeApp ?? 'Application'}</Text> on{' '}
          <Text style={styles.bold}>{deviceName}</Text>
        </Text>

        {/* SCROLLABLE EVENT LIST */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {filteredEvents.length === 0 && (
            <View style={styles.emptyState}>
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
        </ScrollView>
      </View>

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

  content: {
    flex: 1,
    paddingHorizontal: 20,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    gap: 12,
  },

  headerTitle: {
    fontFamily: 'Sora',
    fontSize: 24,
    fontWeight: '700',
  },

  subtitle: {
    fontSize: 14,
    color: `${Colors.lightGrey}`,
    marginBottom: 12,
  },
  bold: { fontWeight: '700' },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 20,
  },

  date: {
    fontFamily: 'Sora',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.13,
    marginBottom: 10,
  },

  card: {
    backgroundColor: `${Colors.background}`,
    borderWidth: 1,
    borderColor: `${Colors.border.light}`,
    marginBottom: 12,
    padding: 16,
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
