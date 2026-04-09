import type { LucideIcon } from 'lucide-react';

export interface EmptyStateProps {
  icon: LucideIcon;
  heading: string;
  body: string;
}

export function EmptyState({ icon: Icon, heading, body }: EmptyStateProps) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-8 py-12 text-center">
      <Icon className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
      <h2 className="text-xl font-semibold leading-tight">{heading}</h2>
      <p className="max-w-[320px] text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
