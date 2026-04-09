import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FirstRunDialog } from './FirstRunDialog';
import * as storageLib from '@/lib/storage';

vi.mock('@/lib/storage', () => ({
  loadStoragePath: vi.fn(),
  pickAndSaveStoragePath: vi.fn(),
  clearStoragePath: vi.fn(),
}));

describe('FirstRunDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders the Choose Your Mushroom Library headline', () => {
    render(<FirstRunDialog onFolderSelected={vi.fn()} />);
    expect(screen.getByText('Choose Your Mushroom Library')).toBeInTheDocument();
  });

  it('renders the Choose Folder button', () => {
    render(<FirstRunDialog onFolderSelected={vi.fn()} />);
    expect(screen.getByRole('button', { name: /choose folder/i })).toBeInTheDocument();
  });

  it('does NOT dismiss on Escape keypress', () => {
    render(<FirstRunDialog onFolderSelected={vi.fn()} />);
    fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' });
    expect(screen.getByText('Choose Your Mushroom Library')).toBeInTheDocument();
  });

  it('calls onFolderSelected when pickAndSaveStoragePath resolves with a path', async () => {
    vi.mocked(storageLib.pickAndSaveStoragePath).mockResolvedValue('/tmp/x');
    const onSelected = vi.fn();
    render(<FirstRunDialog onFolderSelected={onSelected} />);
    fireEvent.click(screen.getByRole('button', { name: /choose folder/i }));
    await vi.waitFor(() => expect(onSelected).toHaveBeenCalledWith('/tmp/x'));
  });

  it('does NOT call onFolderSelected when pickAndSaveStoragePath returns null', async () => {
    vi.mocked(storageLib.pickAndSaveStoragePath).mockResolvedValue(null);
    const onSelected = vi.fn();
    render(<FirstRunDialog onFolderSelected={onSelected} />);
    fireEvent.click(screen.getByRole('button', { name: /choose folder/i }));
    await new Promise((r) => setTimeout(r, 20));
    expect(onSelected).not.toHaveBeenCalled();
  });
});
