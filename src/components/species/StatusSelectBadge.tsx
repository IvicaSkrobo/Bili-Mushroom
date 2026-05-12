import { AlertCircle, AlertTriangle, Check, ChevronDown, CircleHelp, Gem, Globe, Leaf, Minus, OctagonAlert, Skull, TrendingDown, Utensils } from 'lucide-react';
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
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

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

// ---------------------------------------------------------------------------
// Shared portal dropdown
// ---------------------------------------------------------------------------

interface DropdownOption {
  value: string;
  label: string;
  icon: React.ElementType;
  badgeClasses: string;
}

interface StatusDropdownProps {
  triggerRef: React.RefObject<HTMLDivElement | null>;
  options: DropdownOption[];
  value: string;
  onSelect: (v: string) => void;
  onClose: () => void;
}

function StatusDropdown({ triggerRef, options, value, onSelect, onClose }: StatusDropdownProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const [openUp, setOpenUp] = useState(false);

  useEffect(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const up = spaceBelow < 220;
    setOpenUp(up);
    setPos({
      top: up ? rect.top : rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 180),
      minWidth: rect.width,
    });
  }, [triggerRef]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, triggerRef]);

  if (!pos) return null;

  const panel = (
    <div
      ref={dropdownRef}
      style={{
        position: 'fixed',
        left: pos.left,
        minWidth: Math.max(pos.minWidth, 160),
        zIndex: 99999,
        ...(openUp ? { bottom: window.innerHeight - pos.top } : { top: pos.top }),
      }}
      className="
        rounded-lg border border-white/8 shadow-2xl overflow-hidden
        bg-[oklch(0.13_0.012_135)]
        animate-in fade-in-0 zoom-in-95 duration-100
      "
    >
      <div className="py-1">
        {options.map((opt) => {
          const Icon = opt.icon;
          const isSelected = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelect(opt.value);
                onClose();
              }}
              className="
                w-full flex items-center gap-2 px-2.5 py-1.5
                text-[11px] font-semibold tracking-wide
                transition-colors duration-75 cursor-pointer
                hover:bg-white/6 focus:outline-none focus:bg-white/8
              "
            >
              {/* Mini badge swatch — shows the option's color scheme */}
              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 ${opt.badgeClasses} flex-shrink-0`}>
                <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
              </span>
              <span className="text-foreground/85 flex-1 text-left">{opt.label}</span>
              {isSelected && (
                <Check className="h-3 w-3 text-primary flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  return ReactDOM.createPortal(panel, document.body);
}

// ---------------------------------------------------------------------------
// EdibilitySelectBadge
// ---------------------------------------------------------------------------

interface EdibilitySelectBadgeProps {
  value: string;
  onChange: (v: string) => void;
}

export function EdibilitySelectBadge({ value, onChange }: EdibilitySelectBadgeProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const edibility = normalizeEdibility(value);
  const Icon = EDIBILITY_ICONS[edibility];
  const handleClose = useCallback(() => setOpen(false), []);

  const options: DropdownOption[] = EDIBILITY_VALUES.map((v) => ({
    value: v,
    label: t(`edibility.${v}`),
    icon: EDIBILITY_ICONS[v],
    badgeClasses: EDIBILITY_BADGE_CLASSES[v],
  }));

  return (
    <>
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); } }}
        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold tracking-wide cursor-pointer select-none ${EDIBILITY_BADGE_CLASSES[edibility]}`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t(`edibility.${edibility}`)}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 opacity-60 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </div>
      {open && (
        <StatusDropdown
          triggerRef={triggerRef}
          options={options}
          value={value}
          onSelect={onChange}
          onClose={handleClose}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// ThreatStatusSelectBadge
// ---------------------------------------------------------------------------

interface ThreatStatusSelectBadgeProps {
  value: string;
  onChange: (v: string) => void;
}

export function ThreatStatusSelectBadge({ value, onChange }: ThreatStatusSelectBadgeProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const status = normalizeThreatStatus(value);
  const Icon = THREAT_ICONS[status];
  const handleClose = useCallback(() => setOpen(false), []);

  const options: DropdownOption[] = THREAT_STATUS_VALUES.map((v) => ({
    value: v,
    label: t(`threat.${v}`),
    icon: THREAT_ICONS[v],
    badgeClasses: THREAT_STATUS_BADGE_CLASSES[v],
  }));

  return (
    <>
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); } }}
        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold tracking-wide cursor-pointer select-none ${THREAT_STATUS_BADGE_CLASSES[status]}`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t(`threat.${status}`)}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 opacity-60 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </div>
      {open && (
        <StatusDropdown
          triggerRef={triggerRef}
          options={options}
          value={value}
          onSelect={onChange}
          onClose={handleClose}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// DistributionSelectBadge
// ---------------------------------------------------------------------------

interface DistributionSelectBadgeProps {
  value: string;
  onChange: (v: string) => void;
}

export function DistributionSelectBadge({ value, onChange }: DistributionSelectBadgeProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dist = normalizeDistribution(value);
  const Icon = DISTRIBUTION_ICONS[dist];
  const handleClose = useCallback(() => setOpen(false), []);

  const options: DropdownOption[] = DISTRIBUTION_VALUES.map((v) => ({
    value: v,
    label: t(`distribution.${v}`),
    icon: DISTRIBUTION_ICONS[v],
    badgeClasses: DISTRIBUTION_BADGE_CLASSES[v],
  }));

  return (
    <>
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        onMouseDown={(e) => { e.preventDefault(); setOpen((o) => !o); }}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen((o) => !o); } }}
        className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold tracking-wide cursor-pointer select-none ${DISTRIBUTION_BADGE_CLASSES[dist]}`}
      >
        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{t(`distribution.${dist}`)}</span>
        <ChevronDown className={`h-3 w-3 shrink-0 opacity-60 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </div>
      {open && (
        <StatusDropdown
          triggerRef={triggerRef}
          options={options}
          value={value}
          onSelect={onChange}
          onClose={handleClose}
        />
      )}
    </>
  );
}
