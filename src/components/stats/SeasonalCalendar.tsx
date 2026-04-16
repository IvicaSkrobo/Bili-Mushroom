import { useState, useMemo, type ReactNode } from 'react';
import type { CalendarEntry } from '@/lib/stats';

interface SeasonalCalendarProps {
  entries: CalendarEntry[];
}

function monthName(m: number): string {
  return new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2024, m - 1));
}

export function SeasonalCalendar({ entries }: SeasonalCalendarProps) {
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);

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
        {/* Month name */}
        <span
          className={`text-sm font-bold uppercase tracking-[0.12em] ${
            hasFins ? 'text-foreground' : 'text-muted-foreground'
          }`}
        >
          {monthName(m)}
        </span>

        {/* Amber dots — one per unique species, max 5 */}
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

    // After every 3rd cell (end of a row), check if expanded month falls in this row
    if (m % 3 === 0) {
      const rowStart = m - 2;
      if (expandedMonth !== null && expandedMonth >= rowStart && expandedMonth <= m) {
        const expBucket = monthBuckets.get(expandedMonth)!;

        // Group entries by species_name
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
              {monthName(expandedMonth)}
            </h4>
            {expBucket.entries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No finds recorded in {monthName(expandedMonth)}.
              </p>
            ) : (
              <div className="space-y-2">
                {uniqueSpecies.map(([sp, count], i) => (
                  <div
                    key={sp}
                    className="stagger-item flex items-baseline gap-2"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <span className="font-serif italic text-sm text-foreground">{sp}</span>
                    <span className="text-xs text-muted-foreground">
                      {count} find{count > 1 ? 's' : ''}
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
        Your Season
      </h3>
      <div className="grid grid-cols-3 gap-3">{cells}</div>
    </div>
  );
}
