import React from 'react';
import * as Comlink from 'comlink';
import { pdf } from '@react-pdf/renderer';
import { MushroomJournal } from '../components/stats/ExportDocument';
import type { FindForPdf } from '../components/stats/ExportDocument';

// ---------------------------------------------------------------------------
// API exposed to main thread via Comlink
// ---------------------------------------------------------------------------

export interface PdfWorkerApi {
  generatePdf(finds: FindForPdf[]): Promise<Uint8Array>;
}

const api: PdfWorkerApi = {
  async generatePdf(finds: FindForPdf[]): Promise<Uint8Array> {
    const element = React.createElement(MushroomJournal, { finds });
    const blob = await pdf(element).toBlob();
    const buf = await blob.arrayBuffer();
    return new Uint8Array(buf);
  },
};

Comlink.expose(api);
