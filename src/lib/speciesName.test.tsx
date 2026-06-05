import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { matchesSpeciesQuery, plainSpeciesName, renderSpeciesName } from './speciesName';

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

  it('matches autocomplete fields only from the beginning of a word field', () => {
    expect(matchesSpeciesQuery('t', 'thumbnails', { common_name: 'svjetlucava' })).toBe(true);
    expect(matchesSpeciesQuery('t', 'chickens', { common_name: 'svjetlucava' })).toBe(false);
    expect(matchesSpeciesQuery('svj', 'chickens', { common_name: 'svjetlucava' })).toBe(true);
  });
});
