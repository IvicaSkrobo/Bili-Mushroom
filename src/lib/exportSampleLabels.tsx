import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import type { Sample } from '@/lib/samples';
import { plainSpeciesName } from '@/lib/speciesName';

/**
 * Herbarium labels for the specimen register: a grid of cut-out slips, each carrying the
 * accession number, species, date, place, coordinates and who determined it.
 *
 * Rendered on the main thread rather than through the export worker -- labels are text
 * only, no photos, so a sheet costs milliseconds and the worker round trip would just add
 * failure modes.
 */

const LABELS_PER_ROW = 2;

function formatCoords(sample: Sample): string | null {
  if (sample.lat === null || sample.lng === null) return null;
  return `${sample.lat.toFixed(5)}, ${sample.lng.toFixed(5)}`;
}

function placeLine(sample: Sample): string {
  return [sample.location_note, sample.region, sample.country].filter(Boolean).join(', ');
}

export async function exportSampleLabels(
  samples: Sample[],
  strings: {
    title: string;
    determiner: string;
    finder: string;
    storage: string;
    preservation: string;
    defaultFileName: string;
  },
): Promise<string | null> {
  if (samples.length === 0) return null;

  const path = await save({
    defaultPath: strings.defaultFileName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (!path) return null;

  const [{ pdf, Document, Page, Text, View, StyleSheet }, ReactModule] = await Promise.all([
    import('@react-pdf/renderer'),
    import('react'),
  ]);
  const React = ReactModule.default;

  const styles = StyleSheet.create({
    page: { padding: 24, fontSize: 9, fontFamily: 'Helvetica' },
    sheetTitle: { fontSize: 8, marginBottom: 10, color: '#666' },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    label: {
      width: `${100 / LABELS_PER_ROW}%`,
      padding: 10,
      borderWidth: 0.5,
      borderColor: '#999',
      borderStyle: 'dashed',
      marginBottom: -0.5,
      marginRight: -0.5,
      height: 132,
    },
    accession: { fontSize: 8, letterSpacing: 1, marginBottom: 4, color: '#444' },
    species: { fontSize: 12, fontFamily: 'Times-BoldItalic', marginBottom: 5 },
    row: { marginBottom: 2 },
    muted: { color: '#555' },
    coords: { fontFamily: 'Courier', fontSize: 8, color: '#555', marginTop: 3 },
  });

  const labelNodes = samples.map((sample) => {
    const coords = formatCoords(sample);
    const place = placeLine(sample);
    const children = [
      React.createElement(Text, { key: 'no', style: styles.accession }, `${sample.sample_no}/${sample.sample_year}`),
      React.createElement(Text, { key: 'sp', style: styles.species }, plainSpeciesName(sample.species_name)),
      React.createElement(Text, { key: 'date', style: styles.row }, sample.date_found),
    ];
    if (place) {
      children.push(React.createElement(Text, { key: 'place', style: [styles.row, styles.muted] }, place));
    }
    if (coords) {
      children.push(React.createElement(Text, { key: 'coords', style: styles.coords }, coords));
    }
    if (sample.determiner) {
      children.push(
        React.createElement(Text, { key: 'det', style: [styles.row, styles.muted] }, `${strings.determiner}: ${sample.determiner}`),
      );
    }
    if (sample.finder) {
      children.push(
        React.createElement(Text, { key: 'leg', style: [styles.row, styles.muted] }, `${strings.finder}: ${sample.finder}`),
      );
    }
    if (sample.preservation) {
      children.push(
        React.createElement(Text, { key: 'pres', style: [styles.row, styles.muted] }, `${strings.preservation}: ${sample.preservation}`),
      );
    }
    if (sample.storage_location) {
      children.push(
        React.createElement(Text, { key: 'store', style: [styles.row, styles.muted] }, `${strings.storage}: ${sample.storage_location}`),
      );
    }
    return React.createElement(View, { key: sample.id, style: styles.label, wrap: false }, children);
  });

  const doc = React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.sheetTitle }, strings.title),
      React.createElement(View, { style: styles.grid }, labelNodes),
    ),
  );

  const blob = await pdf(doc).toBlob();
  await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  return path;
}
