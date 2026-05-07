/**
 * Utilities for the SpeciesNameEditor's internal transform layer.
 *
 * Storage format (unchanged): "Boletus *edulis*"
 *   – text outside *…* renders at inherited weight (bold in all card contexts)
 *   – text inside  *…* renders at font-normal
 *
 * Editor format: contentEditable div with flat child structure:
 *   – plain text nodes  → bold (default)
 *   – <span data-normal> → font-normal
 *
 * These helpers convert between the two representations without touching
 * any React state, so they are fully testable as pure functions.
 */

function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Convert the internal "*text*" storage format to safe HTML for
 * injection into a contentEditable element.
 *
 * Output is intentionally flat: only text + <span data-normal> nodes.
 */
export function rawToHtml(raw: string): string {
  const parts = raw.split(/(\*[^*]+\*)/);
  return parts
    .map((part) => {
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        const inner = escHtml(part.slice(1, -1));
        return `<span data-normal="1" class="font-normal">${inner}</span>`;
      }
      return escHtml(part);
    })
    .join('');
}

/**
 * Extract the internal "*text*" format from a contentEditable element.
 *
 * Rules:
 *  – TEXT_NODEs           → verbatim (bold by default)
 *  – <span data-normal>   → wrapped in *…*
 *  – Adjacent data-normal spans are merged (no "**" in output)
 *  – Empty spans / empty text nodes are skipped
 *  – Any other element    → its textContent (fallback, keeps pasted content)
 */
export function htmlToRaw(el: HTMLElement): string {
  let result = '';
  let inNormal = false;

  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent ?? '';
      if (!text) continue;
      if (inNormal) {
        result += '*';
        inNormal = false;
      }
      result += text;
    } else if (node instanceof HTMLElement && node.dataset.normal) {
      const text = node.textContent ?? '';
      if (!text) continue;
      if (!inNormal) {
        result += '*';
        inNormal = true;
      }
      result += text;
    } else {
      // Fallback: <br>, <div>, or anything else the browser inserted
      const text = node.textContent ?? '';
      if (!text) continue;
      if (inNormal) {
        result += '*';
        inNormal = false;
      }
      result += text;
    }
  }

  if (inNormal) result += '*';
  return result;
}
