import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode } from 'react';
import { useStatsCards, useCalendar, useSpeciesStats, useTopSpots } from './useStats';
import { invokeHandlers } from '@/test/tauri-mocks';
import { useAppStore } from '@/stores/appStore';
import type { StatsCards, CalendarEntry, SpeciesStatSummary, TopSpot } from '@/lib/stats';

import '@/test/tauri-mocks';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const sampleStatsCards: StatsCards = {
  total_finds: 42,
  unique_species: 17,
  locations_visited: 8,
  most_active_month: '2024-05',
};

const sampleCalendarEntry: CalendarEntry = {
  month: 5,
  species_name: 'Cantharellus cibarius',
  date_found: '2024-05-15',
  location_note: 'Forest edge',
};

const sampleSpeciesStat: SpeciesStatSummary = {
  species_name: 'Boletus edulis',
  find_count: 12,
  first_find: '2023-08-10',
  best_month: '2024-09',
  locations: [
    { country: 'Croatia', region: 'Gorski Kotar', location_note: 'Beech forest' },
    { country: 'Croatia', region: 'Istria', location_note: 'Oak grove' },
  ],
};

const sampleTopSpots: TopSpot[] = [
  { country: 'Croatia', region: 'Gorski Kotar', location_note: 'Beech forest', count: 15 },
  { country: 'Croatia', region: 'Istria', location_note: 'Oak grove', count: 7 },
];

// ---------------------------------------------------------------------------
// useStatsCards
// ---------------------------------------------------------------------------

describe('useStatsCards', () => {
  beforeEach(() => {
    useAppStore.setState({ storagePath: '/storage/test', dbReady: true });
    invokeHandlers['get_stats_cards'] = (_args: unknown) => ({
      total_finds: 0, unique_species: 0, locations_visited: 0, most_active_month: null,
    });
  });

  it('returns stats cards data', async () => {
    invokeHandlers['get_stats_cards'] = (_args: unknown) => sampleStatsCards;
    const qc = makeQueryClient();
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useStatsCards(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.total_finds).toBe(42);
    expect(result.current.data!.unique_species).toBe(17);
    expect(result.current.data!.most_active_month).toBe('2024-05');
  });

  it('is disabled when storagePath is null', () => {
    useAppStore.setState({ storagePath: null });
    const qc = makeQueryClient();
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useStatsCards(), { wrapper });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// useCalendar
// ---------------------------------------------------------------------------

describe('useCalendar', () => {
  beforeEach(() => {
    useAppStore.setState({ storagePath: '/storage/test', dbReady: true });
  });

  it('returns calendar entries', async () => {
    invokeHandlers['get_calendar'] = (_args: unknown) => [sampleCalendarEntry];
    const qc = makeQueryClient();
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useCalendar(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data![0].month).toBe(5);
    expect(result.current.data![0].species_name).toBe('Cantharellus cibarius');
    expect(result.current.data![0].location_note).toBe('Forest edge');
  });
});

// ---------------------------------------------------------------------------
// useSpeciesStats
// ---------------------------------------------------------------------------

describe('useSpeciesStats', () => {
  beforeEach(() => {
    useAppStore.setState({ storagePath: '/storage/test', dbReady: true });
  });

  it('returns species stats with locations', async () => {
    invokeHandlers['get_species_stats'] = (_args: unknown) => [sampleSpeciesStat];
    const qc = makeQueryClient();
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useSpeciesStats(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data![0].find_count).toBe(12);
    expect(result.current.data![0].locations.length).toBe(2);
    expect(result.current.data![0].best_month).toBe('2024-09');
  });
});

// ---------------------------------------------------------------------------
// useTopSpots
// ---------------------------------------------------------------------------

describe('useTopSpots', () => {
  beforeEach(() => {
    useAppStore.setState({ storagePath: '/storage/test', dbReady: true });
  });

  it('returns top spots ranked by count', async () => {
    invokeHandlers['get_top_spots'] = (_args: unknown) => sampleTopSpots;
    const qc = makeQueryClient();
    const wrapper = makeWrapper(qc);
    const { result } = renderHook(() => useTopSpots(), { wrapper });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.length).toBe(2);
    expect(result.current.data![0].count).toBe(15);
    expect(result.current.data![0].location_note).toBe('Beech forest');
  });
});
