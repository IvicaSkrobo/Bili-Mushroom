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

// Tailwind class strings — theme-aware (light + dark)
export const EDIBILITY_BADGE_CLASSES: Record<Edibility, string> = {
  unknown:   'border border-border/50 bg-muted/50 text-muted-foreground',
  edible:    'border border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-400',
  inedible:  'border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  poisonous: 'border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400',
};

export const PROTECTED_STATUS_BADGE_CLASSES: Record<ProtectedStatus, string> = {
  unknown:       'border border-border/50 bg-muted/50 text-muted-foreground',
  not_protected: 'border border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  protected:     'border border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-400',
};

export function normalizeEdibility(raw?: string | null): Edibility {
  if (EDIBILITY_VALUES.includes(raw as Edibility)) return raw as Edibility;
  return 'unknown';
}

export function normalizeProtectedStatus(raw?: string | null): ProtectedStatus {
  if (PROTECTED_STATUS_VALUES.includes(raw as ProtectedStatus)) return raw as ProtectedStatus;
  return 'unknown';
}
