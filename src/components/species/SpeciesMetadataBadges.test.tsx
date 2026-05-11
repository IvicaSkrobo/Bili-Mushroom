import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SpeciesMetadataBadges } from './SpeciesMetadataBadges';

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  return {
    ...actual,
    CircleHelp: (props: Record<string, unknown>) => <svg data-testid="circle-help-icon" {...props} />,
    Utensils: (props: Record<string, unknown>) => <svg data-testid="utensils-icon" {...props} />,
    Skull: (props: Record<string, unknown>) => <svg data-testid="skull-icon" {...props} />,
  };
});

describe('SpeciesMetadataBadges', () => {
  it('renders edible + threat badges with correct labels and icons', () => {
    render(
      <SpeciesMetadataBadges
        speciesProfile={{
          species_name: 'Agaricus bohusii',
          cover_photo_id: null,
          tags: [],
          edibility: 'edible',
          threat_status: 'lc',
        }}
        hideUnknown={true}
      />,
    );

    expect(screen.getByText('Može se jesti')).toBeInTheDocument();
    expect(screen.getByText('LC – Najmanje zabrinjavajuća')).toBeInTheDocument();
    expect(screen.getByTestId('utensils-icon')).toBeInTheDocument();
  });

  it('renders inedible badge with a full struck-through meal icon', () => {
    render(
      <SpeciesMetadataBadges
        speciesProfile={{
          species_name: 'Russula emetica',
          cover_photo_id: null,
          tags: [],
          edibility: 'inedible',
        }}
        hideUnknown={true}
      />,
    );

    expect(screen.getByText('Nije za jelo')).toBeInTheDocument();
    expect(screen.getByTestId('inedible-icon')).toBeInTheDocument();
  });

  it('renders poisonous badge with skull icon', () => {
    render(
      <SpeciesMetadataBadges
        speciesProfile={{
          species_name: 'Amanita phalloides',
          cover_photo_id: null,
          tags: [],
          edibility: 'poisonous',
        }}
        hideUnknown={true}
      />,
    );

    expect(screen.getByText('Otrovna')).toBeInTheDocument();
    expect(screen.getByTestId('skull-icon')).toBeInTheDocument();
  });

  it('renders deadly poisonous badge', () => {
    render(
      <SpeciesMetadataBadges
        speciesProfile={{
          species_name: 'Amanita phalloides',
          cover_photo_id: null,
          tags: [],
          edibility: 'deadly_poisonous',
        }}
        hideUnknown={true}
      />,
    );

    expect(screen.getByText('Smrtno otrovna')).toBeInTheDocument();
  });

  it('hides unknown badges when hideUnknown is enabled', () => {
    render(
      <SpeciesMetadataBadges
        speciesProfile={{
          species_name: 'Agaricus bohusii',
          cover_photo_id: null,
          tags: [],
          edibility: null,
        }}
        hideUnknown={true}
      />,
    );

    expect(screen.queryByText('Nepoznato')).not.toBeInTheDocument();
  });
});
