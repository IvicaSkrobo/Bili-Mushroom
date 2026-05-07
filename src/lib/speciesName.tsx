import type { ReactNode } from 'react';

/**
 * Renders a species name with optional partial bold markup.
 *
 * Convention: wrap any portion in *asterisks* to make it non-bold (font-normal).
 * Everything outside asterisks renders at the inherited weight (bold by default).
 *
 * Example: "Boletus *edulis*"  →  <span>Boletus </span><span class="font-normal">edulis</span>
 */
export function renderSpeciesName(name: string): ReactNode {
  const parts = name.split(/(\*[^*]+\*)/);
  if (parts.length === 1) return name;
  return parts.map((part, i) => {
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <span key={i} className="font-normal">
          {part.slice(1, -1)}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/**
 * Strips markup from a species name, returning plain text.
 * Use for aria-labels, title attributes, search matching.
 */
export function plainSpeciesName(name: string): string {
  return name.replace(/\*([^*]+)\*/g, '$1');
}
