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

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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
  // Internal value drives the input display and dropdown filter.
  // Stays in sync with `value` prop via the effect below so external
  // changes (form reset, suggestion from parent) are reflected.
  const [localValue, setLocalValue] = useState(value);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownHighlight, setDropdownHighlight] = useState(0);

  // Sync external prop changes (reset, suggestion selection from parent)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Filter: case-insensitive substring match on trimmed localValue;
  // skip empty/whitespace suggestions
  const visibleSuggestions = localValue.trim()
    ? suggestions
        .filter((s) => s.trim() && s.toLowerCase().includes(localValue.trim().toLowerCase()))
        .slice(0, 8)
    : [];

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
            <button
              key={s}
              type="button"
              className={cn(
                'w-full text-left px-3 py-1.5 text-sm transition-colors',
                i === dropdownHighlight ? 'bg-accent' : 'hover:bg-accent',
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(s);
              }}
              onMouseEnter={() => setDropdownHighlight(i)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
