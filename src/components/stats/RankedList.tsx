import { Badge } from '@/components/ui/badge';

interface RankedListItem {
  label: string;
  count: number;
}

interface RankedListProps {
  title: string;
  items: RankedListItem[];
  emptyMessage: string;
}

export function RankedList({ title, items, emptyMessage }: RankedListProps) {
  return (
    <div>
      <h3 className="text-base font-bold uppercase tracking-[0.12em] text-foreground mb-4">
        {title}
      </h3>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={idx}
              className="group relative flex items-center gap-3 px-3 py-2.5 rounded-sm border border-border/70 bg-card hover:border-primary/25 hover:bg-muted stagger-item"
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              {/* Amber left-border on hover */}
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary opacity-0 group-hover:opacity-100 transition-opacity rounded-l-sm" />

              {/* Rank number: Playfair Display italic amber */}
              <span className="font-serif italic text-sm text-primary w-6 shrink-0">
                #{idx + 1}
              </span>

              {/* Name: DM Sans */}
              <span className="text-sm text-foreground truncate flex-1">
                {item.label}
              </span>

              {/* Count badge */}
              <Badge
                variant="outline"
                className="text-xs text-primary border-primary/40 shrink-0"
              >
                {item.count}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
