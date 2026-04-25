import { readDir } from '@tauri-apps/plugin-fs';
import { parseExif, importFind, SUPPORTED_EXTENSIONS, type ImportPayload } from './finds';
import { isInternalLibraryName } from './internalEntries';

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

function isImageFile(name: string): boolean {
  const ext = name.toLowerCase().slice(name.lastIndexOf('.'));
  return SUPPORTED_EXTENSIONS.includes(ext as (typeof SUPPORTED_EXTENSIONS)[number]);
}

/** Derive a group key for a flat photo.
 *  Photos with the same cleaned name + same date → one find.
 *  Priority for name: strip Windows copy noise → meaningful prefix → date fallback.
 */
function flatPhotoGroupKey(filename: string, exifDate: string | null): string {
  // Remove extension
  let base = filename.slice(0, filename.lastIndexOf('.'));

  // Strip Windows "- Copy", "- Copy (N)", "Copy (N)" patterns (case-insensitive)
  base = base.replace(/(\s*-\s*copy|\s+copy)(\s*\(\d+\))?/gi, '').trim();

  // Strip trailing separators + digits (e.g. "_001", " 72")
  base = base.replace(/[\s_-]*\d+$/, '').trim();

  const GENERIC = ['img', 'dsc', 'dscn', 'pic', 'photo', 'image', 'p', 'mvc', 'pict'];
  const isGeneric = !base || GENERIC.includes(base.toLowerCase());

  if (isGeneric) {
    // No meaningful name — group by date or fallback
    if (exifDate) return `__date__${exifDate}`;
    const dateMatch = filename.match(/(\d{4})[_-]?(\d{2})[_-]?(\d{2})/);
    if (dateMatch) return `__date__${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
    return '__generic__';
  }

  // Same species, different days = different finds — but species_name stays as `base`
  return exifDate ? `${base}__${exifDate}` : base;
}

/** Species name to use in the payload — strips the internal date suffix from the key. */
function groupKeyToSpeciesName(key: string, exifDate: string | null): string {
  if (key.startsWith('__date__')) return exifDate ?? 'Uvezene fotografije';
  if (key === '__generic__') return 'Uvezene fotografije';
  return key.replace(/__\d{4}-\d{2}-\d{2}$/, '').trim() || 'Uvezene fotografije';
}

export async function scanAndImport(
  storagePath: string,
  onProgress: (p: AutoImportProgress) => void,
): Promise<AutoImportResult> {
  const today = new Date().toISOString().slice(0, 10);

  const entries = await readDir(storagePath);
  const subfolders = entries.filter(
    (e) => e.isDirectory && e.name && !e.name.startsWith('.') && !isInternalLibraryName(e.name),
  );

  // Flat images sitting directly in the storage root (no subfolder)
  const flatImages = entries.filter((e) => e.isFile && e.name && isImageFile(e.name));

  let totalImported = 0;
  let totalSkipped = 0;

  // --- Subfolder-based import (existing behaviour) ---
  for (let i = 0; i < subfolders.length; i++) {
    const speciesName = subfolders[i].name!;
    const folderPath = `${storagePath}/${speciesName}`;

    onProgress({ species: speciesName, current: i + 1, total: subfolders.length + (flatImages.length > 0 ? 1 : 0) });

    let folderEntries;
    try {
      folderEntries = await readDir(folderPath);
    } catch {
      continue;
    }

    const imagePaths = folderEntries
      .filter((e) => e.name && isImageFile(e.name))
      .map((e) => `${folderPath}/${e.name}`);

    if (imagePaths.length === 0) continue;

    // Parse EXIF from first photo only — use it for the whole find
    const firstPath = imagePaths[0];
    const firstFilename = firstPath.split('/').pop()?.split('\\').pop() ?? firstPath;
    let firstExif = { date: null as string | null, lat: null as number | null, lng: null as number | null };
    try { firstExif = await parseExif(firstPath); } catch { /* use defaults */ }

    const payload: ImportPayload = {
      source_path: firstPath,
      original_filename: firstFilename,
      species_name: speciesName,
      date_found: firstExif.date ?? today,
      country: '',
      region: '',
      location_note: '',
      lat: firstExif.lat,
      lng: firstExif.lng,
      notes: '',
      observed_count: null,
      additional_photos: imagePaths.slice(1),
    };

    const summary = await importFind(storagePath, [payload]);
    totalImported += summary.imported.length;
    totalSkipped += summary.skipped.length;
  }

  // --- Flat images: group by EXIF date / filename, then import each group ---
  if (flatImages.length > 0) {
    onProgress({ species: '…', current: subfolders.length + 1, total: subfolders.length + 1 });

    // Parse EXIF for all flat images first
    const flatParsed: { path: string; filename: string; exif: { date: string | null; lat: number | null; lng: number | null } }[] =
      await Promise.all(
        flatImages.map(async (e) => {
          const path = `${storagePath}/${e.name}`;
          let exif = { date: null as string | null, lat: null as number | null, lng: null as number | null };
          try { exif = await parseExif(path); } catch { /* use defaults */ }
          return { path, filename: e.name!, exif };
        }),
      );

    // Group by derived key
    const groups = new Map<string, typeof flatParsed>();
    for (const item of flatParsed) {
      const key = flatPhotoGroupKey(item.filename, item.exif.date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    }

    for (const [groupKey, items] of groups) {
      const first = items[0];
      const payload: ImportPayload = {
        source_path: first.path,
        original_filename: first.filename,
        species_name: groupKeyToSpeciesName(groupKey, first.exif.date),
        date_found: first.exif.date ?? today,
        country: '',
        region: '',
        location_note: '',
        lat: first.exif.lat,
        lng: first.exif.lng,
        notes: '',
        observed_count: null,
        additional_photos: items.slice(1).map((i) => i.path),
      };

      const summary = await importFind(storagePath, [payload]);
      totalImported += summary.imported.length;
      totalSkipped += summary.skipped.length;
    }
  }

  return {
    speciesCount: subfolders.length + (flatImages.length > 0 ? 1 : 0),
    imported: totalImported,
    skipped: totalSkipped,
  };
}
