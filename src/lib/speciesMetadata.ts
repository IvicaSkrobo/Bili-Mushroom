export const EDIBILITY_VALUES = ['unknown', 'edible', 'inedible', 'poisonous', 'psychedelic'] as const;
export type Edibility = typeof EDIBILITY_VALUES[number];

export const PROTECTED_STATUS_VALUES = ['unknown', 'not_protected', 'protected'] as const;
export type ProtectedStatus = typeof PROTECTED_STATUS_VALUES[number];

export const EDIBILITY_LABELS: Record<Edibility, string> = {
  unknown: 'Nepoznato',
  edible: 'Može se jesti',
  inedible: 'Nije za jelo',
  poisonous: 'Opasno / otrovno',
  psychedelic: 'Psihoaktivno',
};

export const PROTECTED_STATUS_LABELS: Record<ProtectedStatus, string> = {
  unknown: 'Unknown',
  not_protected: 'Not Protected',
  protected: 'Protected',
};

// Forest Codex badge styling keeps the status readable without breaking the moss/amber palette.
export const EDIBILITY_BADGE_CLASSES: Record<Edibility, string> = {
  unknown:     'border border-border/50 bg-muted/40 text-muted-foreground',
  edible:      'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  inedible:    'border border-amber-500/35 bg-amber-500/10 text-amber-200',
  poisonous:   'border border-rose-500/35 bg-rose-500/10 text-rose-200',
  psychedelic: 'border border-purple-500/35 bg-purple-500/10 text-purple-300',
};

export const PROTECTED_STATUS_BADGE_CLASSES: Record<ProtectedStatus, string> = {
  unknown:       'border border-border/50 bg-muted/40 text-muted-foreground',
  not_protected: 'border border-stone-400/25 bg-stone-500/10 text-stone-200',
  protected:     'border border-amber-500/35 bg-amber-500/12 text-amber-100',
};

export function normalizeEdibility(raw?: string | null): Edibility {
  if (EDIBILITY_VALUES.includes(raw as Edibility)) return raw as Edibility;
  return 'unknown';
}

export function normalizeProtectedStatus(raw?: string | null): ProtectedStatus {
  if (PROTECTED_STATUS_VALUES.includes(raw as ProtectedStatus)) return raw as ProtectedStatus;
  return 'unknown';
}
