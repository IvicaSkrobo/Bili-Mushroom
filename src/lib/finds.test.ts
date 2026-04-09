import { describe, it, expect, beforeEach } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { invokeHandlers } from '../test/tauri-mocks';
import {
  parseExif,
  importFind,
  getFinds,
  isHeic,
  SUPPORTED_EXTENSIONS,
  type ExifData,
  type ImportPayload,
  type Find,
  type ImportSummary,
} from './finds';

// tauri-mocks sets up vi.mock for @tauri-apps/api/core
import '../test/tauri-mocks';

const samplePayload: ImportPayload = {
  source_path: '/photos/shroom.jpg',
  original_filename: 'shroom.jpg',
  species_name: 'Amanita muscaria',
  date_found: '2024-05-10',
  country: 'Croatia',
  region: 'Istria',
  lat: 45.1,
  lng: 13.9,
  notes: 'Found near oak tree',
};

const sampleFind: Find = {
  id: 1,
  photo_path: 'Croatia/Istria/2024-05-10/Amanita_muscaria_2024-05-10_001.jpg',
  original_filename: 'shroom.jpg',
  species_name: 'Amanita muscaria',
  date_found: '2024-05-10',
  country: 'Croatia',
  region: 'Istria',
  lat: 45.1,
  lng: 13.9,
  notes: 'Found near oak tree',
  created_at: '2024-05-10T14:00:00Z',
};

describe('SUPPORTED_EXTENSIONS', () => {
  it('includes jpg, jpeg, png, webp, heic, heif', () => {
    expect(SUPPORTED_EXTENSIONS).toContain('.jpg');
    expect(SUPPORTED_EXTENSIONS).toContain('.jpeg');
    expect(SUPPORTED_EXTENSIONS).toContain('.png');
    expect(SUPPORTED_EXTENSIONS).toContain('.webp');
    expect(SUPPORTED_EXTENSIONS).toContain('.heic');
    expect(SUPPORTED_EXTENSIONS).toContain('.heif');
  });
});

describe('isHeic', () => {
  it('returns true for .heic extension', () => {
    expect(isHeic('photo.heic')).toBe(true);
  });

  it('returns true for .HEIC extension (case-insensitive)', () => {
    expect(isHeic('photo.HEIC')).toBe(true);
  });

  it('returns true for .heif extension', () => {
    expect(isHeic('photo.heif')).toBe(true);
  });

  it('returns false for .jpg', () => {
    expect(isHeic('photo.jpg')).toBe(false);
  });

  it('returns false for .png', () => {
    expect(isHeic('photo.png')).toBe(false);
  });
});

describe('parseExif', () => {
  beforeEach(() => {
    invokeHandlers['parse_exif'] = () =>
      ({ date: '2024-05-10', lat: 45.1, lng: 13.9 }) as ExifData;
  });

  it('calls invoke("parse_exif") with the path argument', async () => {
    await parseExif('/tmp/a.jpg');
    expect(invoke).toHaveBeenCalledWith('parse_exif', { path: '/tmp/a.jpg' });
  });

  it('returns the ExifData from the handler', async () => {
    const result = await parseExif('/tmp/a.jpg');
    expect(result).toEqual({ date: '2024-05-10', lat: 45.1, lng: 13.9 });
  });

  it('propagates rejection when handler throws', async () => {
    invokeHandlers['parse_exif'] = () => {
      throw 'EXIF parse failed';
    };
    await expect(parseExif('/tmp/bad.jpg')).rejects.toThrow('EXIF parse failed');
  });
});

describe('importFind', () => {
  const summary: ImportSummary = {
    imported: [sampleFind],
    skipped: [],
  };

  beforeEach(() => {
    invokeHandlers['import_find'] = () => summary;
  });

  it('calls invoke("import_find") with storagePath and payloads', async () => {
    await importFind('/storage', [samplePayload]);
    expect(invoke).toHaveBeenCalledWith('import_find', {
      storagePath: '/storage',
      payloads: [samplePayload],
    });
  });

  it('returns ImportSummary from the handler', async () => {
    const result = await importFind('/storage', [samplePayload]);
    expect(result.imported).toHaveLength(1);
    expect(result.skipped).toHaveLength(0);
  });

  it('propagates rejection from handler', async () => {
    invokeHandlers['import_find'] = () => {
      throw 'DB write error';
    };
    await expect(importFind('/storage', [samplePayload])).rejects.toThrow('DB write error');
  });
});

describe('getFinds', () => {
  beforeEach(() => {
    invokeHandlers['get_finds'] = () => [sampleFind];
  });

  it('calls invoke("get_finds") with storagePath', async () => {
    await getFinds('/storage');
    expect(invoke).toHaveBeenCalledWith('get_finds', { storagePath: '/storage' });
  });

  it('returns Find array from handler', async () => {
    const result = await getFinds('/storage');
    expect(result).toHaveLength(1);
    expect(result[0].species_name).toBe('Amanita muscaria');
  });

  it('propagates rejection from handler', async () => {
    invokeHandlers['get_finds'] = () => {
      throw 'DB read error';
    };
    await expect(getFinds('/storage')).rejects.toThrow('DB read error');
  });
});
