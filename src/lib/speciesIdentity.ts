/** Must stay aligned with the Rust species_identity::species_key implementation. */
export function speciesIdentityKey(name: string): string {
  return name.replace(/[*.]/g, '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export function matchSpeciesOption<T extends { species_name: string }>(name: string, options: readonly T[]): T | null {
  const exact = options.find((option) => option.species_name === name.trim());
  if (exact) return exact;
  const key = speciesIdentityKey(name);
  const matches = options.filter((option) => speciesIdentityKey(option.species_name) === key);
  return matches.length === 1 ? matches[0] : null;
}
