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
  const parts = name.split('*');
  if (parts.length === 1) return name;
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <span key={i} className="font-normal">
          {part}
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
  return name.replace(/\*/g, '');
}

/**
 * Compares two species names for alphabetical sorting.
 * Strips markup (*) before comparing and uses the Croatian locale
 * so č, ć, š, ž, đ sort naturally after their base letters.
 */
export function compareSpeciesNames(a: string, b: string): number {
  return plainSpeciesName(a).localeCompare(plainSpeciesName(b), 'hr', { sensitivity: 'base' });
}

/**
 * Returns true when the query matches any searchable field of a species:
 * latin name, common/folk name, synonyms, or other names.
 * Case-insensitive substring match. Pass query already lowercased for efficiency.
 */
export function matchesSpeciesQuery(
  query: string,
  rawName: string,
  profile?: { common_name?: string | null; synonyms?: string[] | null; other_names?: string[] | null } | null,
): boolean {
  if (!query) return true;
  if (plainSpeciesName(rawName).toLowerCase().startsWith(query)) return true;
  if (profile?.common_name?.toLowerCase().includes(query)) return true;
  if (profile?.synonyms?.some((s) => s.toLowerCase().startsWith(query))) return true;
  if (profile?.other_names?.some((n) => n.toLowerCase().includes(query))) return true;
  return false;
}

export function normalizeCommonName(commonName?: string | null, latinName?: string | null): string | null {
  const normalized = commonName?.trim();
  if (!normalized) return null;

  const latin = latinName?.trim();
  if (latin && plainSpeciesName(normalized).toLowerCase() === plainSpeciesName(latin).toLowerCase()) {
    return null;
  }

  return normalized;
}
