import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SpeciesMetadataBadges } from './SpeciesMetadataBadges';

vi.mock('lucide-react', () => ({
  CircleHelp: (props: Record<string, unknown>) => <svg data-testid="circle-help-icon" {...props} />,
  Utensils: (props: Record<string, unknown>) => <svg data-testid="utensils-icon" {...props} />,
  X: (props: Record<string, unknown>) => <svg data-testid="x-icon" {...props} />,
  Skull: (props: Record<string, unknown>) => <svg data-testid="skull-icon" {...props} />,
  Sparkles: (props: Record<string, unknown>) => <svg data-testid="sparkles-icon" {...props} />,
  ShieldCheck: (props: Record<string, unknown>) => <svg data-testid="shield-check-icon" {...props} />,
  ShieldOff: (props: Record<string, unknown>) => <svg data-testid="shield-off-icon" {...props} />,
}));

describe('SpeciesMetadataBadges', () => {
  it('renders the correct labels and icons for non-unknown values', () => {
    render(
      <SpeciesMetadataBadges
        speciesProfile={{
          species_name: 'Agaricus bohusii',
          cover_photo_id: null,
          tags: [],
          edibility: 'edible',
          protected_status: 'protected',
        }}
        hideUnknown={true}
      />,
    );

    expect(screen.getByText('Može se jesti')).toBeInTheDocument();
    expect(screen.getByText('Protected')).toBeInTheDocument();
    expect(screen.getByTestId('utensils-icon')).toBeInTheDocument();
    expect(screen.getByTestId('shield-check-icon')).toBeInTheDocument();
  });

  it('renders inedible badge with utensils+X composite icon', () => {
    render(
      <SpeciesMetadataBadges
        speciesProfile={{
          species_name: 'Russula emetica',
          cover_photo_id: null,
          tags: [],
          edibility: 'inedible',
          protected_status: null,
        }}
        hideUnknown={true}
      />,
    );

    expect(screen.getByText('Nije za jelo')).toBeInTheDocument();
    expect(screen.getByTestId('x-icon')).toBeInTheDocument();
  });

  it('renders poisonous badge with skull icon', () => {
    render(
      <SpeciesMetadataBadges
        speciesProfile={{
          species_name: 'Amanita phalloides',
          cover_photo_id: null,
          tags: [],
          edibility: 'poisonous',
          protected_status: null,
        }}
        hideUnknown={true}
      />,
    );

    expect(screen.getByText('Opasno / otrovno')).toBeInTheDocument();
    expect(screen.getByTestId('skull-icon')).toBeInTheDocument();
  });

  it('renders psychedelic badge with sparkles icon', () => {
    render(
      <SpeciesMetadataBadges
        speciesProfile={{
          species_name: 'Psilocybe cubensis',
          cover_photo_id: null,
          tags: [],
          edibility: 'psychedelic',
          protected_status: null,
        }}
        hideUnknown={true}
      />,
    );

    expect(screen.getByText('Psihoaktivno')).toBeInTheDocument();
    expect(screen.getByTestId('sparkles-icon')).toBeInTheDocument();
  });

  it('hides unknown badges when hideUnknown is enabled', () => {
    render(
      <SpeciesMetadataBadges
        speciesProfile={{
          species_name: 'Agaricus bohusii',
          cover_photo_id: null,
          tags: [],
          edibility: null,
          protected_status: null,
        }}
        hideUnknown={true}
      />,
    );

    expect(screen.queryByText('Nepoznato')).not.toBeInTheDocument();
  });
});
