import { create } from 'zustand';
import RNFS from 'react-native-fs';

const EVENTS_FILE = `${RNFS.DocumentDirectoryPath}/events.json`;

interface EventItem {
  appId: string;
  title: string;
  timestamp: number;
  confidence: number;
  status: 'ok' | 'warn';
}

interface EventSection {
  date: string; // YYYY-MM-DD
  items: EventItem[];
}

interface EventsState {
  events: EventSection[];
  todayEvents: EventItem[];

  loadEvents: () => Promise<void>;
  addEvent: (event: EventItem) => Promise<void>;
  clearEvents: () => Promise<void>;
}

const getTodayDate = () => {
  const d = new Date();
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
};

export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],
  todayEvents: [],

  loadEvents: async () => {
    try {
      const exists = await RNFS.exists(EVENTS_FILE);
      if (!exists) {
        set({ events: [], todayEvents: [] });
        return;
      }

      const file = await RNFS.readFile(EVENTS_FILE, 'utf8');
      const parsed: EventSection[] = JSON.parse(file);

      const today = getTodayDate();
      const todaySection = parsed.find(e => e.date === today);

      set({
        events: parsed,
        todayEvents: todaySection?.items ?? [],
      });
    } catch (e) {
      if (__DEV__) console.warn('Load events error:', e);
    }
  },

  addEvent: async (event: EventItem) => {
    const today = getTodayDate();
    let events = [...get().events];

    let todaySection = events.find(e => e.date === today);

    if (!todaySection) {
      todaySection = { date: today, items: [] };
      events.unshift(todaySection);
    }

    todaySection.items.unshift(event);

    await RNFS.writeFile(EVENTS_FILE, JSON.stringify(events), 'utf8');

    set({
      events,
      todayEvents: todaySection.items,
    });
  },

  clearEvents: async () => {
    await RNFS.unlink(EVENTS_FILE).catch(() => {});
    set({ events: [], todayEvents: [] });
  },
}));
