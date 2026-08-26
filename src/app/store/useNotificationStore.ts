import { create } from 'zustand';

interface NotificationItem {
  title: string;
  msg: string;
  conf: string;
  time: string;
}

interface NotificationSection {
  date: string;
  items: NotificationItem[];
}

interface NotificationsState {
  notifications: NotificationSection[];
  setNotifications: (data: NotificationSection[]) => void;
  muteStatus: boolean; // Global mute status for notifications
  updateMuteStatus: (status: boolean) => void; // Function to update mute status
}

export const useNotificationsStore = create<NotificationsState>(set => ({
  notifications: [
    {
      date: 'December 26, 2026',
      items: [
        {
          title: 'Vision Lite',
          msg: 'Building detected',
          conf: '96%',
          time: '7m ago',
        },
        {
          title: 'Keyword Spotting',
          msg: 'Detected: "Hey BrainChip"',
          conf: '94%',
          time: '2h ago',
        },
        {
          title: 'Vision Lite',
          msg: 'Person detected',
          conf: '97%',
          time: '3h ago',
        },
        {
          title: 'Anomaly Detection',
          msg: 'Unusual vibration pattern detected',
          conf: '87%',
          time: '5h ago',
        },
      ],
    },
    {
      date: 'December 25, 2026',
      items: [
        {
          title: 'IMU Gesture',
          msg: 'Gesture recognized: Shake',
          conf: '92%',
          time: 'Yesterday',
        },
        {
          title: 'Vision Lite',
          msg: 'Package detected',
          conf: '89%',
          time: 'Yesterday',
        },
        {
          title: 'Keyword Spotting',
          msg: 'Detected: "Stop"',
          conf: '88%',
          time: 'Yesterday',
        },
      ],
    },
    {
      date: 'December 24, 2026',
      items: [
        {
          title: 'Anomaly Detection',
          msg: 'Temperature anomaly detected',
          conf: '91%',
          time: 'Dec 24',
        },
      ],
    },
  ],
  setNotifications: data => set({ notifications: data }),
  muteStatus: false,
  updateMuteStatus: status => set({ muteStatus: status }),
}));
