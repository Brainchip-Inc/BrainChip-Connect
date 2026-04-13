// batteryState.ts
export enum BatteryState {
  NotCharging = 0,
  Charging = 1,
  Warning = 2, // Faulty recoverable
  Fault = 3, // Faulty non recoverable
}

// Centralized string constants
export const BatteryStateStrings = {
  NotCharging: 'Not Charging',
  Charging: 'Charging',
  Warning: 'Warning',
  Fault: 'Fault',
  Unknown: 'Unknown',
} as const;

// Map enum -> string
export const BatteryStateLabel: Record<BatteryState, string> = {
  [BatteryState.NotCharging]: BatteryStateStrings.NotCharging,
  [BatteryState.Charging]: BatteryStateStrings.Charging,
  [BatteryState.Warning]: BatteryStateStrings.Warning,
  [BatteryState.Fault]: BatteryStateStrings.Fault,
};

// Helper function
export function getBatteryLabel(state: BatteryState | number | null) {
  if (state === null || state === undefined) return BatteryStateStrings.Unknown;
  return (
    BatteryStateLabel[state as BatteryState] ?? BatteryStateStrings.Unknown
  );
}
