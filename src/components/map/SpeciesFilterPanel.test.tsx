import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SpeciesFilterPanel } from './SpeciesFilterPanel';

vi.mock('@/i18n/index', () => ({ useT: () => (key: string) => key }));

describe('SpeciesFilterPanel search', () => {
  it('offers only names starting with the query in alphabetical order', () => {
    render(<SpeciesFilterPanel
      allSpecies={['Hygrophorus', 'Boletus hortonii', '*Hydnum* repandum', 'Chroogomphus']}
      selected={new Set()} open onOpenChange={vi.fn()} onToggle={vi.fn()} onSelectAll={vi.fn()}
    />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: ' H ' } });
    expect(screen.getAllByRole('checkbox').slice(1).map((input) => input.closest('label')?.textContent))
      .toEqual(['Hydnum repandum', 'Hygrophorus']);
  });
});
