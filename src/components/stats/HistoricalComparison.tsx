import type { HistoricalPeriodData, YearBucket } from '@/lib/historicalComparison';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function PeriodColumn({
  heading,
  buckets,
  emptyText,
}: {
  heading: string;
  buckets: YearBucket[];
  emptyText: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-3">{heading}</p>
      {buckets.length === 0 ? (
        <p className="text-sm text-muted-foreground/60 italic">{emptyText}</p>
      ) : (
        <div className="space-y-4">
          {buckets.map((b) => (
            <div key={b.year}>
              <div className="flex items-baseline gap-3 mb-1.5">
                <span className="font-serif italic text-primary w-10 shrink-0 text-sm">{b.year}</span>
                <span className="text-sm text-foreground">
                  {b.findCount} {b.findCount === 1 ? 'find' : 'finds'}
                </span>
              </div>
              {b.species.length > 0 && (
                <div className="ml-13 flex flex-wrap gap-1">
                  {b.species.map((s) => (
                    <span
                      key={s}
                      className="text-xs text-muted-foreground bg-muted/50 border border-border/40 px-1.5 py-0.5 rounded-sm"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function HistoricalComparison({ data }: { data: HistoricalPeriodData }) {
  const monthName = MONTH_NAMES[data.monthNum - 1] ?? '';
  return (
    <div className="grid grid-cols-2 gap-8">
      <PeriodColumn
        heading={`This Week — Week ${data.weekNum}`}
        buckets={data.byWeek}
        emptyText="No finds recorded during this calendar week in previous years."
      />
      <PeriodColumn
        heading={`This Month — ${monthName}`}
        buckets={data.byMonth}
        emptyText="No finds recorded during this month in previous years."
      />
    </div>
  );
}
