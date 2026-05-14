import type { HistoricalPeriodData, YearBucket } from '@/lib/historicalComparison';
import { plainSpeciesName, renderSpeciesName } from '@/lib/speciesName';
import { useT } from '@/i18n/index';
import { useAppStore } from '@/stores/appStore';

function PeriodColumn({
  heading,
  buckets,
  emptyText,
  findOne,
  findMany,
}: {
  heading: string;
  buckets: YearBucket[];
  emptyText: string;
  findOne: string;
  findMany: string;
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
                  {b.findCount} {b.findCount === 1 ? findOne : findMany}
                </span>
              </div>
              {b.species.length > 0 && (
                <div className="ml-13 flex flex-wrap gap-1">
                  {b.species.map((s) => (
                    <span
                      key={s}
                      title={plainSpeciesName(s)}
                      className="font-serif text-xs font-semibold italic text-muted-foreground bg-muted/50 border border-border/40 px-1.5 py-0.5 rounded-sm"
                    >
                      {renderSpeciesName(s)}
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
  const t = useT();
  const lang = useAppStore((s) => s.language);
  const locale = lang === 'hr' ? 'hr-HR' : 'en-US';
  const monthName = new Intl.DateTimeFormat(locale, { month: 'long' }).format(
    new Date(2024, data.monthNum - 1, 1),
  );

  return (
    <div className="grid grid-cols-2 gap-8">
      <PeriodColumn
        heading={t('stats.weekHeading', { week: data.weekNum })}
        buckets={data.byWeek}
        emptyText={t('stats.weekEmpty')}
        findOne={t('stats.findOne')}
        findMany={t('stats.findMany')}
      />
      <PeriodColumn
        heading={t('stats.monthHeading', { month: monthName })}
        buckets={data.byMonth}
        emptyText={t('stats.monthEmpty')}
        findOne={t('stats.findOne')}
        findMany={t('stats.findMany')}
      />
    </div>
  );
}
