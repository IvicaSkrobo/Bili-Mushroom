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
 *   – All text starts bold (genus weight)
 *   – B button = bold/genus; I button = normal-weight/epithet
 *   – Toolbar always visible; active button reflects cursor position or selection
 *   – Select text + click I → marks that range as font-normal
 *   – Select text + click B → removes font-normal from that range
 *   – With no selection: buttons show current caret format (informational)
 *   – Autocomplete dropdown (same behaviour as old <Input>)
 *   – Paste is stripped to plain text (no formatting import)
 *   – Enter is prevented (single-line field)
 */

import { useRef, useEffect, useState } from 'react';
import { rawToHtml, htmlToRaw } from '@/lib/speciesFormat';
import { compareSpeciesNames, matchesSpeciesQuery, plainSpeciesName, renderSpeciesName } from '@/lib/speciesName';
import { cn } from '@/lib/utils';

type SpeciesMeta = {
  common_name?: string | null;
  synonyms?: string[] | null;
  other_names?: string[] | null;
};

interface SpeciesNameEditorProps {
  value: string;
  onChange: (raw: string) => void;
  placeholder?: string;
  /** Raw-format folder names for autocomplete */
  suggestions?: string[];
  className?: string;
  showBoldButton?: boolean;
  /** When provided, renders the label inside the toolbar row (left side) */
  label?: string;
  /** Profile metadata keyed by raw species name — enables common name / synonym / other name search */
  suggestionsProfiles?: Map<string, SpeciesMeta>;
}

function normalizedName(value: string): string {
  return plainSpeciesName(value).trim().toLocaleLowerCase();
}


export function SpeciesNameEditor({
  value,
  onChange,
  placeholder = '',
  suggestions = [],
  className,
  showBoldButton = true,
  label,
  suggestionsProfiles,
}: SpeciesNameEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  /** Last value we wrote to the DOM — used to detect external changes */
  const lastSyncedRef = useRef<string>('__uninit__');

  const [hasSelection, setHasSelection] = useState(false);
  /** True when cursor/selection is in bold (non-data-normal) territory */
  const [isBold, setIsBold] = useState(true);
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

  // ── Selection / cursor tracking ───────────────────────────────────────────
  useEffect(() => {
    function nodeIsBold(node: Node | null): boolean {
      const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as Element | null);
      return !el?.closest('[data-normal]');
    }

    function rangeIsBold(sel: Selection): boolean {
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
      if (!sel || !editorRef.current?.contains(sel.anchorNode)) {
        // Cursor left the editor — reset to default bold state
        setHasSelection(false);
        setIsBold(true);
        return;
      }
      if (sel.isCollapsed) {
        setHasSelection(false);
        setIsBold(nodeIsBold(sel.anchorNode));
      } else {
        setHasSelection(true);
        // Slack logic: ALL selected text bold → isBold=true; any non-bold → isBold=false
        setIsBold(rangeIsBold(sel));
      }
    }

    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, []);

  // ── Autocomplete ──────────────────────────────────────────────────────────
  const normalizedQuery = normalizedName(plainText);
  const visibleSuggestions = normalizedQuery
    ? [...suggestions]
        .sort(compareSpeciesNames)
        .filter((s) => matchesSpeciesQuery(normalizedQuery, s, suggestionsProfiles?.get(s)))
    : [];

  function selectSuggestion(raw: string) {
    if (editorRef.current) {
      editorRef.current.innerHTML = rawToHtml(raw);
    }
    lastSyncedRef.current = raw;
    setPlainText(plainSpeciesName(raw));
    setDropdownOpen(false);
    setDropdownHighlight(0);
    onChange(raw);
  }

  // ── Read bold state directly from DOM (avoids stale React state) ─────────
  function domIsBold(): boolean {
    const sel = window.getSelection();
    if (!sel || !editorRef.current?.contains(sel.anchorNode)) return true;
    if (sel.isCollapsed) {
      const el = sel.anchorNode?.nodeType === Node.TEXT_NODE
        ? sel.anchorNode.parentElement
        : (sel.anchorNode as Element | null);
      return !el?.closest('[data-normal]');
    }
    if (!sel.rangeCount) return true;
    const range = sel.getRangeAt(0);
    const ancestor = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? (range.commonAncestorContainer as Element)
      : range.commonAncestorContainer.parentElement;
    if (ancestor?.closest('[data-normal]')) return false;
    return !range.cloneContents().querySelector?.('[data-normal]');
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

  function handleDoubleClick() {
    // Double-click selects a word — immediately toggle its format
    requestAnimationFrame(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !editorRef.current?.contains(sel.anchorNode)) return;
      if (domIsBold()) applyNormal();
      else applyBold();
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    // Ctrl/Cmd+B = bold, Ctrl/Cmd+I = normal-weight (epithet)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      if (hasSelection) applyBold();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      if (hasSelection) applyNormal();
      return;
    }
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
    handleInput();
  }

  // ── Formatting operations ─────────────────────────────────────────────────

  function applyNormal() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !editorRef.current) return;
    const range = sel.getRangeAt(0);

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
  const btnBase =
    'inline-flex h-6 w-6 items-center justify-center rounded text-[11px] transition-colors border';
  const btnActive =
    'border-primary/70 bg-primary/15 text-foreground';
  const btnInactive =
    'border-transparent bg-transparent text-muted-foreground/60 hover:border-border/70 hover:bg-muted/60 hover:text-foreground';

  return (
    <div>
      {/* Toolbar row: label (left) + format buttons (right) */}
      <div className="flex items-center justify-between gap-1 mb-1 h-6">
        {label ? (
          <span className="text-[10px] font-medium text-muted-foreground/60">{label}</span>
        ) : (
          <span />
        )}
        {showBoldButton && (
          <div className="flex items-center gap-px rounded border border-border/40 bg-card/30 p-px">
            {/* B — bold / genus weight. Slack logic: active when cursor/selection is bold */}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                if (!hasSelection) return;
                // Read DOM state fresh — no stale React state
                if (domIsBold()) applyNormal(); else applyBold();
              }}
              className={cn(btnBase, isBold ? btnActive : btnInactive)}
              title="Bold — genus (Ctrl+B)"
            >
              <span className="font-sans font-bold">B</span>
            </button>
            {/* N — normal weight / epithet. Active when cursor/selection is normal */}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                if (!hasSelection) return;
                if (!domIsBold()) applyBold(); else applyNormal();
              }}
              className={cn(btnBase, !isBold ? btnActive : btnInactive)}
              title="Normal — species epithet (Ctrl+I)"
            >
              <span className="font-sans text-[10px] font-medium tracking-tight">N</span>
            </button>
          </div>
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
          onDoubleClick={handleDoubleClick}
          onBlur={handleBlur}
          onFocus={handleFocus}
          onPaste={handlePaste}
          className={cn(
            'species-name-editor',
            'block min-h-9 w-full rounded-md border border-border/90 bg-background/45 px-3 py-1',
            'text-sm font-semibold shadow-sm transition-colors outline-none',
            'whitespace-nowrap',
            'focus-visible:border-primary/60 focus-visible:ring-1 focus-visible:ring-ring',
            className,
          )}
        />

        {dropdownOpen && visibleSuggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-64 overflow-y-auto">
            {visibleSuggestions.map((s, i) => {
              const meta = suggestionsProfiles?.get(s);
              const commonName = meta?.common_name?.trim() || null;
              return (
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
                  {commonName && (
                    <span className="ml-1.5 text-xs text-muted-foreground">{commonName}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
