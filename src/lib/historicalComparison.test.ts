import { describe, it, expect } from 'vitest';
import { buildHistoricalComparison, getISOWeek } from './historicalComparison';
import type { CalendarEntry } from './stats';

function makeEntry(date_found: string, species_name: string): CalendarEntry {
  const month = new Date(date_found).getMonth() + 1;
  return { month, species_name, date_found, location_note: '' };
}

describe('getISOWeek', () => {
  it('known date: 2024-01-08 is week 2', () => {
    expect(getISOWeek(new Date('2024-01-08'))).toBe(2);
  });
  it('known date: 2024-12-30 is week 1 of following year', () => {
    // 2024-12-30 is Monday of week 1 of 2025
    const w = getISOWeek(new Date('2024-12-30'));
    expect(w).toBe(1);
  });
});

describe('buildHistoricalComparison', () => {
  it('entries from matching week in previous year appear in byWeek', () => {
    // today = 2025-05-07 (week 19)
    const today = new Date('2025-05-07');
    // 2024-05-08 is also week 19
    const entries = [makeEntry('2024-05-08', 'Boletus edulis')];
    const result = buildHistoricalComparison(entries, today);
    expect(result.byWeek).toHaveLength(1);
    expect(result.byWeek[0].year).toBe(2024);
    expect(result.byWeek[0].findCount).toBe(1);
    expect(result.byWeek[0].species).toContain('Boletus edulis');
  });

  it('entries from matching month in previous year appear in byMonth', () => {
    const today = new Date('2025-05-07');
    const entries = [
      makeEntry('2024-05-01', 'Cantharellus cibarius'),
      makeEntry('2024-05-20', 'Amanita muscaria'),
    ];
    const result = buildHistoricalComparison(entries, today);
    expect(result.byMonth).toHaveLength(1);
    expect(result.byMonth[0].findCount).toBe(2);
    expect(result.byMonth[0].species).toHaveLength(2);
  });

  it('entries from current year are excluded', () => {
    const today = new Date('2025-05-07');
    const entries = [makeEntry('2025-05-05', 'Boletus edulis')];
    const result = buildHistoricalComparison(entries, today);
    expect(result.byWeek).toHaveLength(0);
    expect(result.byMonth).toHaveLength(0);
  });

  it('empty entries produce empty buckets', () => {
    const result = buildHistoricalComparison([], new Date('2025-05-07'));
    expect(result.byWeek).toHaveLength(0);
    expect(result.byMonth).toHaveLength(0);
  });

  it('multiple years produce separate buckets sorted most-recent first', () => {
    const today = new Date('2025-05-07');
    const entries = [
      makeEntry('2023-05-10', 'Boletus edulis'),
      makeEntry('2024-05-08', 'Cantharellus cibarius'),
    ];
    const result = buildHistoricalComparison(entries, today);
    // Both 2023-05-10 and 2024-05-08 are in May → byMonth has 2 buckets
    expect(result.byMonth).toHaveLength(2);
    expect(result.byMonth[0].year).toBe(2024); // most recent first
    expect(result.byMonth[1].year).toBe(2023);
  });

  it('same species in multiple finds counted once in species list', () => {
    const today = new Date('2025-05-07');
    const entries = [
      makeEntry('2024-05-01', 'Boletus edulis'),
      makeEntry('2024-05-15', 'Boletus edulis'),
    ];
    const result = buildHistoricalComparison(entries, today);
    expect(result.byMonth[0].findCount).toBe(2);
    expect(result.byMonth[0].species).toHaveLength(1); // deduplicated
  });

  it('species with comma suffix strips to Latin name only', () => {
    const today = new Date('2025-05-07');
    const entries = [makeEntry('2024-05-08', 'Boletus edulis, Penny Bun')];
    const result = buildHistoricalComparison(entries, today);
    expect(result.byWeek[0].species[0]).toBe('Boletus edulis');
  });

  it('weekNum and monthNum reflect today', () => {
    const today = new Date('2025-05-07'); // week 19, month 5
    const result = buildHistoricalComparison([], today);
    expect(result.weekNum).toBe(19);
    expect(result.monthNum).toBe(5);
  });
});
