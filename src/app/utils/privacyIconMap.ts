import {
  Bluetooth,
  Cpu,
  Bell,
  Database,
  KeyRound,
  User2,
  ShieldCheck,
  HelpCircle,
  Lock,
  Snowflake,
  Map,
} from 'lucide-react-native';

export const iconMap: Record<string, any> = {
  bluetooth: Bluetooth,
  cpu: Cpu,
  bell: Bell,
  database: Database,
  key: KeyRound,
  person: User2,
  'shield-lock': ShieldCheck,
  'question-circle': HelpCircle,
  lock: Lock,
  default: Snowflake,
  'geo-alt': Map,
};
