import { create } from 'zustand';

interface EventItem {
  title: string;
  time: string;
  confidence: number;
  status: 'ok' | 'warn'; // Event status (e.g., 'ok' or 'warn')
}

interface EventSection {
  date: string;
  items: EventItem[];
}

interface EventsState {
  events: EventSection[];
  setEvents: (data: EventSection[]) => void;
}

export const useEventsStore = create<EventsState>(set => ({
  events: [
    {
      date: 'December 26, 2025',
      items: [
        {
          title: 'Person detected',
          time: '3m ago',
          confidence: 97,
          status: 'ok',
        },
        {
          title: 'Vehicle detected',
          time: '45m ago',
          confidence: 84,
          status: 'ok',
        },
        {
          title: 'Building detected',
          time: '2h ago',
          confidence: 99,
          status: 'ok',
        },
        {
          title: 'Package detected',
          time: '5h ago',
          confidence: 88,
          status: 'ok',
        },
        {
          title: 'Box detected',
          time: '10h ago',
          confidence: 98,
          status: 'ok',
        },
        {
          title: 'Package detected with low confidence',
          time: '20h ago',
          confidence: 72,
          status: 'warn',
        },
      ],
    },
    {
      date: 'December 25, 2025',
      items: [
        {
          title: 'Car detected',
          time: 'Yesterday',
          confidence: 96,
          status: 'ok',
        },
      ],
    },
    {
      date: 'December 24, 2025',
      items: [
        {
          title: 'Vehicle detected',
          time: 'Dec 24',
          confidence: 94,
          status: 'ok',
        },
      ],
    },
    {
      date: 'December 23, 2025',
      items: [
        { title: 'Cat detected', time: 'Dec 23', confidence: 91, status: 'ok' },
      ],
    },
  ],
  setEvents: data => set({ events: data }),
}));
