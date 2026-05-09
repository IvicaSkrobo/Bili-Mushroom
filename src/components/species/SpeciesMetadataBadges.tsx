import React from 'react';
import type { SpeciesProfile } from '@/lib/finds';
import { CircleHelp, ShieldCheck, ShieldOff, Skull, Sparkles, Utensils, X } from 'lucide-react';
import {
  normalizeEdibility,
  normalizeProtectedStatus,
  EDIBILITY_LABELS,
  PROTECTED_STATUS_LABELS,
  EDIBILITY_BADGE_CLASSES,
  PROTECTED_STATUS_BADGE_CLASSES,
} from '@/lib/speciesMetadata';

/** Utensils (fork + knife) with a small X badge overlay — visually "not edible" */
function InedibleIcon({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span className={`relative inline-flex shrink-0 ${className ?? ''}`} aria-hidden="true" {...props}>
      <Utensils className="h-full w-full" />
      <X className="absolute -bottom-0.5 -right-0.5 h-[55%] w-[55%] stroke-[3]" />
    </span>
  );
}

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
  const iconClass = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  const EdibilityIcon = {
    unknown:     CircleHelp,
    edible:      Utensils,
    inedible:    InedibleIcon,
    poisonous:   Skull,
    psychedelic: Sparkles,
  }[edibility];

  const ProtectedIcon = {
    unknown: CircleHelp,
    not_protected: ShieldOff,
    protected: ShieldCheck,
  }[protectedStatus];

  return (
    <div className="flex flex-wrap gap-1">
      {showEdibility && (
        <span className={`inline-flex items-center rounded font-semibold tracking-wide ${sizeClass} ${EDIBILITY_BADGE_CLASSES[edibility]}`}>
          <EdibilityIcon className={`${iconClass} mr-1 shrink-0`} aria-hidden="true" />
          {EDIBILITY_LABELS[edibility]}
        </span>
      )}
      {showProtected && (
        <span className={`inline-flex items-center rounded font-semibold tracking-wide ${sizeClass} ${PROTECTED_STATUS_BADGE_CLASSES[protectedStatus]}`}>
          <ProtectedIcon className={`${iconClass} mr-1 shrink-0`} aria-hidden="true" />
          {PROTECTED_STATUS_LABELS[protectedStatus]}
        </span>
      )}
    </div>
  );
}
