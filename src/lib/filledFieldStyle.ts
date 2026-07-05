const filledTextClass =
  'border-primary/65 bg-primary/10 font-serif text-[15px] font-semibold shadow-[inset_3px_0_0_var(--primary)] placeholder:font-sans placeholder:text-muted-foreground/45 dark:bg-primary/12';
const filledUiTextClass =
  'border-primary/65 bg-primary/10 font-semibold shadow-[inset_3px_0_0_var(--primary)] placeholder:font-normal placeholder:text-muted-foreground/45 dark:bg-primary/12';
const filledNumericClass =
  'border-primary/65 bg-primary/10 font-mono text-[13px] font-semibold shadow-[inset_3px_0_0_var(--primary)] placeholder:font-sans placeholder:text-muted-foreground/45 dark:bg-primary/12';

export function filledClass(value: string, variant: 'text' | 'ui' | 'numeric' = 'text') {
  if (!value.trim()) return undefined;
  if (variant === 'numeric') return filledNumericClass;
  if (variant === 'ui') return filledUiTextClass;
  return filledTextClass;
}
