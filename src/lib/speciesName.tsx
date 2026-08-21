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
  if (parts.length === 1) {
    return (
      <span className="font-bold">
        {name}
      </span>
    );
  }
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return (
        <span key={i} className="font-normal opacity-70">
          {part}
        </span>
      );
    }
    return (
      <span key={i} className="font-bold">
        {part}
      </span>
    );
  });
}

/**
 * Strips markup from a species name, returning plain text.
 * Use for aria-labels, title attributes, search matching.
 */
export function plainSpeciesName(name: string): string {
  return name.replace(/\*/g, '');
}

const CROATIAN_ALPHABET = [
  'a', 'b', 'c', 'č', 'ć', 'd', 'dž', 'đ', 'e', 'f', 'g', 'h', 'i', 'j', 'k',
  'l', 'lj', 'm', 'n', 'nj', 'o', 'p', 'q', 'r', 's', 'š', 't', 'u', 'v', 'w',
  'x', 'y', 'z', 'ž',
] as const;

function croatianSortTokens(value: string): Array<readonly [number, number]> {
  const characters = Array.from(plainSpeciesName(value).toLowerCase());
  const tokens: Array<readonly [number, number]> = [];
  for (let index = 0; index < characters.length; index += 1) {
    const pair = characters[index] + (characters[index + 1] ?? '');
    const pairWeight = CROATIAN_ALPHABET.indexOf(pair as (typeof CROATIAN_ALPHABET)[number]);
    if (pairWeight >= 0) {
      tokens.push([1, pairWeight]);
      index += 1;
      continue;
    }
    const character = characters[index];
    const codePoint = character.codePointAt(0)!;
    const weight = CROATIAN_ALPHABET.indexOf(character as (typeof CROATIAN_ALPHABET)[number]);
    const isAsciiPunctuation = (codePoint >= 33 && codePoint <= 47)
      || (codePoint >= 58 && codePoint <= 64)
      || (codePoint >= 91 && codePoint <= 96)
      || (codePoint >= 123 && codePoint <= 126);
    if (weight >= 0) {
      tokens.push([1, weight]);
    } else if (character.trim().length === 0 || isAsciiPunctuation) {
      tokens.push([0, codePoint]);
    } else {
      tokens.push([2, codePoint]);
    }
  }
  return tokens;
}

function compareNumberPairs(a: readonly [number, number], b: readonly [number, number]): number {
  return a[0] - b[0] || a[1] - b[1];
}

function compareUnicodeScalars(a: string, b: string): number {
  const left = Array.from(a, (character) => character.codePointAt(0)!);
  const right = Array.from(b, (character) => character.codePointAt(0)!);
  const count = Math.min(left.length, right.length);
  for (let index = 0; index < count; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return left.length - right.length;
}

/**
 * Compares two species names for alphabetical sorting.
 * Uses the same explicit Croatian weights as the SQLite collation so browser ICU
 * differences cannot move a species across a backend pagination boundary.
 */
export function compareSpeciesNames(a: string, b: string): number {
  const left = croatianSortTokens(a);
  const right = croatianSortTokens(b);
  const count = Math.min(left.length, right.length);
  for (let index = 0; index < count; index += 1) {
    const compared = compareNumberPairs(left[index], right[index]);
    if (compared !== 0) return compared;
  }
  return left.length - right.length || compareUnicodeScalars(a, b);
}

/**
 * Returns true when the query matches any searchable field of a species:
 * latin name, common/folk name, synonyms, or other names.
 * Case-insensitive prefix match at the start of any whitespace-delimited word.
 */
export function matchesSpeciesQuery(
  query: string,
  rawName: string,
  profile?: { common_name?: string | null; synonyms?: string[] | null; other_names?: string[] | null } | null,
): boolean {
  if (!query) return true;
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;
  const matchesWordPrefix = (candidate: string | null | undefined) => (
    candidate != null
    && plainSpeciesName(candidate)
      .toLowerCase()
      .split(/\s+/u)
      .some((word) => word.startsWith(normalizedQuery))
  );
  return matchesWordPrefix(rawName)
    || matchesWordPrefix(profile?.common_name)
    || Boolean(profile?.synonyms?.some(matchesWordPrefix))
    || Boolean(profile?.other_names?.some(matchesWordPrefix));
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
