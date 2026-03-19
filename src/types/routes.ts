export const ROUTES = {
  HOME: 'Home',
  NOTIFICATIONS: 'Notifications',
  SETTINGS: 'Settings',
  PROFILE: 'Profile',
} as const;

export type RouteName = (typeof ROUTES)[keyof typeof ROUTES];
