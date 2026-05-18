/**
 * LocationNoteInput
 *
 * A reusable Input wrapper with autocomplete dropdown for the location_note field.
 * Suggestions are derived from existing finds' location_note values — passed in
 * as an already-deduplicated list from the parent.
 *
 * Mirrors SpeciesNameEditor's autocomplete keyboard UX:
 *   ArrowDown/Up — navigate, Enter/Tab — select, Escape — close
 *   150ms blur delay so suggestion clicks register before close
 *
 * Design: maintains internal `localValue` state for the visible input text.
 * This allows the dropdown filter to work correctly even in controlled-component
 * tests where the parent mock doesn't propagate onChange back as a prop update.
 * When `value` prop changes externally (parent resets or picks a suggestion),
 * `localValue` is synced via the effect.
 */

import { X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/index';

const HIDDEN_LOCATION_SUGGESTIONS_KEY = 'bili:hidden-location-suggestions';

export function resetHiddenLocationSuggestions() {
  try {
    localStorage.removeItem(HIDDEN_LOCATION_SUGGESTIONS_KEY);
    window.dispatchEvent(new Event('bili:hidden-location-suggestions-reset'));
  } catch {
    // localStorage can be unavailable in tests/private modes; reset is best-effort.
  }
}

function loadHiddenSuggestions(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(HIDDEN_LOCATION_SUGGESTIONS_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function saveHiddenSuggestions(values: Set<string>) {
  try {
    localStorage.setItem(HIDDEN_LOCATION_SUGGESTIONS_KEY, JSON.stringify(Array.from(values)));
  } catch {
    // localStorage can be unavailable in tests/private modes; hiding is best-effort.
  }
}

export interface LocationNoteInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
  placeholder?: string;
  className?: string;
}

export function LocationNoteInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
  className,
}: LocationNoteInputProps) {
  const t = useT();
  // Internal value drives the input display and dropdown filter.
  // Stays in sync with `value` prop via the effect below so external
  // changes (form reset, suggestion from parent) are reflected.
  const [localValue, setLocalValue] = useState(value);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownHighlight, setDropdownHighlight] = useState(0);
  const [hiddenSuggestions, setHiddenSuggestions] = useState<Set<string>>(() => loadHiddenSuggestions());

  // Sync external prop changes (reset, suggestion selection from parent)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    function handleReset() {
      setHiddenSuggestions(new Set());
    }
    window.addEventListener('bili:hidden-location-suggestions-reset', handleReset);
    return () => window.removeEventListener('bili:hidden-location-suggestions-reset', handleReset);
  }, []);

  // Filter: case-insensitive substring match on trimmed localValue;
  // skip empty/whitespace suggestions
  const visibleSuggestions = localValue.trim()
    ? suggestions
        .filter((s) => {
          const trimmed = s.trim();
          return trimmed &&
            !hiddenSuggestions.has(trimmed.toLowerCase()) &&
            trimmed.toLowerCase().includes(localValue.trim().toLowerCase());
        })
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
        .slice(0, 8)
    : [];

  function hideSuggestion(suggestion: string) {
    const key = suggestion.trim().toLowerCase();
    if (!key) return;
    setHiddenSuggestions((prev) => {
      const next = new Set(prev);
      next.add(key);
      saveHiddenSuggestions(next);
      return next;
    });
    setDropdownHighlight(0);
  }

  function selectSuggestion(suggestion: string) {
    setLocalValue(suggestion);
    setDropdownOpen(false);
    setDropdownHighlight(0);
    onChange(suggestion);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value;
    setLocalValue(next);
    setDropdownOpen(true);
    setDropdownHighlight(0);
    onChange(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && dropdownOpen && visibleSuggestions.length > 0) {
      e.preventDefault();
      selectSuggestion(visibleSuggestions[dropdownHighlight]);
      return;
    }
    if (e.key === 'Escape') {
      setDropdownOpen(false);
      return;
    }
    if (e.key === 'Tab' && dropdownOpen && visibleSuggestions.length > 0) {
      e.preventDefault();
      selectSuggestion(visibleSuggestions[dropdownHighlight]);
      return;
    }
    if (!dropdownOpen || visibleSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setDropdownHighlight((h) => Math.min(h + 1, visibleSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setDropdownHighlight((h) => Math.max(h - 1, 0));
    }
  }

  function handleBlur() {
    // Delay so a click on a suggestion can fire before we close
    setTimeout(() => setDropdownOpen(false), 150);
  }

  function handleFocus() {
    if (localValue.trim()) setDropdownOpen(true);
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        value={localValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        autoComplete="off"
      />

      {dropdownOpen && visibleSuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
          {visibleSuggestions.map((s, i) => (
            <div
              key={s}
              className={cn(
                'flex w-full items-center gap-1.5 text-sm transition-colors',
                i === dropdownHighlight ? 'bg-accent' : 'hover:bg-accent',
              )}
              onMouseEnter={() => setDropdownHighlight(i)}
            >
              <button
                type="button"
                className="min-w-0 flex-1 px-3 py-1.5 text-left"
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectSuggestion(s);
                }}
              >
                {s}
              </button>
              <button
                type="button"
                className="mr-1 rounded p-1 text-muted-foreground/55 transition-colors hover:bg-background/70 hover:text-destructive"
                aria-label={t('suggestions.hide', { suggestion: s })}
                title={t('suggestions.hideTitle')}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  hideSuggestion(s);
                }}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
