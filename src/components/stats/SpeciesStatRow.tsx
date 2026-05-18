import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { SpeciesMetadataBadges } from '@/components/species/SpeciesMetadataBadges';
import type { Find, SpeciesProfile } from '@/lib/finds';
import type { SpeciesStatSummary } from '@/lib/stats';
import { normalizeCommonName, plainSpeciesName, renderSpeciesName } from '@/lib/speciesName';
import { useT } from '@/i18n/index';
import { useAppStore } from '@/stores/appStore';
import { formatDisplayDate } from '@/lib/dateFormat';

interface SpeciesStatRowProps {
  stat: SpeciesStatSummary;
  rank: number;
  index: number;
  finds?: Find[];
  speciesProfile?: SpeciesProfile | null;
}

function formatObserved(min: number | null, max: number | null): string {
  if (min == null && max == null) return '--';
  if (min === max || max == null) return String(min ?? max);
  return `${min}-${max}`;
}

function locationLabel(find: Pick<Find, 'country' | 'region' | 'location_note'>): string {
  return [find.location_note, find.region, find.country].filter(Boolean).join(' / ');
}

function formatMonthShort(month: number): string {
  return ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][month - 1] ?? String(month);
}

export function SpeciesStatRow({ stat, rank, index, finds = [], speciesProfile }: SpeciesStatRowProps) {
  const t = useT();
  const lang = useAppStore((s) => s.language);
  const locale = lang === 'hr' ? 'hr-HR' : 'en-US';
  const [isOpen, setIsOpen] = useState(false);

  const commonName = normalizeCommonName(speciesProfile?.common_name, stat.species_name);
  const speciesFinds = finds
    .filter((find) => find.species_name === stat.species_name)
    .sort((a, b) => a.date_found.localeCompare(b.date_found));
  const firstFindDate = speciesFinds[0]?.date_found ?? stat.first_find;
  const lastFindDate = speciesFinds[speciesFinds.length - 1]?.date_found ?? stat.first_find;
  const activeMonths = Array.from(new Set(
    speciesFinds
      .map((find) => Number.parseInt(find.date_found.slice(5, 7), 10))
      .filter((month) => Number.isInteger(month) && month >= 1 && month <= 12),
  )).sort((a, b) => a - b);
  const locations = Array.from(speciesFinds.reduce((map, find) => {
    const label = locationLabel(find) || t('stats.noLocation');
    const existing = map.get(label) ?? { label, count: 0, lastFound: find.date_found };
    existing.count += 1;
    if (find.date_found > existing.lastFound) existing.lastFound = find.date_found;
    map.set(label, existing);
    return map;
  }, new Map<string, { label: string; count: number; lastFound: string }>()).values())
    .sort((a, b) => (
      b.count - a.count
      || b.lastFound.localeCompare(a.lastFound)
      || a.label.localeCompare(b.label, 'hr', { sensitivity: 'base' })
    ));

  function formatBestMonth(ym: string): string {
    const [yearStr, monthStr] = ym.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    if (isNaN(year) || isNaN(month)) return ym;
    return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
      new Date(year, month - 1),
    );
  }

  return (
    <div
      className={`stagger-item overflow-hidden rounded-sm border transition-all duration-200 ${
        isOpen
          ? 'border-primary/60 border-l-[3px] bg-muted'
          : 'border-border bg-card shadow-sm hover:border-primary/40 hover:shadow-md'
      }`}
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        <span className="w-6 shrink-0 font-serif text-sm italic text-primary">#{rank}</span>
        <span
          className="flex-1 truncate font-serif text-sm font-semibold italic text-foreground"
          title={plainSpeciesName(stat.species_name)}
        >
          {renderSpeciesName(stat.species_name)}
        </span>
        <Badge variant="outline" className="shrink-0 border-primary/40 text-xs text-primary">
          {stat.find_count}
        </Badge>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <div className={`overflow-hidden transition-all duration-200 ${isOpen ? 'max-h-[720px]' : 'max-h-0'}`}>
        <div className="space-y-3 border-t border-border/50 px-4 pb-4 pt-3">
          {(commonName || speciesProfile) && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              {commonName ? (
                <p className="text-xs font-medium text-muted-foreground">{commonName}</p>
              ) : (
                <span />
              )}
              <SpeciesMetadataBadges speciesProfile={speciesProfile ?? undefined} size="sm" hideUnknown={true} />
            </div>
          )}

          <div className="flex flex-wrap gap-x-12 gap-y-3">
            <InlineStat label={t('stats.totalFinds')} value={stat.find_count} />
            <InlineStat label={t('stats.firstFind')} value={formatDisplayDate(firstFindDate, lang) || '--'} />
            <InlineStat label={t('stats.lastFind')} value={formatDisplayDate(lastFindDate, lang) || '--'} />
            <InlineStat label={t('stats.bestMonth')} value={stat.best_month ? formatBestMonth(stat.best_month) : '--'} />
            <InlineStat label={t('stats.activeMonths')} value={activeMonths.length ? activeMonths.map(formatMonthShort).join(' ') : '--'} />
            {(stat.observed_min != null || stat.observed_max != null) && (
              <InlineStat label={t('stats.fruitingBodies')} value={formatObserved(stat.observed_min, stat.observed_max)} />
            )}
          </div>

          <div>
            <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {t('stats.locations')}
            </span>
            <div className="mt-1 space-y-1">
              {(locations.length > 0 ? locations : stat.locations.map((loc) => ({
                label: [loc.location_note, loc.region, loc.country].filter(Boolean).join(' / ') || t('stats.noLocation'),
                count: 0,
                lastFound: stat.first_find,
              }))).map((loc) => (
                <p key={`${loc.label}-${loc.lastFound}`} className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
                  <span className="min-w-0 truncate" title={loc.label}>{loc.label}</span>
                  <span className="shrink-0 text-right">
                    {loc.count > 0 ? `${t('stats.outingFindCount', { finds: loc.count })} - ` : ''}
                    {t('stats.lastSeen', { date: formatDisplayDate(loc.lastFound, lang) || '--' })}
                  </span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-[130px]">
      <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </span>
      <p className="mt-1 truncate text-sm text-foreground" title={String(value)}>
        {value}
      </p>
    </div>
  );
}
