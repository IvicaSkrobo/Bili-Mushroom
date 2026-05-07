import { describe, expect, it, beforeEach } from 'vitest';
import { rawToHtml, htmlToRaw } from './speciesFormat';

// ── rawToHtml ──────────────────────────────────────────────────────────────

describe('rawToHtml', () => {
  it('returns plain escaped text when there is no markup', () => {
    expect(rawToHtml('Boletus edulis')).toBe('Boletus edulis');
  });

  it('wraps *…* segments in <span data-normal>', () => {
    const html = rawToHtml('Boletus *edulis*');
    expect(html).toContain('<span data-normal="1"');
    expect(html).toContain('class="font-normal"');
    expect(html).toContain('>edulis<');
    expect(html).not.toContain('*');
  });

  it('handles multiple markup segments', () => {
    const html = rawToHtml('*Boletus* edulis, *Vrganj*');
    const spanCount = (html.match(/data-normal/g) ?? []).length;
    expect(spanCount).toBe(2);
    expect(html).not.toContain('*');
  });

  it('escapes HTML entities in plain segments', () => {
    expect(rawToHtml('A & B')).toBe('A &amp; B');
    expect(rawToHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes HTML entities inside markup segments', () => {
    const html = rawToHtml('*A & B*');
    expect(html).toContain('A &amp; B');
    expect(html).not.toContain('&B');
  });

  it('ignores degenerate single-asterisk tokens', () => {
    // "*x" with no closing asterisk → treated as plain text
    expect(rawToHtml('plain *x')).toBe('plain *x');
  });

  it('returns empty string for empty input', () => {
    expect(rawToHtml('')).toBe('');
  });
});

// ── htmlToRaw via JSDOM ────────────────────────────────────────────────────
// htmlToRaw operates on a real HTMLElement (uses childNodes + instanceof).
// We build minimal elements with document.createElement for each test.

function makeDiv(html: string): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
}

describe('htmlToRaw', () => {
  it('returns plain text unchanged', () => {
    expect(htmlToRaw(makeDiv('Boletus edulis'))).toBe('Boletus edulis');
  });

  it('wraps data-normal spans in *…*', () => {
    const el = makeDiv('Boletus <span data-normal="1">edulis</span>');
    expect(htmlToRaw(el)).toBe('Boletus *edulis*');
  });

  it('merges adjacent data-normal spans (no "**" in output)', () => {
    const el = makeDiv(
      '<span data-normal="1">Boletus</span><span data-normal="1"> edulis</span>',
    );
    expect(htmlToRaw(el)).toBe('*Boletus edulis*');
  });

  it('handles normal span between two bold segments', () => {
    const el = makeDiv('Amanita <span data-normal="1">muscaria</span>, Muhara');
    expect(htmlToRaw(el)).toBe('Amanita *muscaria*, Muhara');
  });

  it('skips empty data-normal spans (no stray asterisks)', () => {
    const el = makeDiv('text<span data-normal="1"></span>more');
    expect(htmlToRaw(el)).toBe('textmore');
  });

  it('returns empty string for empty element', () => {
    expect(htmlToRaw(makeDiv(''))).toBe('');
  });

  it('falls back to textContent for unknown elements', () => {
    // <b> is not data-normal — its text should still be included
    const el = makeDiv('Hello <b>world</b>');
    expect(htmlToRaw(el)).toBe('Hello world');
  });
});

// ── round-trip ────────────────────────────────────────────────────────────

describe('rawToHtml → htmlToRaw round-trip', () => {
  const cases = [
    'Boletus edulis',
    'Boletus *edulis*',
    '*Amanita* muscaria',
    '*Boletus* *edulis*',
    'Amanita *muscaria*, Muhara',
    '',
  ];

  for (const raw of cases) {
    it(`round-trips: "${raw}"`, () => {
      const el = makeDiv(rawToHtml(raw));
      expect(htmlToRaw(el)).toBe(raw);
    });
  }

  it('round-trip merges adjacent normal spans from applyNormal + re-extract', () => {
    // Simulate: user applies N to "Boletus" then N to " edulis" separately
    // → two adjacent data-normal spans → htmlToRaw must merge them
    const el = makeDiv(
      '<span data-normal="1">Boletus</span><span data-normal="1"> edulis</span>',
    );
    expect(htmlToRaw(el)).toBe('*Boletus edulis*');
  });
});
