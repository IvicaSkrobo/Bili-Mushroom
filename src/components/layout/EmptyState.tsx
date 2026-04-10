import type { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon: LucideIcon;
  heading: string;
  body: string;
}

export function EmptyState({ icon: Icon, heading, body }: EmptyStateProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-8 py-16 text-center animate-fade-up">
      <Icon className="h-12 w-12 text-primary/25" aria-hidden="true" />
      <div className="max-w-xs space-y-3">
        <h2 className="font-serif text-2xl italic font-semibold text-foreground/70 leading-tight">
          {heading}
        </h2>
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border/50" />
          <div className="h-1 w-1 rounded-full bg-primary/30" />
          <div className="h-px flex-1 bg-border/50" />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
      </div>
    </div>
  );
}
