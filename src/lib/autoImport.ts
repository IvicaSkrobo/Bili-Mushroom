import { readDir } from '@tauri-apps/plugin-fs';
import { parseExif, importFind, SUPPORTED_EXTENSIONS, type ImportPayload } from './finds';

export interface AutoImportProgress {
  species: string;
  current: number;
  total: number;
}

export interface AutoImportResult {
  speciesCount: number;
  imported: number;
  skipped: number;
}

export async function scanAndImport(
  storagePath: string,
  onProgress: (p: AutoImportProgress) => void,
): Promise<AutoImportResult> {
  const today = new Date().toISOString().slice(0, 10);

  const entries = await readDir(storagePath);
  const subfolders = entries.filter((e) => e.isDirectory && e.name && !e.name.startsWith('.'));

  let totalImported = 0;
  let totalSkipped = 0;

  for (let i = 0; i < subfolders.length; i++) {
    const speciesName = subfolders[i].name!;
    const folderPath = `${storagePath}/${speciesName}`;

    onProgress({ species: speciesName, current: i + 1, total: subfolders.length });

    let folderEntries;
    try {
      folderEntries = await readDir(folderPath);
    } catch {
      continue;
    }

    const imagePaths = folderEntries
      .filter((e) => {
        const name = e.name ?? '';
        const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
        return SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number]);
      })
      .map((e) => `${folderPath}/${e.name}`);

    if (imagePaths.length === 0) continue;

    const payloads: ImportPayload[] = await Promise.all(
      imagePaths.map(async (path) => {
        const filename = path.split('/').pop()?.split('\\').pop() ?? path;
        let exif = { date: null as string | null, lat: null as number | null, lng: null as number | null };
        try { exif = await parseExif(path); } catch { /* use defaults */ }
        return {
          source_path: path,
          original_filename: filename,
          species_name: speciesName,
          date_found: exif.date ?? today,
          country: '',
          region: '',
          location_note: '',
          lat: exif.lat,
          lng: exif.lng,
          notes: '',
          additional_photos: [],
        };
      }),
    );

    const summary = await importFind(storagePath, payloads);
    totalImported += summary.imported.length;
    totalSkipped += summary.skipped.length;
  }

  return { speciesCount: subfolders.length, imported: totalImported, skipped: totalSkipped };
}
