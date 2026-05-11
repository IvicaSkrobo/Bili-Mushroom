// Edibility
export const EDIBILITY_VALUES = [
  'unknown', 'edible', 'edible_raw', 'conditionally_edible',
  'inedible', 'poisonous', 'deadly_poisonous',
] as const;
export type Edibility = typeof EDIBILITY_VALUES[number];

// Threat status (IUCN Red List) — ordered from least to most threatened
export const THREAT_STATUS_VALUES = [
  'unknown', 'ne', 'dd', 'lc', 'nt', 'vu', 'en', 'cr',
] as const;
export type ThreatStatus = typeof THREAT_STATUS_VALUES[number];

// Distribution frequency
export const DISTRIBUTION_VALUES = [
  'unknown', 'widespread', 'common', 'moderately_common',
  'sporadic', 'rare', 'extremely_rare',
] as const;
export type Distribution = typeof DISTRIBUTION_VALUES[number];

// ---------------------------------------------------------------------------
// Badge classes — light-mode-safe via dark: variants
// ---------------------------------------------------------------------------

export const EDIBILITY_BADGE_CLASSES: Record<Edibility, string> = {
  unknown:              'border border-border/50 bg-muted/40 text-muted-foreground',
  edible:               'border border-emerald-600/50 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  edible_raw:           'border border-teal-600/50 bg-teal-50 text-teal-800 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300',
  conditionally_edible: 'border border-yellow-600/50 bg-yellow-50 text-yellow-800 dark:border-yellow-500/35 dark:bg-yellow-500/10 dark:text-yellow-300',
  inedible:             'border border-amber-600/50 bg-amber-50 text-amber-800 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-200',
  poisonous:            'border border-rose-600/50 bg-rose-50 text-rose-800 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-200',
  deadly_poisonous:     'border border-red-700/60 bg-red-100 text-red-900 dark:border-red-600/40 dark:bg-red-900/20 dark:text-red-300',
};

export const THREAT_STATUS_BADGE_CLASSES: Record<ThreatStatus, string> = {
  unknown: 'border border-border/50 bg-muted/40 text-muted-foreground',
  ne:      'border border-stone-400/40 bg-stone-50 text-stone-600 dark:border-stone-500/25 dark:bg-stone-500/10 dark:text-stone-300',
  dd:      'border border-slate-400/40 bg-slate-50 text-slate-600 dark:border-slate-500/25 dark:bg-slate-500/10 dark:text-slate-300',
  lc:      'border border-emerald-600/50 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
  nt:      'border border-lime-600/50 bg-lime-50 text-lime-800 dark:border-lime-500/30 dark:bg-lime-500/10 dark:text-lime-300',
  vu:      'border border-yellow-600/50 bg-yellow-50 text-yellow-800 dark:border-yellow-500/35 dark:bg-yellow-500/10 dark:text-yellow-300',
  en:      'border border-orange-600/50 bg-orange-50 text-orange-800 dark:border-orange-500/35 dark:bg-orange-500/10 dark:text-orange-200',
  cr:      'border border-red-700/60 bg-red-100 text-red-900 dark:border-red-600/40 dark:bg-red-900/20 dark:text-red-300',
};

export const DISTRIBUTION_BADGE_CLASSES: Record<Distribution, string> = {
  unknown:           'border border-border/50 bg-muted/40 text-muted-foreground',
  widespread:        'border border-sky-600/50 bg-sky-50 text-sky-800 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300',
  common:            'border border-blue-600/50 bg-blue-50 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300',
  moderately_common: 'border border-indigo-600/50 bg-indigo-50 text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300',
  sporadic:          'border border-violet-600/50 bg-violet-50 text-violet-800 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-300',
  rare:              'border border-amber-600/50 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  extremely_rare:    'border border-rose-600/50 bg-rose-50 text-rose-800 dark:border-rose-600/35 dark:bg-rose-500/10 dark:text-rose-200',
};

// ---------------------------------------------------------------------------
// Normalize helpers — return 'unknown' for any unrecognized value
// ---------------------------------------------------------------------------

export function normalizeEdibility(raw?: string | null): Edibility {
  if (EDIBILITY_VALUES.includes(raw as Edibility)) return raw as Edibility;
  return 'unknown';
}

export function normalizeThreatStatus(raw?: string | null): ThreatStatus {
  if (THREAT_STATUS_VALUES.includes(raw as ThreatStatus)) return raw as ThreatStatus;
  return 'unknown';
}

export function normalizeDistribution(raw?: string | null): Distribution {
  if (DISTRIBUTION_VALUES.includes(raw as Distribution)) return raw as Distribution;
  return 'unknown';
}
