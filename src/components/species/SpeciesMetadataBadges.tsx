import React from 'react';
import type { SpeciesProfile } from '@/lib/finds';
import { AlertCircle, AlertTriangle, CircleHelp, Gem, Globe, Leaf, Minus, OctagonAlert, Skull, TrendingDown, Utensils } from 'lucide-react';
import {
  normalizeEdibility,
  normalizeThreatStatus,
  normalizeDistribution,
  EDIBILITY_BADGE_CLASSES,
  THREAT_STATUS_BADGE_CLASSES,
  DISTRIBUTION_BADGE_CLASSES,
  type Edibility,
  type ThreatStatus,
  type Distribution,
} from '@/lib/speciesMetadata';
import { useT } from '@/i18n/index';

/** Plate with a single prohibition slash — clearer than utensils at small badge size. */
function InedibleIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      data-testid="inedible-icon"
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
  poisonous:            AlertTriangle,
  deadly_poisonous:     Skull,
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

interface SpeciesMetadataBadgesProps {
  speciesProfile?: SpeciesProfile | null;
  /** 'sm' = compact inline badges (FindCard / inline rows), 'md' = slightly larger (header/popup/lightbox) */
  size?: 'sm' | 'md';
  /** Only show badges that have non-unknown values */
  hideUnknown?: boolean;
}

export function SpeciesMetadataBadges({
  speciesProfile,
  size = 'md',
  hideUnknown = false,
}: SpeciesMetadataBadgesProps) {
  const t = useT();
  const edibility = normalizeEdibility(speciesProfile?.edibility);
  const threatStatus = normalizeThreatStatus(speciesProfile?.threat_status);
  const distribution = normalizeDistribution(speciesProfile?.distribution);

  const showEdibility = !hideUnknown || edibility !== 'unknown';
  const showThreat = !hideUnknown || threatStatus !== 'unknown';
  const showDistribution = !hideUnknown || distribution !== 'unknown';

  if (!showEdibility && !showThreat && !showDistribution) return null;

  const sizeClass = size === 'sm'
    ? 'px-1.5 py-px text-[10px]'
    : 'px-2 py-0.5 text-[11px]';
  const iconClass = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  const EdibilityIcon = EDIBILITY_ICONS[edibility];
  const ThreatIcon = THREAT_ICONS[threatStatus];
  const DistributionIcon = DISTRIBUTION_ICONS[distribution];

  return (
    <div className="flex flex-wrap gap-1">
      {showEdibility && (
        <span className={`inline-flex items-center rounded font-semibold tracking-wide ${sizeClass} ${EDIBILITY_BADGE_CLASSES[edibility]}`}>
          {edibility === 'conditionally_edible' ? (
            <span className="mr-1 inline-flex shrink-0 items-center gap-0.5" aria-hidden="true">
              <Utensils className={iconClass} />
              <AlertCircle className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
            </span>
          ) : (
            <EdibilityIcon className={`${iconClass} mr-1 shrink-0`} aria-hidden="true" />
          )}
          {t(`edibility.${edibility}`)}
        </span>
      )}
      {showThreat && (
        <span className={`inline-flex items-center rounded font-semibold tracking-wide ${sizeClass} ${THREAT_STATUS_BADGE_CLASSES[threatStatus]}`}>
          <ThreatIcon className={`${iconClass} mr-1 shrink-0`} aria-hidden="true" />
          {t(`threat.${threatStatus}`)}
        </span>
      )}
      {showDistribution && (
        <span className={`inline-flex items-center rounded font-semibold tracking-wide ${sizeClass} ${DISTRIBUTION_BADGE_CLASSES[distribution]}`}>
          <DistributionIcon className={`${iconClass} mr-1 shrink-0`} aria-hidden="true" />
          {t(`distribution.${distribution}`)}
        </span>
      )}
    </div>
  );
}
