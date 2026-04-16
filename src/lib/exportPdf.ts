import * as Comlink from 'comlink';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { readPhotosAsBase64 } from '@/lib/stats';
import { getSpeciesNotes } from '@/lib/finds';
import type { Find } from '@/lib/finds';
import type { PdfWorkerApi } from '../workers/pdfExport.worker';
import {
  MAX_SPOTLIGHT_PAGES,
  type FindForPdf,
  type SpeciesNoteForPdf,
} from '@/components/stats/ExportDocument';

// Shuffle so a different photo appears on each export when a find has multiple photos
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Main export function — orchestrates photo fetch, worker PDF gen, file save
// ---------------------------------------------------------------------------

export async function generateAndSavePdf(
  finds: Find[],
  storagePath: string,
  onProgress?: (message: string) => void,
): Promise<string | null> {
  const log = (msg: string) => {
    console.log(`[PDF] ${msg}`);
    onProgress?.(msg);
  };

  // 1. Ask for save path first
  log('Waiting for save location...');
  const path = await save({
    defaultPath: 'bili-mushroom-journal.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (!path) return null;

  // 2. Shuffle each find's photos for variety across exports
  const shuffledFinds = finds.map((f) => ({ ...f, photos: shuffleArray(f.photos) }));

  // 3. Determine which finds actually need photos loaded:
  //    - Cover hero: first find that has any photo
  //    - Species spotlights: one photo per top-5 species (≥2 finds, has photo)
  //    Everything else renders as text-only — no need to load 1400+ images.
  const speciesCounts = new Map<string, number>();
  for (const f of shuffledFinds) {
    speciesCounts.set(f.species_name, (speciesCounts.get(f.species_name) ?? 0) + 1);
  }
  const topSpeciesNames = Array.from(speciesCounts.entries())
    .filter(([, cnt]) => cnt >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_SPOTLIGHT_PAGES)
    .map(([name]) => name);

  const needsPhotoIdx = new Set<number>();
  const heroIdx = shuffledFinds.findIndex((f) => f.photos.length > 0);
  if (heroIdx >= 0) needsPhotoIdx.add(heroIdx);
  for (const name of topSpeciesNames) {
    const idx = shuffledFinds.findIndex((f) => f.species_name === name && f.photos.length > 0);
    if (idx >= 0) needsPhotoIdx.add(idx);
  }

  // 4. Load only the needed photos
  const neededPaths: string[] = [];
  const pathByFindIdx = new Map<number, string>();
  for (const idx of needsPhotoIdx) {
    const photoPath = shuffledFinds[idx].photos[0].photo_path;
    pathByFindIdx.set(idx, photoPath);
    neededPaths.push(photoPath);
  }

  log(`Loading ${neededPaths.length} photo${neededPaths.length === 1 ? '' : 's'} (cover + spotlights)...`);
  const base64s =
    neededPaths.length > 0 ? await readPhotosAsBase64(storagePath, neededPaths) : [];
  const base64ByPath = new Map(neededPaths.map((p, i) => [p, base64s[i]]));
  console.log(`[PDF] Photos loaded: ${base64s.length}`);

  // 5. Build FindForPdf — photos_base64 populated only for spotlight/hero finds
  const findsForPdf: FindForPdf[] = shuffledFinds.map((f, idx) => {
    const photoPath = pathByFindIdx.get(idx);
    const photos_base64 =
      photoPath && base64ByPath.has(photoPath)
        ? [`data:image/jpeg;base64,${base64ByPath.get(photoPath)}`]
        : [];
    return {
      species_name: f.species_name,
      date_found: f.date_found,
      country: f.country,
      region: f.region,
      location_note: f.location_note,
      lat: f.lat,
      lng: f.lng,
      notes: f.notes,
      photos_base64,
    };
  });

  // 6. Fetch species notes
  log('Fetching species notes...');
  const rawNotes = await getSpeciesNotes(storagePath);
  const speciesNotes: SpeciesNoteForPdf[] = rawNotes.map((n) => ({
    species_name: n.species_name,
    notes: n.notes,
  }));
  console.log(`[PDF] Species notes: ${speciesNotes.length}`);

  // 7. Generate PDF in Web Worker via Comlink
  log('Starting PDF renderer...');
  const worker = new Worker(new URL('../workers/pdfExport.worker.ts', import.meta.url), {
    type: 'module',
  });
  const workerApi = Comlink.wrap<PdfWorkerApi>(worker);

  // Tick elapsed seconds on the main thread — worker progress via Comlink proxy
  // is unreliable on WebKit, so we drive the UI clock here regardless.
  let renderPhase = 'Rendering pages';
  let elapsed = 0;
  const timer = setInterval(() => {
    elapsed++;
    console.log(`[PDF] ${renderPhase}... ${elapsed}s`);
    onProgress?.(`${renderPhase}... ${elapsed}s`);
  }, 1000);

  try {
    renderPhase = `Building document (${findsForPdf.length} entries)`;
    elapsed = 0;
    onProgress?.(`${renderPhase}...`);
    const pdfBytes = await workerApi.generatePdf(findsForPdf, speciesNotes);
    clearInterval(timer);
    console.log(`[PDF] Render complete, ${(pdfBytes.byteLength / 1024).toFixed(0)} KB`);

    // 8. Write file
    log('Saving PDF to disk...');
    await writeFile(path, pdfBytes);
    console.log(`[PDF] Saved to ${path}`);
    return path;
  } catch (err) {
    clearInterval(timer);
    throw err;
  } finally {
    worker.terminate();
  }
}
