import * as Comlink from 'comlink';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { readPhotosAsBase64 } from '@/lib/stats';
import type { Find } from '@/lib/finds';
import type { PdfWorkerApi } from '../workers/pdfExport.worker';
import type { FindForPdf } from '@/components/stats/ExportDocument';

// ---------------------------------------------------------------------------
// Main export function — orchestrates photo fetch, worker PDF gen, file save
// ---------------------------------------------------------------------------

export async function generateAndSavePdf(
  finds: Find[],
  storagePath: string,
  onProgress?: (stage: 'photos' | 'rendering' | 'saving') => void,
): Promise<string | null> {
  // 1. Ask for save path first (so user can cancel before heavy work)
  const path = await save({
    defaultPath: 'bili-mushroom-journal.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (!path) return null; // user cancelled

  // 2. Read all photos as base64 (cannot use asset:// in Web Worker — see RESEARCH.md Pitfall 1)
  onProgress?.('photos');
  const allPhotoPaths = finds.flatMap((f) => f.photos.map((p) => p.photo_path));
  const base64Photos =
    allPhotoPaths.length > 0 ? await readPhotosAsBase64(storagePath, allPhotoPaths) : [];

  // 3. Build FindForPdf array — map photo_path index to base64 data URI
  let photoIdx = 0;
  const findsForPdf: FindForPdf[] = finds.map((f) => {
    const photos_base64 = f.photos.map(() => {
      const b64 = base64Photos[photoIdx++];
      return `data:image/jpeg;base64,${b64}`;
    });
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

  // 4. Generate PDF in Web Worker via Comlink — keeps main thread responsive (D-10)
  onProgress?.('rendering');
  const worker = new Worker(new URL('../workers/pdfExport.worker.ts', import.meta.url), {
    type: 'module',
  });
  const workerApi = Comlink.wrap<PdfWorkerApi>(worker);
  try {
    const pdfBytes = await workerApi.generatePdf(findsForPdf);

    // 5. Write binary PDF file to user-chosen path
    onProgress?.('saving');
    await writeFile(path, pdfBytes);
    return path;
  } finally {
    worker.terminate();
  }
}
