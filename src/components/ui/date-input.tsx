import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { parseDateInputToIso } from '@/lib/dateFormat';
import { cn } from '@/lib/utils';

interface DateInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  'aria-label'?: string;
}

function splitIsoDate(value: string): [string, string, string] {
  const [year, month, day] = value.split('-');
  if (!year || !month || !day) return ['', '', ''];
  return [day, month, year];
}

function isValidDay(value: string): boolean {
  const day = Number.parseInt(value, 10);
  return Number.isInteger(day) && day >= 1 && day <= 31;
}

function isValidMonth(value: string): boolean {
  const month = Number.parseInt(value, 10);
  return Number.isInteger(month) && month >= 1 && month <= 12;
}

function normalizePart(value: string, maxLength: number): string {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

export function DateInput({
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
}: DateInputProps) {
  const [parts, setParts] = useState<[string, string, string]>(() => splitIsoDate(value));
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    setParts(splitIsoDate(value));
  }, [value]);

  const commitIfComplete = (nextParts: [string, string, string]) => {
    if (nextParts.every((part) => part === '')) {
      onChange('');
      return;
    }
    if (nextParts.some((part) => !part)) return;
    const parsed = parseDateInputToIso(`${nextParts[0]} ${nextParts[1]} ${nextParts[2]}`);
    if (parsed !== null && parsed !== value) onChange(parsed);
  };

  const updatePart = (index: number, rawValue: string) => {
    const maxLength = index === 2 ? 4 : 2;
    const nextValue = normalizePart(rawValue, maxLength);
    const nextParts: [string, string, string] = [...parts] as [string, string, string];

    if (index === 0 && nextValue.length === 2 && !isValidDay(nextValue)) {
      nextParts[0] = '';
      setParts(nextParts);
      refs.current[0]?.focus();
      return;
    }

    if (index === 1 && nextValue.length === 2 && !isValidMonth(nextValue)) {
      nextParts[1] = '';
      setParts(nextParts);
      refs.current[1]?.focus();
      return;
    }

    nextParts[index] = nextValue;
    setParts(nextParts);

    if (index < 2 && nextValue.length === 2) {
      refs.current[index + 1]?.focus();
      refs.current[index + 1]?.select();
    }

    commitIfComplete(nextParts);
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text');
    const parsed = parseDateInputToIso(pasted);
    if (parsed === null) return;
    event.preventDefault();
    onChange(parsed);
    setParts(splitIsoDate(parsed));
  };

  const handleBlur = () => {
    commitIfComplete(parts);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (event.key === 'Backspace' && parts[index] === '' && index > 0) {
      refs.current[index - 1]?.focus();
      refs.current[index - 1]?.select();
    }
  };

  const placeholders = ['dd', 'mm', 'yyyy'];
  const widths = ['w-9', 'w-9', 'w-14'];

  return (
    <div
      className={cn(
        'inline-flex h-9 w-auto items-center gap-1.5 rounded-md border border-border/70 bg-input/35 px-2.5 py-1 shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/40',
        className,
      )}
      aria-label={ariaLabel}
    >
      {placeholders.map((placeholder, index) => (
        <input
          key={placeholder}
          ref={(node) => { refs.current[index] = node; }}
          type="text"
          inputMode="numeric"
          value={parts[index]}
          onChange={(event) => updatePart(index, event.target.value)}
          onPaste={handlePaste}
          onBlur={handleBlur}
          onKeyDown={(event) => handleKeyDown(event, index)}
          placeholder={placeholder}
          aria-label={`${ariaLabel ?? 'Date'} ${placeholder}`}
          className={`${widths[index]} rounded border border-border bg-input px-1 text-center text-sm font-medium text-foreground shadow-xs outline-none transition-colors placeholder:text-muted-foreground/55 focus:border-primary focus:bg-input dark:border-border/80 dark:bg-input/80 dark:placeholder:text-muted-foreground/60 dark:focus:border-primary`}
        />
      ))}
    </div>
  );
}
