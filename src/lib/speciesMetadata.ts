export const EDIBILITY_VALUES = ['unknown', 'edible', 'inedible', 'poisonous'] as const;
export type Edibility = typeof EDIBILITY_VALUES[number];

export const PROTECTED_STATUS_VALUES = ['unknown', 'not_protected', 'protected'] as const;
export type ProtectedStatus = typeof PROTECTED_STATUS_VALUES[number];

export const EDIBILITY_LABELS: Record<Edibility, string> = {
  unknown: 'Unknown',
  edible: 'Edible',
  inedible: 'Inedible',
  poisonous: 'Poisonous',
};

export const PROTECTED_STATUS_LABELS: Record<ProtectedStatus, string> = {
  unknown: 'Unknown',
  not_protected: 'Not Protected',
  protected: 'Protected',
};

// Forest Codex badge colors (hex — WebView2 safe, no oklch)
export const EDIBILITY_BADGE_STYLE: Record<Edibility, { bg: string; text: string }> = {
  unknown:   { bg: '#2a2a2a', text: '#a0a0a0' },
  edible:    { bg: '#1a3320', text: '#6fcf7c' },
  inedible:  { bg: '#3a2a10', text: '#c9933a' },
  poisonous: { bg: '#3a1010', text: '#e05a5a' },
};

export const PROTECTED_STATUS_BADGE_STYLE: Record<ProtectedStatus, { bg: string; text: string }> = {
  unknown:       { bg: '#2a2a2a', text: '#a0a0a0' },
  not_protected: { bg: '#1a1f2a', text: '#7090c0' },
  protected:     { bg: '#2a1a3a', text: '#b07ad4' },
};

export function normalizeEdibility(raw?: string | null): Edibility {
  if (EDIBILITY_VALUES.includes(raw as Edibility)) return raw as Edibility;
  return 'unknown';
}

export function normalizeProtectedStatus(raw?: string | null): ProtectedStatus {
  if (PROTECTED_STATUS_VALUES.includes(raw as ProtectedStatus)) return raw as ProtectedStatus;
  return 'unknown';
}
