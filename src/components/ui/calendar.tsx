import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

function toIso(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function localeFor(lang: string): string {
  if (lang === 'hr') return 'hr-HR';
  if (lang === 'en') return 'en-US';
  return lang;
}

interface CalendarProps {
  /** Selected date as an ISO string (yyyy-mm-dd), or null/undefined for none. */
  selected?: string | null;
  onSelect: (iso: string) => void;
  lang?: string;
  /** Hide the year from the header and lock navigation to month-only (for "any year" recurring pickers). */
  showYear?: boolean;
  className?: string;
}

/** Fixed reference year used when `showYear` is false, so Feb 29 is always selectable regardless of the current real year. */
const YEAR_LOCKED_REF_YEAR = 2024;

export function Calendar({ selected, onSelect, lang = 'en', showYear = true, className }: CalendarProps) {
  const today = new Date();
  const parsedSelected = selected ? selected.split('-').map(Number) : null;
  const initialYear = !showYear ? YEAR_LOCKED_REF_YEAR : parsedSelected?.[0] ?? today.getFullYear();
  const initialMonth = parsedSelected?.[1] ?? today.getMonth() + 1;
  const [view, setView] = useState({ year: initialYear, month: initialMonth });

  const locale = localeFor(lang);
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(view.year, view.month - 1, 1));
  const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
  // Jan 1, 2024 is a Monday — used purely as a reference to get locale-correct Mon-first weekday labels.
  const weekdays = Array.from({ length: 7 }, (_, i) => weekdayFormatter.format(new Date(2024, 0, 1 + i)));

  const goPrevMonth = () => setView((v) => (
    showYear
      ? (v.month === 1 ? { year: v.year - 1, month: 12 } : { year: v.year, month: v.month - 1 })
      : { year: v.year, month: v.month === 1 ? 12 : v.month - 1 }
  ));
  const goNextMonth = () => setView((v) => (
    showYear
      ? (v.month === 12 ? { year: v.year + 1, month: 1 } : { year: v.year, month: v.month + 1 })
      : { year: v.year, month: v.month === 12 ? 1 : v.month + 1 }
  ));

  const firstOfMonth = new Date(view.year, view.month - 1, 1);
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // Sun=0..Sat=6 -> Mon=0..Sun=6
  const gridStart = new Date(view.year, view.month - 1, 1 - firstWeekday);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return {
      day: d.getDate(),
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      outside: d.getMonth() + 1 !== view.month,
    };
  });

  const todayIso = toIso(today.getFullYear(), today.getMonth() + 1, today.getDate());

  return (
    <div className={cn('w-[228px]', className)}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={goPrevMonth}
          aria-label="Previous month"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-serif text-sm font-semibold capitalize text-foreground">
          {monthLabel}{showYear ? ` ${view.year}` : ''}
        </span>
        <button
          type="button"
          onClick={goNextMonth}
          aria-label="Next month"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {weekdays.map((wd, i) => (
          <span
            key={i}
            className="flex h-6 w-7 items-center justify-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60"
          >
            {wd}
          </span>
        ))}
        {cells.map((cell, i) => {
          const iso = toIso(cell.year, cell.month, cell.day);
          const isSelected = selected ? iso === selected : false;
          const isToday = !showYear ? false : iso === todayIso;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(iso)}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs transition-colors',
                cell.outside && 'text-muted-foreground/30 hover:bg-accent/40',
                !cell.outside && !isSelected && 'text-foreground hover:bg-accent/60',
                isSelected && 'bg-primary font-semibold text-primary-foreground hover:bg-primary',
                !isSelected && isToday && 'ring-1 ring-inset ring-primary/50',
              )}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface MonthYearPickerProps {
  month?: number | null;
  year?: number | null;
  onSelect: (month: number, year: number) => void;
  lang?: string;
  className?: string;
}

export function MonthYearPicker({ month, year, onSelect, lang = 'en', className }: MonthYearPickerProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(year ?? today.getFullYear());
  const locale = localeFor(lang);
  const monthNames = Array.from(
    { length: 12 },
    (_, i) => new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2024, i, 1)),
  );

  return (
    <div className={cn('w-[200px]', className)}>
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewYear((y) => y - 1)}
          aria-label="Previous year"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-mono text-sm font-semibold text-foreground">{viewYear}</span>
        <button
          type="button"
          onClick={() => setViewYear((y) => y + 1)}
          aria-label="Next year"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-1">
        {monthNames.map((name, i) => {
          const m = i + 1;
          const isSelected = month === m && year === viewYear;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onSelect(m, viewYear)}
              className={cn(
                'rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-colors',
                isSelected
                  ? 'bg-primary text-primary-foreground'
                  : 'text-foreground hover:bg-accent/60',
              )}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
