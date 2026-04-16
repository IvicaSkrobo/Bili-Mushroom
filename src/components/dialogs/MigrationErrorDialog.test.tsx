import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MigrationErrorDialog } from './MigrationErrorDialog';

describe('MigrationErrorDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders the Database Error heading', () => {
    render(<MigrationErrorDialog errorMessage="test error" onReset={vi.fn()} onQuit={vi.fn()} />);
    expect(screen.getByText('Database Error')).toBeInTheDocument();
  });

  it('renders the provided error message', () => {
    render(<MigrationErrorDialog errorMessage="WAL mode failed" onReset={vi.fn()} onQuit={vi.fn()} />);
    expect(screen.getByText('WAL mode failed')).toBeInTheDocument();
  });

  it('calls onQuit when Quit App button is clicked', () => {
    const onQuit = vi.fn();
    render(<MigrationErrorDialog errorMessage="err" onReset={vi.fn()} onQuit={onQuit} />);
    fireEvent.click(screen.getByRole('button', { name: /quit app/i }));
    expect(onQuit).toHaveBeenCalledOnce();
  });

  it('does NOT dismiss on Escape keypress', () => {
    render(<MigrationErrorDialog errorMessage="err" onReset={vi.fn()} onQuit={vi.fn()} />);
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    expect(screen.getByText('Database Error')).toBeInTheDocument();
  });
});
