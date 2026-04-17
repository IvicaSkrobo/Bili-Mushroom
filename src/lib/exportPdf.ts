import React from 'react';
import * as Comlink from 'comlink';
import { pdf } from '@react-pdf/renderer';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { readPhotosAsBase64 } from '@/lib/stats';
import { getSpeciesNotes } from '@/lib/finds';
import type { Find } from '@/lib/finds';
import type { PdfWorkerApi } from '../workers/pdfExport.worker';
import {
  MAX_SPOTLIGHT_PAGES,
  MushroomJournal,
  SmokeTestDocument,
  type FindForPdf,
  type SpeciesNoteForPdf,
} from '@/components/stats/ExportDocument';

const PHOTO_SPECIES_BUDGET = MAX_SPOTLIGHT_PAGES * 2;

// Shuffle so a different photo appears on each export when a find has multiple photos
function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function compareFindsByDateDesc(a: Find, b: Find): number {
  return b.date_found.localeCompare(a.date_found) || b.id - a.id;
}

function pickSmokeTestFinds(finds: Find[]): Find[] {
  const sorted = [...finds].sort(compareFindsByDateDesc);
  const withPhotos = sorted.filter((find) => find.photos.length > 0).slice(0, 1);
  const selected = new Map<number, Find>(withPhotos.map((find) => [find.id, find]));

  for (const find of sorted) {
    if (selected.size >= 3) break;
    selected.set(find.id, find);
  }

  return [...selected.values()].sort(compareFindsByDateDesc);
}

const PDF_WORKER_TIMEOUT_MS = 8_000;

function createPdfElement(
  finds: FindForPdf[],
  speciesNotes: SpeciesNoteForPdf[],
  smokeTest: boolean,
) {
  return smokeTest
    ? React.createElement(SmokeTestDocument, { finds })
    : React.createElement(MushroomJournal, { finds, speciesNotes });
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function renderPdfOnMainThread(
  finds: FindForPdf[],
  speciesNotes: SpeciesNoteForPdf[],
  smokeTest: boolean,
): Promise<Uint8Array> {
  const element = createPdfElement(finds, speciesNotes, smokeTest);
  const blob = await pdf(element).toBlob();
  return new Uint8Array(await blob.arrayBuffer());
}

async function renderPdfInWorker(
  finds: FindForPdf[],
  speciesNotes: SpeciesNoteForPdf[],
  smokeTest: boolean,
): Promise<Uint8Array> {
  const worker = new Worker(new URL('../workers/pdfExport.worker.ts', import.meta.url), {
    type: 'module',
  });
  const workerApi = Comlink.wrap<PdfWorkerApi>(worker);

  try {
    return await workerApi.generatePdf(finds, speciesNotes, smokeTest);
  } finally {
    worker.terminate();
  }
}

// ---------------------------------------------------------------------------
// Main export function — orchestrates photo fetch, worker PDF gen, file save
// ---------------------------------------------------------------------------

export async function generateAndSavePdf(
  finds: Find[],
  storagePath: string,
  onProgress?: (message: string) => void,
  options?: { smokeTest?: boolean },
): Promise<string | null> {
  const smokeTest = options?.smokeTest ?? false;
  const log = (msg: string) => {
    console.log(`[PDF] ${msg}`);
    onProgress?.(msg);
  };

  // 1. Ask for save path first
  log('Waiting for save location...');
  const path = await save({
    defaultPath: smokeTest ? 'bili-mushroom-smoke-test.pdf' : 'bili-mushroom-journal.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (!path) return null;

  // 2. Keep the smoke test genuinely small so it proves the pipeline works fast.
  const sourceFinds = smokeTest ? pickSmokeTestFinds(finds) : finds;

  // 3. Shuffle each find's photos for variety across exports
  const shuffledFinds = sourceFinds.map((f) => ({ ...f, photos: shuffleArray(f.photos) }));

  // 4. Fetch species notes early so we can prioritize photo species that
  // have actual descriptions/notes in the document.
  log(smokeTest ? 'Preparing one-photo smoke test...' : 'Fetching species notes...');
  const rawNotes = smokeTest ? [] : await getSpeciesNotes(storagePath);
  const speciesNotes: SpeciesNoteForPdf[] = rawNotes.map((n) => ({
    species_name: n.species_name,
    notes: n.notes,
  }));
  console.log(`[PDF] Species notes: ${speciesNotes.length}`);

  // 5. Determine which finds actually need photos loaded:
  //    - Cover hero: first find that has any photo
  //    - Spotlight/ribbon species: prefer species with descriptions/notes first,
  //      then fill remaining slots with other photographed species.
  const speciesCounts = new Map<string, number>();
  for (const f of shuffledFinds) {
    speciesCounts.set(f.species_name, (speciesCounts.get(f.species_name) ?? 0) + 1);
  }
  const describedSpecies = new Set(
    rawNotes
      .filter((note) => note.notes.trim())
      .map((note) => note.species_name),
  );
  for (const find of shuffledFinds) {
    if (find.notes.trim()) describedSpecies.add(find.species_name);
  }
  const maxSpotlights = smokeTest ? 0 : PHOTO_SPECIES_BUDGET;
  const topSpeciesNames = Array.from(speciesCounts.entries())
    .filter(([name, cnt]) =>
      cnt >= 1 && shuffledFinds.some((find) => find.species_name === name && find.photos.length > 0),
    )
    .sort((a, b) => {
      const describedDelta =
        Number(describedSpecies.has(b[0])) - Number(describedSpecies.has(a[0]));
      if (describedDelta !== 0) return describedDelta;
      const countDelta = b[1] - a[1];
      if (countDelta !== 0) return countDelta;
      return Math.random() - 0.5;
    })
    .slice(0, maxSpotlights)
    .map(([name]) => name);

  const needsPhotoIdx = new Set<number>();
  const heroIdx = shuffledFinds.findIndex((f) => f.photos.length > 0);
  if (heroIdx >= 0) needsPhotoIdx.add(heroIdx);
  if (!smokeTest) {
    for (const name of topSpeciesNames) {
      const idx = shuffledFinds.findIndex((f) => f.species_name === name && f.photos.length > 0);
      if (idx >= 0) needsPhotoIdx.add(idx);
    }
  }

  // 6. Load only the needed photos
  const neededPaths: string[] = [];
  const pathByFindIdx = new Map<number, string>();
  for (const idx of needsPhotoIdx) {
    const photoPath = shuffledFinds[idx].photos[0].photo_path;
    pathByFindIdx.set(idx, photoPath);
    neededPaths.push(photoPath);
  }

  log(
    smokeTest
      ? `Loading ${neededPaths.length} photo${neededPaths.length === 1 ? '' : 's'} for smoke test...`
      : `Loading ${neededPaths.length} photo${neededPaths.length === 1 ? '' : 's'} (cover + highlights)...`,
  );
  const base64s =
    neededPaths.length > 0 ? await readPhotosAsBase64(storagePath, neededPaths) : [];
  const base64ByPath = new Map(neededPaths.map((p, i) => [p, base64s[i]]));
  console.log(`[PDF] Photos loaded: ${base64s.length}`);

  // 7. Build FindForPdf — photos_base64 populated only for spotlight/hero finds
  const findsForPdf: FindForPdf[] = shuffledFinds.map((f, idx) => {
    const photoPath = pathByFindIdx.get(idx);
    const photos_base64 =
      photoPath && base64ByPath.has(photoPath)
        ? [`data:image/jpeg;base64,${base64ByPath.get(photoPath)}`]
        : [];
    return {
      id: f.id,
      species_name: f.species_name,
      date_found: f.date_found,
      country: f.country,
      region: f.region,
      location_note: f.location_note,
      lat: f.lat,
      lng: f.lng,
      notes: f.notes,
      photo_count: f.photos.length,
      photos_base64,
    };
  });

  // 8. Generate PDF in Web Worker via Comlink
  log('Starting PDF renderer...');
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
    renderPhase = smokeTest
      ? `Building smoke-test document (${findsForPdf.length} sampled entries)`
      : `Building document (${findsForPdf.length} entries)`;
    elapsed = 0;
    onProgress?.(`${renderPhase}...`);
    let pdfBytes: Uint8Array;

    try {
      pdfBytes = await Promise.race([
        renderPdfInWorker(findsForPdf, speciesNotes, smokeTest),
        wait(PDF_WORKER_TIMEOUT_MS).then<Uint8Array>(() => {
          throw new Error(`PDF worker stalled after ${PDF_WORKER_TIMEOUT_MS / 1000}s`);
        }),
      ]);
    } catch (workerErr) {
      console.warn('[PDF] Worker render failed; retrying on main thread', workerErr);
      renderPhase = 'Worker stalled, retrying locally';
      elapsed = 0;
      onProgress?.(`${renderPhase}...`);
      await wait(0);
      pdfBytes = await renderPdfOnMainThread(findsForPdf, speciesNotes, smokeTest);
    }

    clearInterval(timer);
    console.log(`[PDF] Render complete, ${(pdfBytes.byteLength / 1024).toFixed(0)} KB`);

    // 9. Write file
    log('Saving PDF to disk...');
    await writeFile(path, pdfBytes);
    console.log(`[PDF] Saved to ${path}`);
    return path;
  } catch (err) {
    clearInterval(timer);
    throw err;
  }
}
