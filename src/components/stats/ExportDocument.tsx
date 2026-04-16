import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FindForPdf {
  species_name: string;
  date_found: string;
  country: string;
  region: string;
  location_note: string;
  lat: number | null;
  lng: number | null;
  notes: string;
  photos_base64: string[]; // data:image/jpeg;base64,... URIs
}

interface Props {
  finds: FindForPdf[];
}

// ---------------------------------------------------------------------------
// Styles — Forest Codex palette adapted for PDF (hex colors, no oklch)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  page: { padding: 40, backgroundColor: '#0F0E09' },
  title: {
    fontFamily: 'Times-Roman',
    fontSize: 28,
    color: '#D4941A',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: 'Helvetica',
    fontSize: 12,
    color: '#8A7E5C',
    textAlign: 'center',
    marginBottom: 8,
  },
  findSection: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#4A4228',
    paddingBottom: 16,
  },
  photo: {
    width: '100%',
    maxHeight: 250,
    objectFit: 'cover',
    marginBottom: 8,
  },
  speciesName: {
    fontFamily: 'Times-Roman',
    fontSize: 18,
    color: '#D4941A',
    marginBottom: 4,
  },
  metadata: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#8A7E5C',
    marginBottom: 2,
  },
  notes: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#F5E6C8',
    marginTop: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#8A7E5C',
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MushroomJournal({ finds }: Props) {
  return (
    <Document>
      {/* Cover page */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Bili Mushroom Journal</Text>
        <Text style={styles.subtitle}>{finds.length} find{finds.length !== 1 ? 's' : ''} in your collection</Text>
      </Page>

      {/* One page per find */}
      {finds.map((find, idx) => (
        <Page key={idx} size="A4" style={styles.page}>
          <View style={styles.findSection}>
            <Text style={styles.speciesName}>{find.species_name}</Text>
            <Text style={styles.metadata}>
              {find.date_found} — {find.country}, {find.region}
              {find.location_note ? `, ${find.location_note}` : ''}
            </Text>
            {find.lat != null && find.lng != null && (
              <Text style={styles.metadata}>
                {find.lat.toFixed(5)}, {find.lng.toFixed(5)}
              </Text>
            )}
            {find.photos_base64.map((photo, pi) => (
              <Image key={pi} src={photo} style={styles.photo} />
            ))}
            {find.notes ? <Text style={styles.notes}>{find.notes}</Text> : null}
          </View>
          <Text style={styles.footer} fixed>
            Bili Mushroom — {idx + 1} of {finds.length}
          </Text>
        </Page>
      ))}
    </Document>
  );
}
