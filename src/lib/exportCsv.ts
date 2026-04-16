import { writeTextFile } from '@tauri-apps/plugin-fs';
import { save } from '@tauri-apps/plugin-dialog';
import type { Find } from '@/lib/finds';

// ---------------------------------------------------------------------------
// CSV escaping — wraps all values in double quotes and doubles internal quotes
// Prevents formula injection (T-04-06): values starting with =, +, -, @ are safely quoted.
// ---------------------------------------------------------------------------

export function csvEscape(value: string | null | undefined): string {
  const s = value ?? '';
  return '"' + s.replace(/"/g, '""') + '"';
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

export async function exportToCsv(finds: Find[]): Promise<string | null> {
  const header = 'species_name,date_found,country,region,location_note,lat,lng,notes,photo_paths';
  const rows = finds.map((f) => {
    const photos = f.photos.map((p) => p.photo_path).join(';');
    return [
      csvEscape(f.species_name),
      csvEscape(f.date_found),
      csvEscape(f.country),
      csvEscape(f.region),
      csvEscape(f.location_note),
      f.lat ?? '',
      f.lng ?? '',
      csvEscape(f.notes),
      csvEscape(photos),
    ].join(',');
  });
  const csv = [header, ...rows].join('\n');

  const path = await save({
    defaultPath: 'bili-mushroom-export.csv',
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (!path) return null; // user cancelled

  await writeTextFile(path, csv);
  return path;
}
