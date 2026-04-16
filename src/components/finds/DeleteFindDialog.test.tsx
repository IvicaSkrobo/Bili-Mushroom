import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { DeleteFindDialog } from './DeleteFindDialog';
import { invokeHandlers } from '@/test/tauri-mocks';
import { useAppStore } from '@/stores/appStore';
import type { Find } from '@/lib/finds';

import '@/test/tauri-mocks';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const sampleFind: Find = {
  id: 1,
  original_filename: 'shroom.jpg',
  species_name: 'Amanita muscaria',
  date_found: '2024-05-10',
  country: 'Croatia',
  region: 'Istria',
  lat: 45.1,
  lng: 13.9,
  notes: 'Found near oak tree',
  created_at: '2024-05-10T14:00:00Z',
  photos: [],
};

describe('DeleteFindDialog', () => {
  const onOpenChange = vi.fn();

  beforeEach(() => {
    onOpenChange.mockClear();
    useAppStore.setState({ storagePath: '/storage/test', dbReady: true, language: 'en' });
    invokeHandlers['delete_find'] = (_args: unknown) => undefined;
    invokeHandlers['move_find_files'] = (_args: unknown) => undefined;
  });

  function renderDialog(find: Find | null = sampleFind) {
    const qc = makeQueryClient();
    const Wrapper = makeWrapper(qc);
    render(
      <Wrapper>
        <DeleteFindDialog find={find} onOpenChange={onOpenChange} />
      </Wrapper>,
    );
    return qc;
  }

  it('renders dialog when find is not null', () => {
    renderDialog(sampleFind);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('does not render dialog when find is null', () => {
    renderDialog(null);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('shows "Delete record only" and "Delete record + files" options', () => {
    renderDialog(sampleFind);
    expect(screen.getByText(/delete record only/i)).toBeInTheDocument();
    expect(screen.getByText(/delete record \+ files/i)).toBeInTheDocument();
    expect(screen.getByText(/move files to another folder/i)).toBeInTheDocument();
  });

  it('"Delete record only" is selected by default', () => {
    renderDialog(sampleFind);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('data-state', 'checked');
    expect(radios[1]).toHaveAttribute('data-state', 'unchecked');
    expect(radios[2]).toHaveAttribute('data-state', 'unchecked');
  });

  it('Cancel button calls onOpenChange(false) without calling delete_find', async () => {
    const deleteCallCount = { count: 0 };
    invokeHandlers['delete_find'] = (_args: unknown) => {
      deleteCallCount.count++;
      return undefined;
    };
    renderDialog(sampleFind);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(deleteCallCount.count).toBe(0);
  });

  it('Confirm with "Delete record only" calls delete_find with deleteFiles=false', async () => {
    const capturedArgs: unknown[] = [];
    invokeHandlers['delete_find'] = (args: unknown) => {
      capturedArgs.push(args);
      return undefined;
    };
    renderDialog(sampleFind);
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => {
      expect(capturedArgs.length).toBe(1);
    });
    const args = capturedArgs[0] as { findId: number; deleteFiles: boolean };
    expect(args.deleteFiles).toBe(false);
  });

  it('Confirm with "Delete record + files" calls delete_find with deleteFiles=true', async () => {
    const capturedArgs: unknown[] = [];
    invokeHandlers['delete_find'] = (args: unknown) => {
      capturedArgs.push(args);
      return undefined;
    };
    renderDialog(sampleFind);
    // Select "Delete record + files" option
    const radios = screen.getAllByRole('radio');
    fireEvent.click(radios[1]);
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => {
      expect(capturedArgs.length).toBe(1);
    });
    const args = capturedArgs[0] as { findId: number; deleteFiles: boolean };
    expect(args.deleteFiles).toBe(true);
  });

  it('Confirm with "Move files to another folder" calls move_find_files', async () => {
    const capturedArgs: unknown[] = [];
    invokeHandlers['move_find_files'] = (args: unknown) => {
      capturedArgs.push(args);
      return undefined;
    };

    renderDialog(sampleFind);
    fireEvent.click(screen.getByText(/move files to another folder/i));
    fireEvent.click(screen.getByRole('button', { name: /choose destination folder/i }));
    await waitFor(() => {
      expect(screen.getByText(/test-mushroom-library/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(capturedArgs.length).toBe(1);
    });

    expect(capturedArgs[0]).toEqual({
      storagePath: '/storage/test',
      findId: sampleFind.id,
      destFolder: '/tmp/test-mushroom-library',
    });
  });

  it('shows success toast and calls onOpenChange(false) after delete', async () => {
    const { toast } = await import('sonner');
    renderDialog(sampleFind);
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalled();
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Confirm button is disabled while mutation is pending', async () => {
    // Make delete_find hang
    invokeHandlers['delete_find'] = () => new Promise(() => {});
    renderDialog(sampleFind);
    const deleteBtn = screen.getByRole('button', { name: /^delete$/i });
    fireEvent.click(deleteBtn);
    await waitFor(() => {
      expect(deleteBtn).toBeDisabled();
    });
  });
});
