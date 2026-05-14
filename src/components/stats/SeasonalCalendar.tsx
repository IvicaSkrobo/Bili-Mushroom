import { useState, useMemo, type ReactNode } from 'react';
import type { CalendarEntry } from '@/lib/stats';
import { plainSpeciesName, renderSpeciesName } from '@/lib/speciesName';
import { useT } from '@/i18n/index';
import { useAppStore } from '@/stores/appStore';

interface SeasonalCalendarProps {
  entries: CalendarEntry[];
}

export function SeasonalCalendar({ entries }: SeasonalCalendarProps) {
  const t = useT();
  const lang = useAppStore((s) => s.language);
  const locale = lang === 'hr' ? 'hr-HR' : 'en-US';

  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

  function monthLabel(m: number): string {
    return new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, m - 1));
  }

  const monthBuckets = useMemo(() => {
    const buckets: Map<number, { species: Set<string>; entries: CalendarEntry[] }> = new Map();
    for (let m = 1; m <= 12; m++) {
      buckets.set(m, { species: new Set(), entries: [] });
    }
    entries.forEach((e) => {
      const b = buckets.get(e.month)!;
      b.species.add(e.species_name);
      b.entries.push(e);
    });
    return buckets;
  }, [entries]);

  const cells: ReactNode[] = [];

  for (let m = 1; m <= 12; m++) {
    const bucket = monthBuckets.get(m)!;
    const hasFins = bucket.species.size > 0;
    const isExpanded = expandedMonth === m;

    cells.push(
      <button
        key={m}
        onClick={() => setExpandedMonth(isExpanded ? null : m)}
        disabled={!hasFins}
        className={[
          'rounded-sm border p-3 min-h-[72px] flex flex-col gap-1.5 text-left transition-colors',
          hasFins
            ? 'bg-card border-border cursor-pointer hover:bg-muted'
            : 'bg-muted border-border/50 cursor-default',
          isExpanded ? 'ring-1 ring-secondary' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <span
          className={`text-sm font-bold uppercase tracking-[0.12em] ${
            hasFins ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          {monthLabel(m)}
        </span>

        {hasFins && (
          <div className="flex gap-1 flex-wrap items-center">
            {Array.from(bucket.species)
              .slice(0, 5)
              .map((_, i) => (
                <div key={i} className="w-2 h-2 rounded-full bg-primary" />
              ))}
            {bucket.species.size > 5 && (
              <span className="text-xs text-muted-foreground">
                +{bucket.species.size - 5}
              </span>
            )}
          </div>
        )}
      </button>,
    );

    if (m % 3 === 0) {
      const rowStart = m - 2;
      if (expandedMonth !== null && expandedMonth >= rowStart && expandedMonth <= m) {
        const expBucket = monthBuckets.get(expandedMonth)!;

        const speciesMap = new Map<string, number>();
        expBucket.entries.forEach((e) => {
          speciesMap.set(e.species_name, (speciesMap.get(e.species_name) ?? 0) + 1);
        });
        const uniqueSpecies = Array.from(speciesMap.entries());

        cells.push(
          <div
            key={`detail-${expandedMonth}`}
            className="col-span-3 border border-secondary/60 rounded-sm bg-card p-4 space-y-3"
          >
            <h4 className="font-serif text-4xl font-bold italic text-primary">
              {monthLabel(expandedMonth)}
            </h4>
            {expBucket.entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('stats.noFindsInMonth', { month: monthLabel(expandedMonth) })}
              </p>
            ) : (
              <div className="space-y-2">
                {uniqueSpecies.map(([sp, count], i) => (
                  <div
                    key={sp}
                    className="stagger-item flex items-baseline gap-2"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <span
                      className="font-serif text-sm font-semibold italic text-foreground"
                      title={plainSpeciesName(sp)}
                    >
                      {renderSpeciesName(sp)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {count} {count === 1 ? t('stats.findOne') : t('stats.findMany')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>,
        );
      }
    }
  }

  return (
    <div>
      <h3 className="text-base font-bold uppercase tracking-[0.12em] text-foreground mb-4">
        {t('stats.yourSeason')}
      </h3>
      <div className="grid grid-cols-3 gap-3">{cells}</div>
    </div>
  );
}
