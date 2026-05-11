import { AlertCircle, AlertTriangle, ChevronDown, CircleHelp, Gem, Globe, Leaf, Minus, OctagonAlert, Skull, TrendingDown, Utensils } from 'lucide-react';
import {
  EDIBILITY_VALUES,
  THREAT_STATUS_VALUES,
  DISTRIBUTION_VALUES,
  EDIBILITY_BADGE_CLASSES,
  THREAT_STATUS_BADGE_CLASSES,
  DISTRIBUTION_BADGE_CLASSES,
  normalizeEdibility,
  normalizeThreatStatus,
  normalizeDistribution,
  type Edibility,
  type ThreatStatus,
  type Distribution,
} from '@/lib/speciesMetadata';
import { useT } from '@/i18n/index';
import React from 'react';

/** Plate with a single prohibition slash. */
function InedibleIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12.5" r="3.4" />
      <path d="M7.8 8.2h8.4" />
      <path d="M18.2 5.8 5.8 18.2" />
    </svg>
  );
}

const EDIBILITY_ICONS: Record<Edibility, React.ElementType> = {
  unknown:              CircleHelp,
  edible:               Utensils,
  edible_raw:           Leaf,
  conditionally_edible: AlertCircle,
  inedible:             InedibleIcon,
  poisonous:            Skull,
  deadly_poisonous:     AlertTriangle,
};

const THREAT_ICONS: Record<ThreatStatus, React.ElementType> = {
  unknown: CircleHelp,
  ne:      Minus,
  dd:      CircleHelp,
  lc:      Leaf,
  nt:      TrendingDown,
  vu:      AlertCircle,
  en:      AlertTriangle,
  cr:      OctagonAlert,
};

const DISTRIBUTION_ICONS: Record<Distribution, React.ElementType> = {
  unknown:           CircleHelp,
  widespread:        Globe,
  common:            Globe,
  moderately_common: Globe,
  sporadic:          Gem,
  rare:              Gem,
  extremely_rare:    Gem,
};

interface EdibilitySelectBadgeProps {
  value: string;
  onChange: (v: string) => void;
}

export function EdibilitySelectBadge({ value, onChange }: EdibilitySelectBadgeProps) {
  const t = useT();
  const edibility = normalizeEdibility(value);
  const Icon = EDIBILITY_ICONS[edibility];

  return (
    <div
      className={`relative inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold tracking-wide cursor-pointer select-none ${EDIBILITY_BADGE_CLASSES[edibility]}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{t(`edibility.${edibility}`)}</span>
      <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        aria-label={t('species.edibility')}
      >
        {EDIBILITY_VALUES.map((v) => (
          <option key={v} value={v}>{t(`edibility.${v}`)}</option>
        ))}
      </select>
    </div>
  );
}

interface ThreatStatusSelectBadgeProps {
  value: string;
  onChange: (v: string) => void;
}

export function ThreatStatusSelectBadge({ value, onChange }: ThreatStatusSelectBadgeProps) {
  const t = useT();
  const status = normalizeThreatStatus(value);
  const Icon = THREAT_ICONS[status];

  return (
    <div
      className={`relative inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold tracking-wide cursor-pointer select-none ${THREAT_STATUS_BADGE_CLASSES[status]}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{t(`threat.${status}`)}</span>
      <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        aria-label={t('species.threatStatus')}
      >
        {THREAT_STATUS_VALUES.map((v) => (
          <option key={v} value={v}>{t(`threat.${v}`)}</option>
        ))}
      </select>
    </div>
  );
}

interface DistributionSelectBadgeProps {
  value: string;
  onChange: (v: string) => void;
}

export function DistributionSelectBadge({ value, onChange }: DistributionSelectBadgeProps) {
  const t = useT();
  const dist = normalizeDistribution(value);
  const Icon = DISTRIBUTION_ICONS[dist];

  return (
    <div
      className={`relative inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold tracking-wide cursor-pointer select-none ${DISTRIBUTION_BADGE_CLASSES[dist]}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{t(`distribution.${dist}`)}</span>
      <ChevronDown className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        aria-label={t('species.distribution')}
      >
        {DISTRIBUTION_VALUES.map((v) => (
          <option key={v} value={v}>{t(`distribution.${v}`)}</option>
        ))}
      </select>
    </div>
  );
}
