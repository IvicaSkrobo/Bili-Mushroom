import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RankedListItem {
  label: string;
  count: number;
  species?: string[];
}

interface RankedListProps {
  title: string;
  items: RankedListItem[];
  emptyMessage: string;
  pageSize?: number;
}

export function RankedList({ title, items, emptyMessage, pageSize }: RankedListProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const hasMore = pageSize != null && items.length > pageSize;
  const visible = hasMore && !expanded ? items.slice(0, pageSize) : items;

  return (
    <div>
      <h3 className="text-base font-bold uppercase tracking-[0.12em] text-foreground mb-4">
        {title}
      </h3>

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
                  className={`group relative rounded-sm border border-border/70 bg-card hover:border-primary/25 hover:bg-muted stagger-item${isClickable ? ' cursor-pointer' : ''}`}
                  style={{ animationDelay: `${idx * 40}ms` }}
                  onClick={() => isClickable && setSelectedIdx(isOpen ? null : idx)}
                >
                  <div className="flex items-center gap-3 px-3 py-2.5">
                    {/* Amber left-border on hover */}
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary opacity-0 group-hover:opacity-100 transition-opacity rounded-l-sm" />

                    {/* Rank number */}
                    <span className="font-serif italic text-sm text-primary w-6 shrink-0">
                      #{idx + 1}
                    </span>

                    {/* Name */}
                    <span className="text-sm text-foreground truncate flex-1">{item.label}</span>

                    {/* Count badge */}
                    <Badge variant="outline" className="text-xs text-primary border-primary/40 shrink-0">
                      {item.count}
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
                        Species found
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {item.species.map((s) => (
                          <span
                            key={s}
                            className="text-xs text-foreground/80 bg-muted/60 border border-border/50 px-1.5 py-0.5 rounded-sm"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {hasMore && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-3 text-xs text-primary/70 hover:text-primary transition-colors"
            >
              {expanded ? 'Show less' : `Show all ${items.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
