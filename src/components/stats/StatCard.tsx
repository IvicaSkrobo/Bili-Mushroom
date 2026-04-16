import { Card } from '@/components/ui/card';

interface StatCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  index: number;
}

export function StatCard({ label, value, sublabel, index }: StatCardProps) {
  return (
    <Card
      className="group relative overflow-hidden stagger-item rounded-sm border-border/70 gap-2 py-4"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Amber left-border hover reveal */}
      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="px-4 flex flex-col gap-1.5">
        {/* Sub-label: uppercase tracked DM Sans */}
        <p className="text-xs font-normal uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>

        {/* Display number: Playfair Display 36px amber italic */}
        <p className="font-serif text-4xl font-bold italic text-primary leading-none">
          {value}
        </p>

        {/* Optional sublabel */}
        {sublabel && (
          <p className="text-xs text-muted-foreground">{sublabel}</p>
        )}
      </div>
    </Card>
  );
}
