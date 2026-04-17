import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';
import * as storageLib from '@/lib/storage';
import * as dbLib from '@/lib/db';
import { useAppStore } from '@/stores/appStore';

vi.mock('@/lib/storage');
vi.mock('@/lib/db');

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      activeTab: 'collection',
      storagePath: null,
      dbReady: false,
      dbError: null,
      language: 'en',
      theme: 'light',
      mapLayer: 'Satellite',
      pendingScan: false,
      editingFindId: null,
      selectedCollectionSpecies: null,
    });
  });

  it('shows FirstRunDialog when loadStoragePath returns null (D-01)', async () => {
    vi.mocked(storageLib.loadStoragePath).mockResolvedValue(null);
    render(<App />);
    expect(await screen.findByText('Choose Your Mushroom Library')).toBeInTheDocument();
  });

  it('renders AppShell with core tab triggers after db init (D-04)', async () => {
    vi.mocked(storageLib.loadStoragePath).mockResolvedValue('/tmp/lib');
    vi.mocked(dbLib.initializeDatabase).mockResolvedValue(undefined);
    render(<App />);
    expect(await screen.findByRole('tab', { name: /collection/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /species/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /map/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /stats/i })).toBeInTheDocument();
  });

  it('shows MigrationErrorDialog when initializeDatabase throws (D-06)', async () => {
    vi.mocked(storageLib.loadStoragePath).mockResolvedValue('/tmp/lib');
    vi.mocked(dbLib.initializeDatabase).mockRejectedValue(new Error('fake db failure'));
    render(<App />);
    expect(await screen.findByText('Database Error')).toBeInTheDocument();
    expect(screen.getByText(/fake db failure/)).toBeInTheDocument();
  });
});
