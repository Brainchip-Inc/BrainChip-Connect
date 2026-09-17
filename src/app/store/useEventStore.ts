import { create } from 'zustand';
import RNFS from 'react-native-fs';

const EVENTS_FILE = `${RNFS.DocumentDirectoryPath}/events.json`;

/**
 * How long to gather new events before writing the history file once.
 *
 * The file holds every event ever recorded, so writing it is proportional to
 * the whole history, and a board can report many times a second. Writing per
 * event at that rate saturated the JavaScript thread and left the app deaf to
 * touches; one write a second carries the same information.
 */
export const SAVE_DELAY_MS = 1000;

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
  addEvent: (event: EventItem) => void;
  clearEvents: () => Promise<void>;
}

const getTodayDate = () => {
  const d = new Date();
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
};

/**
 * Put one event at the head of today's section, leaving the old sections as
 * they were so that anything holding them sees a new array rather than a
 * mutated one.
 *
 * @param sections - The history as it stands.
 * @param event - The event to add.
 * @param today - Today's date key.
 */
const withEvent = (
  sections: EventSection[],
  event: EventItem,
  today: string,
): EventSection[] => {
  const current = sections.find(section => section.date === today);
  if (!current) {
    return [{ date: today, items: [event] }, ...sections];
  }
  return sections.map(section =>
    section === current
      ? { ...section, items: [event, ...section.items] }
      : section,
  );
};

export const useEventsStore = create<EventsState>((set, get) => {
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  /** Write whatever the history is by the time the timer fires, once. */
  const scheduleSave = () => {
    if (saveTimer) {
      return;
    }
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      try {
        await RNFS.writeFile(EVENTS_FILE, JSON.stringify(get().events), 'utf8');
      } catch (e) {
        if (__DEV__) console.warn('Save events error:', e);
      }
    }, SAVE_DELAY_MS);
  };

  /** Drop a write that has not happened yet. */
  const cancelSave = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
  };

  return {
    events: [],
    todayEvents: [],

    loadEvents: async () => {
      // Events still waiting to be written are newer than the file, so the
      // memory copy is the truth and reading the file would lose them.
      if (saveTimer) {
        return;
      }
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

    addEvent: (event: EventItem) => {
      const today = getTodayDate();
      const events = withEvent(get().events, event, today);
      const todaySection = events.find(section => section.date === today);

      set({ events, todayEvents: todaySection?.items ?? [] });
      scheduleSave();
    },

    clearEvents: async () => {
      cancelSave();
      await RNFS.unlink(EVENTS_FILE).catch(() => {});
      set({ events: [], todayEvents: [] });
    },
  };
});
