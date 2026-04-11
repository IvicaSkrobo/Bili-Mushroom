import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkMetadataBar } from './BulkMetadataBar';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BulkMetadataBar', () => {
  it('does NOT render when itemCount is 0', () => {
    render(<BulkMetadataBar itemCount={0} onApplyAll={vi.fn()} />);
    expect(screen.queryByText(/apply to all/i)).not.toBeInTheDocument();
  });

  it('does NOT render when itemCount is 1', () => {
    render(<BulkMetadataBar itemCount={1} onApplyAll={vi.fn()} />);
    expect(screen.queryByText(/apply to all/i)).not.toBeInTheDocument();
  });

  it('renders when itemCount >= 2', () => {
    render(<BulkMetadataBar itemCount={2} onApplyAll={vi.fn()} />);
    expect(screen.getByRole('button', { name: /apply to all/i })).toBeInTheDocument();
  });

  it('renders Species name, Date, and Country inputs when itemCount >= 2', () => {
    render(<BulkMetadataBar itemCount={3} onApplyAll={vi.fn()} />);
    expect(screen.getByPlaceholderText('Species name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Country')).toBeInTheDocument();
    // Date input is type="date" — check by type
    const dateInput = document.querySelector('input[type="date"]');
    expect(dateInput).toBeInTheDocument();
  });

  it('clicking Apply to all calls onApplyAll with non-empty species_name', () => {
    const onApplyAll = vi.fn();
    render(<BulkMetadataBar itemCount={2} onApplyAll={onApplyAll} />);

    fireEvent.change(screen.getByPlaceholderText('Species name'), { target: { value: 'Boletus edulis' } });
    fireEvent.click(screen.getByRole('button', { name: /apply to all/i }));

    expect(onApplyAll).toHaveBeenCalledWith({ species_name: 'Boletus edulis' });
  });

  it('clicking Apply to all with no inputs calls onApplyAll with empty object', () => {
    const onApplyAll = vi.fn();
    render(<BulkMetadataBar itemCount={2} onApplyAll={onApplyAll} />);

    fireEvent.click(screen.getByRole('button', { name: /apply to all/i }));

    expect(onApplyAll).toHaveBeenCalledWith({});
  });

  it('inputs reset to empty after clicking Apply to all', () => {
    const onApplyAll = vi.fn();
    render(<BulkMetadataBar itemCount={2} onApplyAll={onApplyAll} />);

    const speciesInput = screen.getByPlaceholderText('Species name') as HTMLInputElement;
    fireEvent.change(speciesInput, { target: { value: 'Cantharellus cibarius' } });
    fireEvent.click(screen.getByRole('button', { name: /apply to all/i }));

    expect(speciesInput.value).toBe('');
  });
});
