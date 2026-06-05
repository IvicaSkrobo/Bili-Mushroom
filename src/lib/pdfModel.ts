export interface FindForPdf {
  id: number;
  species_name: string;
  date_found: string;
  country: string;
  region: string;
  location_note: string;
  lat: number | null;
  lng: number | null;
  notes: string;
  photo_count: number;
  photos_base64: string[];
}

export interface SpeciesNoteForPdf {
  species_name: string;
  notes: string;
}

export const MAX_PDF_PAGES = 12;
export const STATIC_PAGE_COUNT = 5;
export const MAX_SPOTLIGHT_PAGES = Math.max(0, MAX_PDF_PAGES - STATIC_PAGE_COUNT);
