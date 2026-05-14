import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { SpeciesStatSummary } from '@/lib/stats';
import { plainSpeciesName, renderSpeciesName } from '@/lib/speciesName';
import { useT } from '@/i18n/index';
import { useAppStore } from '@/stores/appStore';

interface SpeciesStatRowProps {
  stat: SpeciesStatSummary;
  rank: number;
  index: number;
}

function formatObserved(min: number | null, max: number | null): string {
  if (min == null && max == null) return '--';
  if (min === max || max == null) return String(min ?? max!);
  return `${min}–${max}`;
}

export function SpeciesStatRow({ stat, rank, index }: SpeciesStatRowProps) {
  const t = useT();
  const lang = useAppStore((s) => s.language);
  const locale = lang === 'hr' ? 'hr-HR' : 'en-US';
  const [isOpen, setIsOpen] = useState(false);

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
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
      >
        <span className="font-serif italic text-sm text-primary w-6 shrink-0">#{rank}</span>
        <span
          className="font-serif text-sm font-semibold italic text-foreground truncate flex-1"
          title={plainSpeciesName(stat.species_name)}
        >
          {renderSpeciesName(stat.species_name)}
        </span>
        <Badge variant="outline" className="text-xs text-primary border-primary/40 shrink-0">
          {stat.find_count}
        </Badge>
        {isOpen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ${
          isOpen ? 'max-h-96' : 'max-h-0'
        }`}
      >
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-border/50">
          <div className="flex gap-8 flex-wrap">
            <div>
              <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                {t('stats.totalFinds')}
              </span>
              <p className="text-sm text-foreground">{stat.find_count}</p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                {t('stats.firstFind')}
              </span>
              <p className="text-sm text-foreground">{stat.first_find}</p>
            </div>
            <div>
              <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                {t('stats.bestMonth')}
              </span>
              <p className="text-sm text-foreground">
                {stat.best_month ? formatBestMonth(stat.best_month) : '--'}
              </p>
            </div>
            {(stat.observed_min != null || stat.observed_max != null) && (
              <div>
                <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  {t('stats.fruitingBodies')}
                </span>
                <p className="text-sm text-foreground">
                  {formatObserved(stat.observed_min, stat.observed_max)}
                </p>
              </div>
            )}
          </div>
          <div>
            <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {t('stats.locations')}
            </span>
            <div className="mt-1 space-y-0.5">
              {stat.locations.map((loc, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  {loc.country} / {loc.region}
                  {loc.location_note ? ` / ${loc.location_note}` : ''}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
