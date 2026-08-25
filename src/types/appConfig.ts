// Keyword Spotting runtime parameters, addressable over CMD_CONFIG (opcode 4).
// Firmware is the source of truth; the phone is a live mirror.

export type KwsParamId = 0 | 1 | 2 | 3 | 4 | 5;

export type KwsParamKind = 'int' | 'float';

export type KwsParamName =
  | 'rms_threshold'
  | 'debounce_time_ms'
  | 'smoothing_alpha'
  | 'score_threshold'
  | 'chiming_threshold'
  | 'speech_timeout_ms';

export interface KwsParamMeta {
  id: KwsParamId;
  name: KwsParamName;
  label: string;
  kind: KwsParamKind;
  min: number;
  max?: number;
  default: number;
  unit?: string;
}

export const KWS_PARAMS: readonly KwsParamMeta[] = [
  { id: 0, name: 'rms_threshold',     label: 'RMS threshold',     kind: 'int',   min: 0,         default: 550 },
  { id: 1, name: 'debounce_time_ms',  label: 'Debounce time',     kind: 'int',   min: 0,         default: 300,  unit: 'ms' },
  { id: 2, name: 'smoothing_alpha',   label: 'Smoothing alpha',   kind: 'float', min: 0, max: 1, default: 0.70 },
  { id: 3, name: 'score_threshold',   label: 'Score threshold',   kind: 'float', min: 0, max: 1, default: 0.50 },
  { id: 4, name: 'chiming_threshold', label: 'Chiming threshold', kind: 'int',   min: 1,         default: 3 },
  { id: 5, name: 'speech_timeout_ms', label: 'Speech timeout',    kind: 'int',   min: 0,         default: 1300, unit: 'ms' },
] as const;

export type KwsConfig = Partial<Record<KwsParamId, number>>;

export const formatKwsValue = (meta: KwsParamMeta, value: number): string =>
  meta.kind === 'float' ? value.toFixed(2) : String(Math.trunc(value));

export const parseKwsValue = (
  meta: KwsParamMeta,
  raw: string,
): number | null => {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = meta.kind === 'float' ? parseFloat(trimmed) : parseInt(trimmed, 10);
  if (!Number.isFinite(n)) return null;
  if (meta.kind === 'int' && !Number.isInteger(Number(trimmed))) return null;
  if (n < meta.min) return null;
  if (meta.max !== undefined && n > meta.max) return null;
  return n;
};
