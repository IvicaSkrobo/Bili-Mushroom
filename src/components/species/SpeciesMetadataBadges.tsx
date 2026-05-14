import React, { useState } from 'react';
import { createPortal } from 'react-dom';
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
  conditionally_edible: AlertCircle,
  inedible:             InedibleIcon,
  poisonous:            AlertTriangle,
  deadly_poisonous:     Skull,
};

const THREAT_ICONS: Record<ThreatStatus, React.ElementType> = {
  unknown: CircleHelp,
  ne:      Minus,
  ua:      CircleHelp,
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
  /** Render icon-only chips (no text) with title tooltip — for compact contexts like map popups */
  iconOnly?: boolean;
}

export function SpeciesMetadataBadges({
  speciesProfile,
  size = 'md',
  hideUnknown = false,
  iconOnly = false,
}: SpeciesMetadataBadgesProps) {
  const t = useT();
  const edibility = normalizeEdibility(speciesProfile?.edibility);
  const threatStatus = normalizeThreatStatus(speciesProfile?.threat_status);
  const distribution = normalizeDistribution(speciesProfile?.distribution);

  const showEdibility = !hideUnknown || edibility !== 'unknown';
  const showThreat = !hideUnknown || threatStatus !== 'unknown';
  const showDistribution = !hideUnknown || distribution !== 'unknown';

  if (!showEdibility && !showThreat && !showDistribution) return null;

  const EdibilityIcon = EDIBILITY_ICONS[edibility];
  const ThreatIcon = THREAT_ICONS[threatStatus];
  const DistributionIcon = DISTRIBUTION_ICONS[distribution];

  if (iconOnly) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const [tip, setTip] = useState<{ label: string; x: number; y: number } | null>(null);
    const showTip = (e: React.MouseEvent, label: string) =>
      setTip({ label, x: e.clientX, y: e.clientY });
    const moveTip = (e: React.MouseEvent) =>
      setTip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev));
    const hideTip = () => setTip(null);

    return (
      <>
        <div className="flex gap-1">
          {showEdibility && (
            <span
              className={`inline-flex cursor-default items-center justify-center gap-0.5 rounded px-1 py-0.5 ${EDIBILITY_BADGE_CLASSES[edibility]}`}
              onMouseEnter={(e) => showTip(e, t(`edibility.${edibility}`))}
              onMouseMove={moveTip}
              onMouseLeave={hideTip}
            >
              {edibility === 'conditionally_edible' ? (
                <>
                  <Utensils className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <AlertCircle className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                </>
              ) : (
                <EdibilityIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
              )}
            </span>
          )}
          {showThreat && (
            <span
              className={`inline-flex cursor-default items-center justify-center rounded px-1 py-0.5 ${THREAT_STATUS_BADGE_CLASSES[threatStatus]}`}
              onMouseEnter={(e) => showTip(e, t(`threat.${threatStatus}`))}
              onMouseMove={moveTip}
              onMouseLeave={hideTip}
            >
              <ThreatIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
            </span>
          )}
          {showDistribution && (
            <span
              className={`inline-flex cursor-default items-center justify-center rounded px-1 py-0.5 ${DISTRIBUTION_BADGE_CLASSES[distribution]}`}
              onMouseEnter={(e) => showTip(e, t(`distribution.${distribution}`))}
              onMouseMove={moveTip}
              onMouseLeave={hideTip}
            >
              <DistributionIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
            </span>
          )}
        </div>
        {tip && createPortal(
          <div
            className="pointer-events-none fixed z-[99999] max-w-[220px] rounded-md border border-border/60 bg-popover px-2.5 py-1 text-[11px] leading-snug text-popover-foreground shadow-lg"
            style={{ left: tip.x + 14, top: tip.y - 32 }}
          >
            {tip.label}
          </div>,
          document.body,
        )}
      </>
    );
  }

  const sizeClass = size === 'sm'
    ? 'px-1.5 py-px text-[10px]'
    : 'px-2 py-0.5 text-[11px]';
  const iconClass = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

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
