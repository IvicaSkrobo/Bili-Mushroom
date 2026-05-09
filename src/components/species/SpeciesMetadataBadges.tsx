import type { SpeciesProfile } from '@/lib/finds';
import {
  normalizeEdibility,
  normalizeProtectedStatus,
  EDIBILITY_LABELS,
  PROTECTED_STATUS_LABELS,
  EDIBILITY_BADGE_STYLE,
  PROTECTED_STATUS_BADGE_STYLE,
} from '@/lib/speciesMetadata';

interface SpeciesMetadataBadgesProps {
  speciesProfile?: SpeciesProfile | null;
  /** 'sm' = compact inline badges (FindCard), 'md' = slightly larger (header/popup/lightbox) */
  size?: 'sm' | 'md';
  /** Only show badges that have non-unknown values */
  hideUnknown?: boolean;
}

export function SpeciesMetadataBadges({
  speciesProfile,
  size = 'md',
  hideUnknown = false,
}: SpeciesMetadataBadgesProps) {
  const edibility = normalizeEdibility(speciesProfile?.edibility);
  const protected_status = normalizeProtectedStatus(speciesProfile?.protected_status);

  const showEdibility = !hideUnknown || edibility !== 'unknown';
  const showProtected = !hideUnknown || protected_status !== 'unknown';

  if (!showEdibility && !showProtected) return null;

  const padding = size === 'sm' ? '1px 6px' : '2px 8px';
  const fontSize = size === 'sm' ? '10px' : '11px';
  const borderRadius = '4px';
  const fontFamily = 'DM Sans, sans-serif';
  const fontWeight = '600';
  const letterSpacing = '0.04em';

  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {showEdibility && (
        <span
          style={{
            background: EDIBILITY_BADGE_STYLE[edibility].bg,
            color: EDIBILITY_BADGE_STYLE[edibility].text,
            padding,
            fontSize,
            borderRadius,
            fontFamily,
            fontWeight,
            letterSpacing,
          }}
        >
          {EDIBILITY_LABELS[edibility]}
        </span>
      )}
      {showProtected && (
        <span
          style={{
            background: PROTECTED_STATUS_BADGE_STYLE[protected_status].bg,
            color: PROTECTED_STATUS_BADGE_STYLE[protected_status].text,
            padding,
            fontSize,
            borderRadius,
            fontFamily,
            fontWeight,
            letterSpacing,
          }}
        >
          {PROTECTED_STATUS_LABELS[protected_status]}
        </span>
      )}
    </div>
  );
}
