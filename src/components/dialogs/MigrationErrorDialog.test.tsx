import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { MigrationErrorDialog } from './MigrationErrorDialog';

describe('MigrationErrorDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders the Database Error heading', () => {
    render(<MigrationErrorDialog errorMessage="test error" onReset={vi.fn()} />);
    expect(screen.getByText('Database Error')).toBeInTheDocument();
  });

  it('renders the provided error message', () => {
    render(<MigrationErrorDialog errorMessage="WAL mode failed" onReset={vi.fn()} />);
    expect(screen.getByText('WAL mode failed')).toBeInTheDocument();
  });

  it('invokes quit_app when Quit App button is clicked', () => {
    render(<MigrationErrorDialog errorMessage="err" onReset={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /quit app/i }));
    expect(invoke).toHaveBeenCalledWith('quit_app');
  });

  it('does NOT dismiss on Escape keypress', () => {
    render(<MigrationErrorDialog errorMessage="err" onReset={vi.fn()} />);
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    expect(screen.getByText('Database Error')).toBeInTheDocument();
  });
});
