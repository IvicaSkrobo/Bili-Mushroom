import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { compareSpeciesNames, matchesSpeciesQuery, plainSpeciesName, renderSpeciesName } from './speciesName';

describe('speciesName display helpers', () => {
  it('renders balanced normal-weight markup without raw asterisks', () => {
    const html = renderToStaticMarkup(<>{renderSpeciesName('Boletus *edulis*')}</>);

    expect(html).toContain('Boletus ');
    expect(html).toContain('font-normal');
    expect(html).toContain('edulis');
    expect(html).not.toContain('*');
  });

  it('treats an unmatched trailing marker as normal-weight text to the end', () => {
    const raw = 'Coprinellus micaceus *(Bull.) Vilgalys';
    const html = renderToStaticMarkup(<>{renderSpeciesName(raw)}</>);

    expect(html).toContain('Coprinellus micaceus ');
    expect(html).toContain('font-normal');
    expect(html).toContain('(Bull.) Vilgalys');
    expect(html).not.toContain('*');
  });

  it('strips all display markers for plain text', () => {
    expect(plainSpeciesName('Coprinellus micaceus *(Bull.) Vilgalys')).toBe(
      'Coprinellus micaceus (Bull.) Vilgalys',
    );
    expect(plainSpeciesName('Boletus *edulis*')).toBe('Boletus edulis');
  });

  it('matches every searchable name only from the beginning of any word', () => {
    expect(matchesSpeciesQuery('t', 'thumbnails', { common_name: 'svjetlucava' })).toBe(true);
    expect(matchesSpeciesQuery('t', 'chickens', { common_name: 'svjetlucava' })).toBe(false);
    expect(matchesSpeciesQuery('svj', 'chickens', { common_name: 'svjetlucava' })).toBe(true);
    expect(matchesSpeciesQuery('edu', 'Boletus *edulis*')).toBe(true);
    expect(matchesSpeciesQuery('dul', 'Boletus *edulis*')).toBe(false);
    expect(matchesSpeciesQuery('vrg', 'Boletus edulis', { common_name: 'Jestivi vrganj' })).toBe(true);
    expect(matchesSpeciesQuery('rgan', 'Boletus edulis', { common_name: 'Jestivi vrganj' })).toBe(false);
    expect(matchesSpeciesQuery('šu', 'Boletus edulis', { synonyms: ['Veliki Šumski vrganj'] })).toBe(true);
    expect(matchesSpeciesQuery('ču', 'Boletus edulis', { other_names: ['Pravi Čupavac'] })).toBe(true);
    expect(matchesSpeciesQuery('ć', 'Boletus edulis', { other_names: ['Gorski Ćubasti vrganj'] })).toBe(true);
    expect(matchesSpeciesQuery('ž', 'Boletus edulis', { synonyms: ['Žuti vrganj'] })).toBe(true);
    expect(matchesSpeciesQuery('đ', 'Boletus edulis', { other_names: ['Đurđevača'] })).toBe(true);
  });

  it('uses the deterministic Croatian species alphabet across markup and case', () => {
    const names = [
      'Žuta', 'zvončić', 'Šampinjon', 'siva', 'Njivska', 'Niska', 'Ljuskava', 'Lisičarka',
      'Đurđevača', 'Džinovska', 'dubovka', 'Ćubasta', 'Čupava', 'crvena', '*Amanita*', 'amanita',
      'Quercus', 'Rujnica', 'Vlažna', 'Wulfenia', 'Xerocomus', 'Ypsilandra',
    ];

    expect([...names].sort(compareSpeciesNames)).toEqual([
      '*Amanita*', 'amanita', 'crvena', 'Čupava', 'Ćubasta', 'dubovka', 'Džinovska',
      'Đurđevača', 'Lisičarka', 'Ljuskava', 'Niska', 'Njivska', 'Quercus', 'Rujnica',
      'siva', 'Šampinjon', 'Vlažna', 'Wulfenia', 'Xerocomus', 'Ypsilandra', 'zvončić', 'Žuta',
    ]);
    expect(compareSpeciesNames('*Amanita*', 'amanita')).toBeLessThan(0);
  });
});
