import React from 'react';
import type { SpeciesProfile } from '@/lib/finds';
import { CircleHelp, ShieldCheck, ShieldOff, Skull, Sparkles, Utensils } from 'lucide-react';
import {
  normalizeEdibility,
  normalizeProtectedStatus,
  EDIBILITY_LABELS,
  PROTECTED_STATUS_LABELS,
  EDIBILITY_BADGE_CLASSES,
  PROTECTED_STATUS_BADGE_CLASSES,
} from '@/lib/speciesMetadata';

/** Plate + fork/knife with a full diagonal strike so "not for eating" reads clearly at badge size. */
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
      <circle cx="12" cy="13" r="3.5" />
      <path d="M5 3.5v7.5" />
      <path d="M3.8 3.5v3.8" />
      <path d="M6.2 3.5v3.8" />
      <path d="M3.8 7.3h2.4" />
      <path d="M17 3.5c1.2 1.5 1.8 3.2 1.8 5.2V11" />
      <path d="M17 3.5V11" />
      <path d="M16.1 21 7 3" />
      <path d="M20.5 4 4 20.5" />
    </svg>
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
