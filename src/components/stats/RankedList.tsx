import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { normalizeCommonName, plainSpeciesName, renderSpeciesName } from '@/lib/speciesName';
import { useT } from '@/i18n/index';

interface RankedSpeciesProfile {
  species_name: string;
  common_name?: string | null;
}

interface RankedListItem {
  label: string;
  count: number;
  countLabel?: string;
  species?: string[];
}

interface RankedListProps {
  title: string;
  items: RankedListItem[];
  emptyMessage: string;
  pageSize?: number;
  speciesProfiles?: RankedSpeciesProfile[];
}

export function RankedList({ title, items, emptyMessage, pageSize, speciesProfiles }: RankedListProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const hasMore = pageSize != null && items.length > pageSize;
  const visible = hasMore && !expanded ? items.slice(0, pageSize) : items;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-bold uppercase tracking-[0.12em] text-foreground">
          {title}
        </h3>
        {hasMore && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-xs font-semibold text-foreground/80 transition-colors hover:text-foreground dark:text-primary/70 dark:hover:text-primary"
          >
            {expanded ? t('stats.showLess') : t('stats.showAll', { count: items.length })}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <>
          <div className="space-y-2">
            {visible.map((item, idx) => {
              const isClickable = !!item.species?.length;
              const isOpen = selectedIdx === idx;
              return (
                <div
                  key={idx}
                  className={`group relative rounded-sm border bg-card shadow-sm stagger-item transition-all${isClickable ? ' cursor-pointer' : ''} ${isOpen ? 'border-primary/50 bg-muted shadow-md' : 'border-border hover:border-primary/40 hover:shadow-md'}`}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  onClick={() => isClickable && setSelectedIdx(isOpen ? null : idx)}
                >
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    {/* Amber left-border — persists when open */}
                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] bg-primary transition-opacity rounded-l-sm ${isOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

                    {/* Rank number */}
                    <span className="font-serif italic text-sm text-primary w-6 shrink-0">
                      #{idx + 1}
                    </span>

                    {/* Name */}
                    <span className="text-sm text-foreground truncate flex-1">{item.label}</span>

                    {/* Count badge */}
                    <Badge variant="outline" className="text-xs text-primary border-primary/40 shrink-0">
                      {item.countLabel ?? item.count}
                    </Badge>

                    {/* Expand chevron */}
                    {isClickable && (
                      <ChevronDown
                        className={`h-3.5 w-3.5 text-muted-foreground/50 shrink-0 transition-transform${isOpen ? ' rotate-180' : ''}`}
                      />
                    )}
                  </div>

                  {/* Species expansion panel */}
                  {isOpen && item.species && (
                    <div className="border-t border-border/40 px-3 pb-3 pt-2">
                      <p className="text-[11px] uppercase tracking-[0.1em] text-muted-foreground/60 mb-2">
                        {t('stats.speciesFound')}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {item.species.map((s) => (
                          <SpeciesChip key={s} speciesName={s} speciesProfiles={speciesProfiles} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {hasMore && expanded && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="mt-3 text-xs font-semibold text-foreground/80 transition-colors hover:text-foreground dark:text-primary/70 dark:hover:text-primary"
            >
              {t('stats.showLess')}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function SpeciesChip({
  speciesName,
  speciesProfiles,
}: {
  speciesName: string;
  speciesProfiles?: RankedSpeciesProfile[];
}) {
  const profile = speciesProfiles?.find((item) => item.species_name === speciesName);
  const commonName = normalizeCommonName(profile?.common_name, speciesName);

  return (
    <span
      title={commonName ? `${plainSpeciesName(speciesName)} - ${commonName}` : plainSpeciesName(speciesName)}
      className="inline-flex max-w-full items-baseline gap-1.5 rounded-sm border border-border/80 bg-card px-2 py-0.5 shadow-sm"
    >
      <span className="min-w-0 truncate font-serif text-xs font-semibold italic text-foreground">
        {renderSpeciesName(speciesName)}
      </span>
      {commonName && (
        <span className="min-w-0 truncate text-[11px] font-medium text-muted-foreground">
          {commonName}
        </span>
      )}
    </span>
  );
}
