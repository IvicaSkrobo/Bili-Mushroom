import { describe, expect, it } from 'vitest';
import { matchSpeciesOption } from './speciesIdentity';

describe('species import identity', () => {
  const formatted = { species_name: 'Amanita citrina *Pers.*' };
  it('matches a plain folder name to its formatted species and author', () => {
    expect(matchSpeciesOption('  amanita  citrina Pers ', [formatted])).toBe(formatted);
    expect(matchSpeciesOption('Amanita citrina var. alba Pers', [formatted])).toBeNull();
    expect(matchSpeciesOption('Amanita citrina Smith', [formatted])).toBeNull();
  });
  it('does not guess between existing duplicates but respects an explicit selection', () => {
    const plain = { species_name: 'Amanita citrina Pers' };
    expect(matchSpeciesOption('amanita citrina pers', [formatted, plain])).toBeNull();
    expect(matchSpeciesOption(plain.species_name, [formatted, plain])).toBe(plain);
  });
});
