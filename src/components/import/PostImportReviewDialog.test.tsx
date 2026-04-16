import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { PostImportReviewDialog } from './PostImportReviewDialog';
import '@/test/tauri-mocks';
import type { ImportSummary, Find } from '@/lib/finds';

vi.mock('@/components/finds/EditFindDialog', () => ({
  EditFindDialog: vi.fn(({ find, onOpenChange }: { find: Find | null; onOpenChange: (open: boolean) => void }) => {
    if (!find) return null;
    return (
      <div data-testid="edit-find-dialog">
        <span>{find.species_name || find.original_filename}</span>
        <button onClick={() => onOpenChange(false)}>Close edit</button>
      </div>
    );
  }),
}));

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function Wrapper({ children }: { children: ReactNode }) {
  const qc = makeQueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const sampleFind: Find = {
  id: 1,
  original_filename: 'shroom.jpg',
  species_name: 'Amanita muscaria',
  date_found: '2024-05-10',
  country: 'Croatia',
  region: 'Istria',
  location_note: '',
  lat: 45.1,
  lng: 13.9,
  notes: '',
  created_at: '2024-05-10T14:00:00Z',
  photos: [],
};

const sampleSummary: ImportSummary = {
  imported: [sampleFind],
  skipped: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PostImportReviewDialog', () => {
  it('does not render dialog when summary is null', () => {
    render(
      <Wrapper>
        <PostImportReviewDialog summary={null} onOpenChange={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders dialog when summary is not null', () => {
    render(
      <Wrapper>
        <PostImportReviewDialog summary={sampleSummary} onOpenChange={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders the count of imported finds in title', () => {
    render(
      <Wrapper>
        <PostImportReviewDialog summary={sampleSummary} onOpenChange={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.getByRole('heading', { name: /1.+1.+(photo|fotograf)/i })).toBeInTheDocument();
  });

  it('renders each imported find species_name', () => {
    render(
      <Wrapper>
        <PostImportReviewDialog summary={sampleSummary} onOpenChange={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.getByText('Amanita muscaria')).toBeInTheDocument();
  });

  it('renders skipped filenames when skipped.length > 0', () => {
    const summaryWithSkipped: ImportSummary = {
      imported: [],
      skipped: ['photo1.jpg'],
    };
    render(
      <Wrapper>
        <PostImportReviewDialog summary={summaryWithSkipped} onOpenChange={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.getByText('photo1.jpg')).toBeInTheDocument();
  });

  it('does not render skipped section when skipped.length === 0', () => {
    render(
      <Wrapper>
        <PostImportReviewDialog summary={sampleSummary} onOpenChange={vi.fn()} />
      </Wrapper>,
    );
    expect(screen.queryByText(/skipped/i)).not.toBeInTheDocument();
  });

  it('clicking Done calls onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    render(
      <Wrapper>
        <PostImportReviewDialog summary={sampleSummary} onOpenChange={onOpenChange} />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('each imported find shows an Edit button that opens EditFindDialog', () => {
    render(
      <Wrapper>
        <PostImportReviewDialog summary={sampleSummary} onOpenChange={vi.fn()} />
      </Wrapper>,
    );
    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    expect(screen.getByTestId('edit-find-dialog')).toBeInTheDocument();
  });
});
