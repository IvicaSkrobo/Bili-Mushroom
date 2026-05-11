/**
 * SpeciesNameEditor
 *
 * A contentEditable species name field that shows bold/normal formatting
 * live — no asterisks ever visible to the user.
 *
 * Storage contract (unchanged):
 *   "Boletus *edulis*"  →  "Boletus" is bold, "edulis" is font-normal
 *
 * UX:
 *   – All text starts bold (default weight)
 *   – Select text + click N → marks that range as font-normal
 *   – Select text + click B → removes font-normal from that range
 *   – Autocomplete dropdown (same behaviour as old <Input>)
 *   – Paste is stripped to plain text (no formatting import)
 *   – Enter is prevented (single-line field)
 */

import { useRef, useEffect, useState } from 'react';
import { rawToHtml, htmlToRaw } from '@/lib/speciesFormat';
import { plainSpeciesName, renderSpeciesName } from '@/lib/speciesName';
import { cn } from '@/lib/utils';

interface SpeciesNameEditorProps {
  value: string;
  onChange: (raw: string) => void;
  placeholder?: string;
  /** Raw-format folder names for autocomplete */
  suggestions?: string[];
  className?: string;
  showBoldButton?: boolean;
}

export function SpeciesNameEditor({
  value,
  onChange,
  placeholder = '',
  suggestions = [],
  className,
  showBoldButton = true,
}: SpeciesNameEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  /** Last value we wrote to the DOM — used to detect external changes */
  const lastSyncedRef = useRef<string>('__uninit__');

  const [hasSelection, setHasSelection] = useState(false);
  const [selectionIsBold, setSelectionIsBold] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownHighlight, setDropdownHighlight] = useState(0);
  const [plainText, setPlainText] = useState(() => plainSpeciesName(value));

  // ── DOM initialisation (mount only) ──────────────────────────────────────
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.innerHTML = rawToHtml(value);
    lastSyncedRef.current = value;
    setPlainText(plainSpeciesName(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync external changes (e.g. autocomplete selection from parent) ───────
  useEffect(() => {
    if (!editorRef.current) return;
    if (value === lastSyncedRef.current) return;
    editorRef.current.innerHTML = rawToHtml(value);
    lastSyncedRef.current = value;
    setPlainText(plainSpeciesName(value));
  }, [value]);

  // ── Selection tracking ────────────────────────────────────────────────────
  useEffect(() => {
    function rangeIsBold(sel: Selection) {
      if (!sel.rangeCount || !editorRef.current) return true;
      const range = sel.getRangeAt(0);
      const ancestor =
        range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
          ? (range.commonAncestorContainer as Element)
          : range.commonAncestorContainer.parentElement;

      if (ancestor?.closest('[data-normal]')) return false;

      const fragment = range.cloneContents();
      return !fragment.querySelector?.('[data-normal]');
    }

    function onSelectionChange() {
      const sel = window.getSelection();
      if (
        !sel ||
        sel.isCollapsed ||
        !editorRef.current?.contains(sel.anchorNode)
      ) {
        setHasSelection(false);
        setSelectionIsBold(true);
        return;
      }
      setHasSelection(true);
      setSelectionIsBold(rangeIsBold(sel));
    }
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  // ── Autocomplete ──────────────────────────────────────────────────────────
  const visibleSuggestions = plainText
    ? suggestions
        .filter((s) =>
          plainSpeciesName(s).toLowerCase().includes(plainText.toLowerCase()),
        )
        .slice(0, 8)
    : [];

  function selectSuggestion(raw: string) {
    // Update DOM immediately (avoids a flash before the useEffect fires)
    if (editorRef.current) {
      editorRef.current.innerHTML = rawToHtml(raw);
    }
    lastSyncedRef.current = raw;
    setPlainText(plainSpeciesName(raw));
    setDropdownOpen(false);
    setDropdownHighlight(0);
    onChange(raw);
  }

  // ── Event handlers ────────────────────────────────────────────────────────
  function handleInput() {
    if (!editorRef.current) return;
    const raw = htmlToRaw(editorRef.current);
    lastSyncedRef.current = raw;
    setPlainText(editorRef.current.textContent ?? '');
    setDropdownOpen(true);
    setDropdownHighlight(0);
    onChange(raw);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (dropdownOpen && visibleSuggestions.length > 0) {
        selectSuggestion(visibleSuggestions[dropdownHighlight]);
      }
      return;
    }
    if (e.key === 'Escape') {
      setDropdownOpen(false);
      setDropdownHighlight(0);
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
    setHasSelection(false);
    setSelectionIsBold(true);
    // Short delay so a click on a suggestion can fire before we close
    setTimeout(() => setDropdownOpen(false), 150);
  }

  function handleFocus() {
    if (editorRef.current?.textContent) setDropdownOpen(true);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const sel = window.getSelection();
    if (!sel?.rangeCount || !editorRef.current) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);
    range.setStartAfter(textNode);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
    // Trigger sync
    handleInput();
  }

  // ── Formatting operations ─────────────────────────────────────────────────

  function applyNormal() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !editorRef.current) return;
    const range = sel.getRangeAt(0);

    // Extract, flatten nested data-normal spans, re-wrap entire selection
    const fragment = range.extractContents();
    for (const span of Array.from(fragment.querySelectorAll('[data-normal]'))) {
      span.replaceWith(document.createTextNode(span.textContent ?? ''));
    }
    fragment.normalize();

    const span = document.createElement('span');
    span.dataset.normal = '1';
    span.className = 'font-normal';
    span.appendChild(fragment);
    range.insertNode(span);
    editorRef.current.normalize();

    sel.removeAllRanges();

    const raw = htmlToRaw(editorRef.current);
    lastSyncedRef.current = raw;
    onChange(raw);
  }

  function applyBold() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !editorRef.current) return;
    const range = sel.getRangeAt(0);

    // Extract, strip all data-normal spans, re-insert as plain text
    const fragment = range.extractContents();
    for (const span of Array.from(fragment.querySelectorAll('[data-normal]'))) {
      span.replaceWith(document.createTextNode(span.textContent ?? ''));
    }
    fragment.normalize();
    range.insertNode(fragment);
    editorRef.current.normalize();

    sel.removeAllRanges();

    const raw = htmlToRaw(editorRef.current);
    lastSyncedRef.current = raw;
    onChange(raw);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Toolbar row */}
      <div className="flex items-center justify-end gap-1 mb-1 h-6">
        {hasSelection && (
          <span className="text-[10px] text-muted-foreground/50 mr-0.5">
            selected:
          </span>
        )}
        {showBoldButton && (
          <button
            type="button"
            disabled={!hasSelection}
            onMouseDown={(e) => {
              e.preventDefault();
              if (selectionIsBold) applyNormal();
              else applyBold();
            }}
            className={cn(
              'inline-flex h-6 w-6 items-center justify-center rounded border text-[11px] transition-colors disabled:pointer-events-none disabled:opacity-25',
              selectionIsBold
                ? 'border-primary/70 bg-primary/12 text-foreground'
                : 'border-border/90 bg-card/55 text-foreground/75 hover:border-primary/60 hover:bg-primary/10 hover:text-foreground',
            )}
            title={selectionIsBold ? 'Turn off bold for selected text' : 'Turn on bold for selected text'}
          >
            <span className="font-serif font-bold">B</span>
          </button>
        )}
      </div>

      {/* Editor + autocomplete */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label={placeholder}
          data-placeholder={placeholder}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onPaste={handlePaste}
          className={cn(
            // Match shadcn Input appearance
            'species-name-editor',
            'flex min-h-9 w-full rounded-md border border-border/90 bg-background/45 px-3 py-1',
            'text-sm font-semibold shadow-sm transition-colors outline-none',
            'overflow-x-hidden whitespace-nowrap',
            'focus-visible:border-primary/60 focus-visible:ring-1 focus-visible:ring-ring',
            className,
          )}
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
                <span className="font-serif">{renderSpeciesName(s)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
