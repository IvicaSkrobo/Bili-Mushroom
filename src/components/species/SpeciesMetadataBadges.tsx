import type { SpeciesProfile } from '@/lib/finds';
import {
  normalizeEdibility,
  normalizeProtectedStatus,
  EDIBILITY_LABELS,
  PROTECTED_STATUS_LABELS,
  EDIBILITY_BADGE_CLASSES,
  PROTECTED_STATUS_BADGE_CLASSES,
} from '@/lib/speciesMetadata';

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
  const edibility = normalizeEdibility(speciesProfile?.edibility);
  const protectedStatus = normalizeProtectedStatus(speciesProfile?.protected_status);

  const showEdibility = !hideUnknown || edibility !== 'unknown';
  const showProtected = !hideUnknown || protectedStatus !== 'unknown';

  if (!showEdibility && !showProtected) return null;

  const sizeClass = size === 'sm'
    ? 'px-1.5 py-px text-[10px]'
    : 'px-2 py-0.5 text-[11px]';

  return (
    <div className="flex flex-wrap gap-1">
      {showEdibility && (
        <span className={`inline-flex items-center rounded font-semibold tracking-wide ${sizeClass} ${EDIBILITY_BADGE_CLASSES[edibility]}`}>
          {EDIBILITY_LABELS[edibility]}
        </span>
      )}
      {showProtected && (
        <span className={`inline-flex items-center rounded font-semibold tracking-wide ${sizeClass} ${PROTECTED_STATUS_BADGE_CLASSES[protectedStatus]}`}>
          {PROTECTED_STATUS_LABELS[protectedStatus]}
        </span>
      )}
    </div>
  );
}
