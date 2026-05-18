import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SpeciesNameEditor } from './SpeciesNameEditor';

describe('SpeciesNameEditor autocomplete', () => {
  it('shows alphabetized prefix matches only', () => {
    render(
      <SpeciesNameEditor
        value=""
        onChange={vi.fn()}
        placeholder="Species name"
        suggestions={[
          'Boletus *edulis*',
          'Amanita muscaria',
          'Cantharellus cibarius',
          'Agaricus campestris',
          'Macrolepiota procera',
        ]}
        showBoldButton={false}
      />,
    );

    const input = screen.getByRole('textbox', { name: /species name/i });
    input.textContent = 'a';
    fireEvent.input(input);

    expect(screen.getByText('Agaricus campestris')).toBeInTheDocument();
    expect(screen.getByText('Amanita muscaria')).toBeInTheDocument();
    expect(screen.queryByText('Cantharellus cibarius')).not.toBeInTheDocument();
    expect(screen.queryByText('Macrolepiota procera')).not.toBeInTheDocument();

    const options = screen
      .getAllByRole('button')
      .map((button) => button.textContent?.trim() ?? '')
      .filter(Boolean);
    expect(options).toEqual(['Agaricus campestris', 'Amanita muscaria']);
  });
});
