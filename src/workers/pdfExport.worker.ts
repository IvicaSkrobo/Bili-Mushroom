// react-pdf (and some of its deps) references `window` even in worker context.
// In WebKit-based environments (Tauri/WKWebView) `window` is not defined in workers.
if (typeof window === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (self as any).window = self;
}
if (typeof navigator === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (self as any).navigator = { userAgent: 'BiliMushroomPDFWorker' };
}

import React from 'react';
import * as Comlink from 'comlink';
import { pdf } from '@react-pdf/renderer';
import { MushroomJournal } from '../components/stats/ExportDocument';
import type { FindForPdf, SpeciesNoteForPdf } from '../components/stats/ExportDocument';

// ---------------------------------------------------------------------------
// API exposed to main thread via Comlink
// ---------------------------------------------------------------------------

export interface PdfWorkerApi {
  generatePdf(
    finds: FindForPdf[],
    speciesNotes: SpeciesNoteForPdf[],
  ): Promise<Uint8Array>;
}

const api: PdfWorkerApi = {
  async generatePdf(finds, speciesNotes): Promise<Uint8Array> {
    console.log('[PDF worker] start', { finds: finds.length, notes: speciesNotes.length });
    try {
      const element = React.createElement(MushroomJournal, { finds, speciesNotes });
      console.log('[PDF worker] element created');

      const instance = pdf(element);
      const blob = await instance.toBlob();
      console.log('[PDF worker] blob ready, size=', blob.size);

      const buf = await blob.arrayBuffer();
      return new Uint8Array(buf);
    } catch (err) {
      console.error('[PDF worker] render failed:', err);
      throw err;
    }
  },
};

Comlink.expose(api);
