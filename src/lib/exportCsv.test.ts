import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@/test/tauri-mocks';
import { exportToCsv, csvEscape } from '@/lib/exportCsv';
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import type { Find } from '@/lib/finds';

// ---------------------------------------------------------------------------
// Sample fixture
// ---------------------------------------------------------------------------

const sampleFind: Find = {
  id: 1,
  original_filename: 'chanterelle.jpg',
  species_name: 'Cantharellus cibarius',
  date_found: '2024-07-15',
  country: 'Croatia',
  region: 'Istria',
  location_note: 'Near oak grove',
  lat: 45.1234,
  lng: 13.8765,
  notes: 'Beautiful golden chanterelles',
  created_at: '2024-07-15T10:00:00Z',
  photos: [
    { id: 1, find_id: 1, photo_path: 'chanterelle/chanterelle.jpg', is_primary: true },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('csvEscape', () => {
  it('wraps value in double quotes', () => {
    expect(csvEscape('hello')).toBe('"hello"');
  });

  it('escapes internal double quotes', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });

  it('handles commas in value', () => {
    expect(csvEscape('Amanita, var. alba')).toBe('"Amanita, var. alba"');
  });

  it('handles null/undefined', () => {
    expect(csvEscape(null)).toBe('""');
    expect(csvEscape(undefined)).toBe('""');
  });
});

describe('exportToCsv', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: save dialog returns a path
    (save as ReturnType<typeof vi.fn>).mockResolvedValue('/tmp/test.csv');
    (writeTextFile as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('builds CSV with header and data rows', async () => {
    const result = await exportToCsv([sampleFind]);
    expect(result).toBe('/tmp/test.csv');
    expect(writeTextFile).toHaveBeenCalledOnce();
    const [path, content] = (writeTextFile as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(path).toBe('/tmp/test.csv');
    expect(content).toMatch(
      /^species_name,date_found,country,region,location_note,lat,lng,notes,photo_paths/,
    );
    expect(content).toContain('"Cantharellus cibarius"');
    expect(content).toContain('"Croatia"');
    expect(content).toContain('45.1234');
  });

  it('returns null when user cancels save dialog', async () => {
    (save as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const result = await exportToCsv([]);
    expect(result).toBeNull();
    expect(writeTextFile).not.toHaveBeenCalled();
  });

  it('joins multiple photo paths with semicolons', async () => {
    const findWithMultiplePhotos: Find = {
      ...sampleFind,
      photos: [
        { id: 1, find_id: 1, photo_path: 'species/photo1.jpg', is_primary: true },
        { id: 2, find_id: 1, photo_path: 'species/photo2.jpg', is_primary: false },
      ],
    };
    await exportToCsv([findWithMultiplePhotos]);
    const content = (writeTextFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    expect(content).toContain('species/photo1.jpg;species/photo2.jpg');
  });

  it('handles empty finds array', async () => {
    await exportToCsv([]);
    const content = (writeTextFile as ReturnType<typeof vi.fn>).mock.calls[0][1] as string;
    const lines = content.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      'species_name,date_found,country,region,location_note,lat,lng,notes,photo_paths',
    );
  });
});
