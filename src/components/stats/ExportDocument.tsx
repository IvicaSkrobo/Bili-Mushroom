import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { MAX_PDF_PAGES, MAX_SPOTLIGHT_PAGES } from '@/lib/pdfModel';
import type { FindForPdf, SpeciesNoteForPdf } from '@/lib/pdfModel';
export { MAX_PDF_PAGES, MAX_SPOTLIGHT_PAGES } from '@/lib/pdfModel';
export type { FindForPdf, SpeciesNoteForPdf } from '@/lib/pdfModel';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface Props {
  finds: FindForPdf[];
  speciesNotes: SpeciesNoteForPdf[];
  smokeTest?: boolean;
}

interface SmokeTestProps {
  finds: FindForPdf[];
}

const MAX_FOLDER_ROWS = 12;
const SPOTLIGHTS_PER_PAGE = 2;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

// ─── Colors ───────────────────────────────────────────────────────────────────

const C = {
  bg: '#F4EBDD',
  bgCard: '#FFF9ED',
  bgDeep: '#ECE0CC',
  bgSoft: '#F8F1E5',
  bdDim: '#DED0B8',
  bd: '#CBB895',
  bdAcc: '#B88932',
  amber: '#C57924',
  green: '#4E7C59',
  greenSoft: '#E5EEDC',
  red: '#B2573F',
  text: '#251F17',
  textMid: '#5F5140',
  textMuted: '#85755E',
  textDim: '#A49175',
} as const;

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    backgroundColor: C.bg,
    paddingTop: 36,
    paddingLeft: 34,
    paddingRight: 34,
    paddingBottom: 44,
  },
  coverPage: {
    backgroundColor: C.bg,
    paddingTop: 0,
    paddingLeft: 0,
    paddingRight: 0,
    paddingBottom: 40,
  },
  eyebrow: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: C.green,
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  h2: { fontFamily: 'Times-Bold', fontSize: 24, color: C.text, marginBottom: 4 },
  body: { fontFamily: 'Helvetica', fontSize: 10, color: C.textMid, lineHeight: 1.55 },
  bodySmall: { fontFamily: 'Helvetica', fontSize: 9, color: C.textMuted, lineHeight: 1.45 },
  amberLine: { width: 44, height: 3, backgroundColor: C.amber, marginBottom: 14 },
  divider: { height: 1, backgroundColor: C.bdDim, marginTop: 10, marginBottom: 10 },
  // Stat grids
  grid2: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: -4, marginRight: -4, marginBottom: 12 },
  cell2: { width: '50%', paddingLeft: 4, paddingRight: 4, marginBottom: 8 },
  grid3: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: -4, marginRight: -4, marginBottom: 12 },
  cell3: { width: '33.33%', paddingLeft: 4, paddingRight: 4, marginBottom: 8 },
  statInner: {
    borderWidth: 1,
    borderColor: C.bd,
    borderLeftWidth: 3,
    borderLeftColor: C.amber,
    borderRadius: 6,
    backgroundColor: C.bgCard,
    padding: 12,
    minHeight: 62,
  },
  statVal: { fontFamily: 'Times-Bold', fontSize: 21, color: C.text, marginBottom: 4 },
  statLbl: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  // Bar chart
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  barLabel: { width: 118, fontFamily: 'Helvetica', fontSize: 9, color: C.textMid, lineHeight: 1.25 },
  barTrack: { flex: 1, height: 10, backgroundColor: C.bgDeep, marginRight: 8, borderRadius: 5 },
  barFill: { height: 10, backgroundColor: C.green, borderRadius: 5 },
  barNum: { width: 22, fontFamily: 'Helvetica-Bold', fontSize: 9, color: C.amber, textAlign: 'right' },
  // Highlight cards
  hlCard: {
    borderWidth: 1,
    borderColor: C.bdDim,
    borderLeftWidth: 3,
    borderLeftColor: C.amber,
    borderRadius: 6,
    backgroundColor: C.bgCard,
    paddingTop: 9,
    paddingBottom: 9,
    paddingLeft: 12,
    paddingRight: 12,
    marginBottom: 10,
  },
  hlLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: C.amber, letterSpacing: 0.8, marginBottom: 3 },
  hlText: { fontFamily: 'Helvetica', fontSize: 10, color: C.textMid, lineHeight: 1.5 },
  // Spotlight box
  spotBox: { borderWidth: 1, borderColor: C.bdAcc, borderRadius: 8, backgroundColor: C.bgCard, padding: 14, marginBottom: 14 },
  spotEyebrow: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: C.green, letterSpacing: 1.2, marginBottom: 6, textTransform: 'uppercase' },
  spotText: { fontFamily: 'Times-Bold', fontSize: 14, color: C.text, lineHeight: 1.4 },
  // Cover
  coverHeroPhoto: { width: '100%', height: 270, objectFit: 'cover' },
  coverAmberStripe: { height: 5, backgroundColor: C.amber },
  coverBody: { paddingLeft: 34, paddingRight: 34, paddingTop: 20 },
  coverPanel: {
    borderWidth: 1,
    borderColor: C.bd,
    borderRadius: 10,
    backgroundColor: C.bgCard,
    paddingTop: 18,
    paddingBottom: 18,
    paddingLeft: 18,
    paddingRight: 18,
  },
  coverAmberLine: { width: 44, height: 3, backgroundColor: C.amber, marginBottom: 16 },
  coverStatRow: { flexDirection: 'row', marginTop: 20, marginLeft: -4, marginRight: -4 },
  coverStatCell: {
    flex: 1,
    marginLeft: 4,
    marginRight: 4,
    borderWidth: 1,
    borderColor: C.bd,
    borderRadius: 7,
    backgroundColor: C.bgCard,
    padding: 12,
    alignItems: 'center',
  },
  coverStatVal: { fontFamily: 'Times-Bold', fontSize: 26, color: C.text, marginBottom: 4, textAlign: 'center' },
  coverStatLbl: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.textMuted, textAlign: 'center', letterSpacing: 0.8, textTransform: 'uppercase' },
  coverNoPhoto: {
    height: 270,
    backgroundColor: C.greenSoft,
    borderBottomWidth: 1,
    borderBottomColor: C.bd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverNoPhotoText: { fontFamily: 'Times-Bold', fontSize: 34, color: C.green, letterSpacing: 1 },
  // Rank rows (Top Species page)
  rankRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 7,
    paddingBottom: 7,
    paddingLeft: 10,
    paddingRight: 10,
    marginBottom: 3,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderRadius: 5,
    borderColor: C.bdDim,
    borderLeftWidth: 3,
    borderLeftColor: C.bd,
  },
  rankNum: { width: 24, fontFamily: 'Times-Bold', fontSize: 13, color: C.amber },
  rankLabel: { flex: 1, fontFamily: 'Helvetica', fontSize: 10, color: C.text, lineHeight: 1.3, marginRight: 10 },
  rankVal: { width: 54, fontFamily: 'Helvetica-Bold', fontSize: 10, color: C.amber, textAlign: 'right' },
  // Species spotlight page
  ssPhoto: { width: '100%', height: 240, objectFit: 'cover' },
  ssBody: { paddingLeft: 34, paddingRight: 34, paddingTop: 14 },
  ssName: { fontFamily: 'Times-Bold', fontSize: 28, color: C.amber, marginBottom: 3 },
  ssLine: { width: 40, height: 3, backgroundColor: C.amber, marginBottom: 12 },
  ssMeta: { fontFamily: 'Helvetica', fontSize: 10, color: C.textMuted, lineHeight: 1.5, marginBottom: 10 },
  ssDesc: { fontFamily: 'Helvetica', fontSize: 10.5, color: C.textMid, lineHeight: 1.65 },
  ssUserNotes: { borderLeftWidth: 2, borderLeftColor: C.amber, paddingLeft: 12, marginTop: 12 },
  ssUserNotesText: { fontFamily: 'Helvetica', fontSize: 10.5, color: C.textMid, lineHeight: 1.65 },
  spotSpreadGrid: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: -6, marginRight: -6 },
  spotSpreadCell: { width: '50%', paddingLeft: 6, paddingRight: 6, marginBottom: 12 },
  spotSpreadCard: { borderWidth: 1, borderColor: C.bd, borderRadius: 7, backgroundColor: C.bgCard },
  spotSpreadPhoto: { width: '100%', height: 150, objectFit: 'cover' },
  spotSpreadBody: { paddingTop: 10, paddingBottom: 12, paddingLeft: 12, paddingRight: 12 },
  spotSpreadName: { fontFamily: 'Times-Bold', fontSize: 15, color: C.text, lineHeight: 1.2, marginBottom: 4 },
  spotSpreadMeta: { fontFamily: 'Helvetica', fontSize: 8.5, color: C.amber, lineHeight: 1.35, marginBottom: 6 },
  spotSpreadDesc: { fontFamily: 'Helvetica', fontSize: 8.5, color: C.textMid, lineHeight: 1.45 },
  spotSpreadNotes: { borderLeftWidth: 2, borderLeftColor: C.amber, paddingLeft: 8, marginTop: 8 },
  spotSpreadNotesText: { fontFamily: 'Helvetica', fontSize: 8.5, color: C.textMuted, lineHeight: 1.45 },
  photoRibbon: { flexDirection: 'row', marginLeft: -4, marginRight: -4, marginTop: 16, marginBottom: 12 },
  photoRibbonCell: { flex: 1, paddingLeft: 4, paddingRight: 4 },
  photoRibbonImage: { width: '100%', height: 86, objectFit: 'cover', borderWidth: 1, borderColor: C.bdDim },
  // Species folders page
  folderRow: {
    paddingTop: 9,
    paddingBottom: 9,
    paddingLeft: 12,
    paddingRight: 12,
    marginBottom: 6,
    backgroundColor: C.bgCard,
    borderWidth: 1,
    borderColor: C.bdDim,
    borderRadius: 5,
  },
  folderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
  folderMeta: { fontFamily: 'Helvetica', fontSize: 8, color: C.textDim, letterSpacing: 0.6 },
  folderBadge: {
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 7,
    paddingRight: 7,
    borderWidth: 1,
    borderColor: C.bdAcc,
    backgroundColor: C.bgDeep,
  },
  folderBadgeText: { fontFamily: 'Helvetica-Bold', fontSize: 7.5, color: C.amber, letterSpacing: 0.5 },
  folderName: { fontFamily: 'Times-Bold', fontSize: 12.5, color: C.text, lineHeight: 1.25, marginBottom: 3 },
  folderLocation: { fontFamily: 'Helvetica', fontSize: 8.5, color: C.textMuted, lineHeight: 1.35 },
  outingRow: {
    borderWidth: 1,
    borderColor: C.bdDim,
    borderLeftWidth: 3,
    borderLeftColor: C.green,
    borderRadius: 5,
    backgroundColor: C.bgCard,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 10,
    paddingRight: 10,
    marginBottom: 6,
  },
  outingTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 4 },
  outingDate: { fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: C.text },
  outingCount: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: C.amber },
  outingMeta: { fontFamily: 'Helvetica', fontSize: 8, color: C.textMuted, lineHeight: 1.35 },
  sectionDeck: {
    borderWidth: 1,
    borderColor: C.bdDim,
    borderRadius: 8,
    backgroundColor: C.bgSoft,
    paddingTop: 10,
    paddingBottom: 10,
    paddingLeft: 12,
    paddingRight: 12,
    marginBottom: 14,
  },
  // Footer
  footer: { position: 'absolute', bottom: 14, left: 34, right: 34, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontFamily: 'Helvetica', fontSize: 7.5, color: C.textDim },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDate(v: string): Date | null {
  const d = new Date(`${v}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function fmtDate(v: string): string {
  const d = parseDate(v);
  if (!d) return v;
  return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

function monthName(idx: number): string {
  return MONTH_NAMES[idx] ?? 'Unknown';
}

function spotLabel(f: Pick<FindForPdf, 'country' | 'region' | 'location_note'>): string {
  return [f.country, f.region, f.location_note].filter(Boolean).join(' / ');
}

function uniqueCount(vals: string[]): number {
  return new Set(vals.filter(Boolean)).size;
}

function plainSpeciesName(name: string): string {
  return name.replace(/\*([^*]+)\*/g, '$1');
}

function buildSpeciesRanking(finds: FindForPdf[]): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const f of finds) map.set(f.species_name, (map.get(f.species_name) ?? 0) + 1);
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count }));
}

function buildMonthRanking(finds: FindForPdf[]): { label: string; count: number }[] {
  const map = new Map<number, number>();
  for (const f of finds) {
    const d = parseDate(f.date_found);
    if (d) map.set(d.getMonth(), (map.get(d.getMonth()) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([m, count]) => ({ label: monthName(m), count }));
}

function buildSpotRanking(finds: FindForPdf[]): { label: string; count: number }[] {
  const map = new Map<string, number>();
  for (const f of finds) {
    const lbl = spotLabel(f);
    if (lbl) map.set(lbl, (map.get(lbl) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label, count]) => ({ label, count }));
}

function buildFieldOutings(finds: FindForPdf[]): {
  date: string;
  count: number;
  locations: string[];
  species: string[];
}[] {
  const map = new Map<string, { date: string; count: number; locations: Set<string>; species: Set<string> }>();
  for (const find of finds) {
    if (!find.date_found) continue;
    const entry = map.get(find.date_found) ?? {
      date: find.date_found,
      count: 0,
      locations: new Set<string>(),
      species: new Set<string>(),
    };
    entry.count += 1;
    const loc = spotLabel(find);
    if (loc) entry.locations.add(loc);
    if (find.species_name) entry.species.add(find.species_name);
    map.set(find.date_found, entry);
  }
  return Array.from(map.values())
    .map((entry) => ({
      date: entry.date,
      count: entry.count,
      locations: Array.from(entry.locations).sort((a, b) => a.localeCompare(b)),
      species: Array.from(entry.species).sort((a, b) => a.localeCompare(b)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function getSpeciesPhoto(finds: FindForPdf[], name: string): string | null {
  return finds.find(f => f.species_name === name && f.photos_base64.length > 0)?.photos_base64[0] ?? null;
}

function buildAutoSpeciesDesc(finds: FindForPdf[], name: string): string {
  const sf = finds.filter(f => f.species_name === name);
  const spots = new Set(sf.map(spotLabel).filter(Boolean));
  const sorted = [...sf].sort((a, b) => a.date_found.localeCompare(b.date_found));
  const monthMap = new Map<number, number>();
  for (const f of sf) {
    const d = parseDate(f.date_found);
    if (d) monthMap.set(d.getMonth(), (monthMap.get(d.getMonth()) ?? 0) + 1);
  }
  const peak = Array.from(monthMap.entries()).sort((a, b) => b[1] - a[1])[0];

  const parts: string[] = [
    `Found ${sf.length} time${sf.length === 1 ? '' : 's'}`,
  ];
  if (spots.size > 1) parts.push(`across ${spots.size} distinct locations`);
  else if (spots.size === 1) parts.push(`at ${[...spots][0]}`);
  if (sorted.length > 0) parts.push(`first recorded ${fmtDate(sorted[0].date_found)}`);
  if (peak) parts.push(`most active in ${monthName(peak[0])}`);

  return parts.join('. ') + '.';
}

function getTopSpeciesWithPhotos(finds: FindForPdf[], n: number): string[] {
  return buildSpeciesRanking(finds)
    .filter(({ label, count }) =>
      count >= 2 && finds.some(f => f.species_name === label && f.photos_base64.length > 0),
    )
    .slice(0, n)
    .map(({ label }) => label);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

function getPhotoRibbon(finds: FindForPdf[], names: string[], offset = 0): string[] {
  return names
    .slice(offset, offset + 3)
    .map((name) => getSpeciesPhoto(finds, name))
    .filter((photo): photo is string => Boolean(photo));
}

function buildFolderSummary(
  finds: FindForPdf[],
  speciesName: string,
): { name: string; count: number; firstDate: string | null; latestLocation: string } {
  const speciesFinds = finds.filter((f) => f.species_name === speciesName);
  const sorted = [...speciesFinds].sort((a, b) => b.date_found.localeCompare(a.date_found));
  const earliest = [...speciesFinds].sort((a, b) => a.date_found.localeCompare(b.date_found))[0];

  return {
    name: speciesName,
    count: speciesFinds.length,
    firstDate: earliest?.date_found ?? null,
    latestLocation: spotLabel(sorted[0]) || 'Location not recorded',
  };
}

export function SmokeTestDocument({ finds }: SmokeTestProps) {
  const uniqueSpecies = uniqueCount(finds.map((f) => f.species_name));
  const uniqueSpots = uniqueCount(finds.map(spotLabel));
  const recentFinds = finds.slice(0, 3);
  const heroPhoto = finds.find((f) => f.photos_base64.length > 0)?.photos_base64[0] ?? null;

  return (
    <Document>
      <Page size="A4" style={S.page}>
        <Text style={S.eyebrow}>Quick PDF Check</Text>
        <Text style={S.h2}>Smoke Test</Text>
        <View style={S.amberLine} />
        <Text style={[S.body, { marginBottom: 14 }]}>
          This is a lightweight PDF used only to confirm export rendering works correctly, including one photo.
        </Text>

        {heroPhoto ? (
          <Image
            src={heroPhoto}
            style={{ width: '100%', height: 210, objectFit: 'cover', marginBottom: 14 }}
          />
        ) : (
          <View style={S.coverNoPhoto}>
            <Text style={S.coverNoPhotoText}>Gljivobook</Text>
          </View>
        )}

        <View style={S.grid3}>
          <View style={S.cell3}><StatCard value={`${finds.length}`} label="Sampled finds" /></View>
          <View style={S.cell3}><StatCard value={`${uniqueSpecies}`} label="Species" /></View>
          <View style={S.cell3}><StatCard value={`${uniqueSpots}`} label="Locations" /></View>
        </View>

        <Text style={[S.eyebrow, { marginBottom: 10 }]}>Recent Sample</Text>
        {recentFinds.map((find, i) => (
          <View
            key={`smoke-${i}`}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              paddingTop: 6,
              paddingBottom: 6,
              borderBottomWidth: 1,
              borderBottomColor: C.bdDim,
            }}
          >
            <Text style={{ width: 92, fontFamily: 'Helvetica', fontSize: 8.5, color: C.textDim }}>
              {fmtDate(find.date_found)}
            </Text>
            <Text style={{ flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: C.text }}>
              {plainSpeciesName(find.species_name)}
            </Text>
          </View>
        ))}

        <PageFooter left="Gljivobook Journal" right="Smoke test" />
      </Page>
    </Document>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PageFooter({ left, right }: { left: string; right?: string }) {
  return (
    <View style={S.footer} fixed>
      <Text style={S.footerText}>{left}</Text>
      {right ? <Text style={S.footerText}>{right}</Text> : null}
    </View>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={S.statInner}>
      <Text style={S.statVal}>{value}</Text>
      <Text style={S.statLbl}>{label}</Text>
    </View>
  );
}

function HighlightCard({ label, text }: { label: string; text: string }) {
  return (
    <View style={S.hlCard}>
      <Text style={S.hlLabel}>{label}</Text>
      <Text style={S.hlText}>{text}</Text>
    </View>
  );
}

function SectionIntro({ text }: { text: string }) {
  return (
    <View style={S.sectionDeck}>
      <Text style={S.bodySmall}>{text}</Text>
    </View>
  );
}

function BarChart({ items, maxValue }: { items: { label: string; count: number }[]; maxValue: number }) {
  return (
    <View>
      {items.map((item, i) => {
        const pct = maxValue > 0 ? Math.max(2, (item.count / maxValue) * 100) : 2;
        return (
          <View key={`bar-${i}-${item.label}`} style={S.barRow}>
            <Text style={S.barLabel}>{plainSpeciesName(item.label)}</Text>
            <View style={S.barTrack}>
              <View style={[S.barFill, { width: `${pct}%` }]} />
            </View>
            <Text style={S.barNum}>{item.count}</Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MushroomJournal({ finds, speciesNotes, smokeTest = false }: Props) {
  const currentYear = new Date().getFullYear();
  const thisYear = finds.filter(f => parseDate(f.date_found)?.getFullYear() === currentYear);
  const totalPhotos = finds.reduce((sum, find) => sum + find.photo_count, 0);
  const totalFinds = finds.length;

  // Cover
  const heroPhoto = finds.find(f => f.photos_base64.length > 0)?.photos_base64[0] ?? null;
  const uniqueSpecies = uniqueCount(finds.map(f => f.species_name));
  const uniqueSpots = uniqueCount(finds.map(spotLabel));
  const datedFinds = finds
    .map(f => parseDate(f.date_found))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  const yearSpan =
    datedFinds.length > 1
      ? `${datedFinds[0].getFullYear()}–${datedFinds[datedFinds.length - 1].getFullYear()}`
      : datedFinds.length === 1
        ? `${datedFinds[0].getFullYear()}`
        : '';

  // Stats page
  const speciesRanking = buildSpeciesRanking(finds);
  const monthRanking = buildMonthRanking(finds);
  const spotRanking = buildSpotRanking(finds);
  const fieldOutings = buildFieldOutings(finds);
  const speciesMax = speciesRanking[0]?.count ?? 1;
  const monthMax = monthRanking[0]?.count ?? 1;
  const firstOuting = fieldOutings[fieldOutings.length - 1] ?? null;

  // Year review
  const yearSpeciesRanking = buildSpeciesRanking(thisYear);
  const yearTopSpecies = yearSpeciesRanking[0];
  const yearTopSpot = buildSpotRanking(thisYear)[0];
  const yearTopMonth = buildMonthRanking(thisYear)[0];
  const yearChron = [...thisYear].sort((a, b) => a.date_found.localeCompare(b.date_found));

  // Species spotlights
  const spotlightNames = getTopSpeciesWithPhotos(finds, MAX_SPOTLIGHT_PAGES * SPOTLIGHTS_PER_PAGE);
  const spotlightPages = chunkArray(spotlightNames, SPOTLIGHTS_PER_PAGE);
  const notesMap = new Map(speciesNotes.map(n => [n.species_name, n.notes]));
  const folderRows = speciesRanking
    .slice(0, MAX_FOLDER_ROWS)
    .map((item) => buildFolderSummary(finds, item.label));
  const introRibbon = getPhotoRibbon(finds, spotlightNames, 0);
  const reviewRibbon = getPhotoRibbon(finds, spotlightNames, 3);
  const rankingRibbon = getPhotoRibbon(finds, spotlightNames, 6);
  const folderRibbon = getPhotoRibbon(finds, spotlightNames, 9);

  return (
    <Document>

      {/* ── COVER ─────────────────────────────────────────────────────────── */}
      <Page size="A4" style={S.coverPage}>
        {heroPhoto ? (
          <Image src={heroPhoto} style={S.coverHeroPhoto} />
        ) : null}
        <View style={S.coverAmberStripe} />
        <View style={S.coverBody}>
          <View style={S.coverPanel}>
          <Text style={S.eyebrow}>Gljivobook</Text>
          <Text style={{ fontFamily: 'Times-Bold', fontSize: 34, color: C.text, lineHeight: 1.12, marginBottom: 12 }}>
            {'Mushroom\nField Journal'}
          </Text>
          <View style={S.coverAmberLine} />
          <Text style={[S.body, { color: C.textMuted }]}>
            {`A statistics-led report of your mushroom finds, field outings, locations, seasons, and species history.${yearSpan ? ` Covering ${yearSpan}.` : ''}`}
          </Text>
          </View>
          <View style={S.coverStatRow}>
            <View style={S.coverStatCell}>
              <Text style={S.coverStatVal}>{totalFinds}</Text>
              <Text style={S.coverStatLbl}>Finds</Text>
            </View>
            <View style={S.coverStatCell}>
              <Text style={S.coverStatVal}>{uniqueSpecies}</Text>
              <Text style={S.coverStatLbl}>Species</Text>
            </View>
            <View style={S.coverStatCell}>
              <Text style={S.coverStatVal}>{fieldOutings.length}</Text>
              <Text style={S.coverStatLbl}>Field outings</Text>
            </View>
          </View>
        </View>
        <PageFooter left="Gljivobook Journal" />
      </Page>

      {/* ── COLLECTION STATS ──────────────────────────────────────────────── */}
      <Page size="A4" style={S.page}>
        <Text style={S.eyebrow}>Overview</Text>
        <Text style={S.h2}>Collection Stats</Text>
        <View style={S.amberLine} />

        <View style={S.grid3}>
          <View style={S.cell3}><StatCard value={`${totalFinds}`} label="Recorded finds" /></View>
          <View style={S.cell3}><StatCard value={`${totalPhotos}`} label="Photos archived" /></View>
          <View style={S.cell3}><StatCard value={`${uniqueSpecies}`} label="Unique species" /></View>
          <View style={S.cell3}><StatCard value={`${uniqueSpots}`} label="Locations" /></View>
          <View style={S.cell3}><StatCard value={`${fieldOutings.length}`} label="Field outings" /></View>
          <View style={S.cell3}><StatCard value={monthRanking[0]?.label ?? '—'} label="Best month" /></View>
          <View style={S.cell3}><StatCard value={datedFinds.length > 0 ? fmtDate(datedFinds[0].toISOString().split('T')[0]) : '—'} label="First find" /></View>
          <View style={S.cell3}><StatCard value={yearSpan || '—'} label="Journal span" /></View>
          <View style={S.cell3}><StatCard value={speciesRanking[0] ? plainSpeciesName(speciesRanking[0].label) : '—'} label="Most found" /></View>
        </View>

        <Text style={[S.eyebrow, { marginBottom: 10 }]}>Top Species by Finds</Text>
        <BarChart items={speciesRanking.slice(0, 12)} maxValue={speciesMax} />

        <View style={S.divider} />

        <Text style={[S.eyebrow, { marginBottom: 10 }]}>Best Months by Finds</Text>
        <BarChart items={monthRanking} maxValue={monthMax} />
        {introRibbon.length > 0 ? (
          <View style={S.photoRibbon}>
            {introRibbon.map((photo, index) => (
              <View key={`intro-ribbon-${index}`} style={S.photoRibbonCell}>
                <Image src={photo} style={S.photoRibbonImage} />
              </View>
            ))}
          </View>
        ) : null}

        <PageFooter left="Gljivobook Journal" />
      </Page>

      {!smokeTest && fieldOutings.length > 0 ? (
        <Page size="A4" style={S.page}>
          <Text style={S.eyebrow}>Field rhythm</Text>
          <Text style={S.h2}>Your Field Outings</Text>
          <View style={S.amberLine} />
          <SectionIntro text="Each row is one day in the field, showing how many finds, species, and locations were recorded that day." />

          {fieldOutings.slice(0, 14).map((outing) => (
            <View key={`outing-${outing.date}`} style={S.outingRow}>
              <View style={S.outingTop}>
                <Text style={S.outingDate}>{fmtDate(outing.date)}</Text>
                <Text style={S.outingCount}>
                  {`${outing.count} find${outing.count === 1 ? '' : 's'} / ${outing.species.length} species / ${outing.locations.length} location${outing.locations.length === 1 ? '' : 's'}`}
                </Text>
              </View>
              <Text style={S.outingMeta}>
                {outing.locations.length > 0
                  ? outing.locations.slice(0, 3).join(' / ')
                  : 'No location recorded'}
                {outing.locations.length > 3 ? ` +${outing.locations.length - 3} more` : ''}
              </Text>
              <Text style={S.outingMeta}>
                {outing.species.slice(0, 5).map(plainSpeciesName).join(', ')}
                {outing.species.length > 5 ? ` +${outing.species.length - 5} more species` : ''}
              </Text>
            </View>
          ))}

          <PageFooter left="Field Outings" right={`${fieldOutings.length} total outings`} />
        </Page>
      ) : null}

      {!smokeTest && spotlightPages[0] ? (
        <Page size="A4" style={S.page}>
          <Text style={S.eyebrow}>Field Notes</Text>
          <Text style={S.h2}>Species Highlights</Text>
          <View style={S.amberLine} />
          <SectionIntro text="A visual break between the numbers, featuring the species that show up most often in your journal." />
          <View style={S.spotSpreadGrid}>
            {spotlightPages[0].map((name) => {
              const photo = getSpeciesPhoto(finds, name);
              const speciesFinds = finds.filter(f => f.species_name === name);
              const userNotes = notesMap.get(name);
              const desc = buildAutoSpeciesDesc(finds, name);
              const locations = [...new Set(speciesFinds.map(spotLabel).filter(Boolean))];

              return (
                <View key={`spot-spread-intro-${name}`} style={S.spotSpreadCell}>
                  <View style={S.spotSpreadCard}>
                    {photo ? <Image src={photo} style={S.spotSpreadPhoto} /> : null}
                    <View style={S.spotSpreadBody}>
                      <Text style={S.spotSpreadName}>{plainSpeciesName(name)}</Text>
                      <Text style={S.spotSpreadMeta}>
                        {`${speciesFinds.length} find${speciesFinds.length === 1 ? '' : 's'} / ${speciesFinds.reduce((sum, find) => sum + find.photo_count, 0)} photo${speciesFinds.reduce((sum, find) => sum + find.photo_count, 0) === 1 ? '' : 's'}`}
                        {locations.length > 0
                          ? ` · ${locations.slice(0, 2).join(' · ')}${locations.length > 2 ? ` +${locations.length - 2} more` : ''}`
                          : ''}
                      </Text>
                      <Text style={S.spotSpreadDesc}>{desc}</Text>
                      {userNotes && userNotes.trim() ? (
                        <View style={S.spotSpreadNotes}>
                          <Text style={S.spotSpreadNotesText}>{userNotes}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
          <PageFooter left="Species Highlights" right={`Page 1 of ${spotlightPages.length}`} />
        </Page>
      ) : null}

      {smokeTest ? null : (
        <>

          {/* ── YEAR IN REVIEW ────────────────────────────────────────────────── */}
          <Page size="A4" style={S.page}>
            <Text style={S.eyebrow}>{currentYear}</Text>
            <Text style={S.h2}>{currentYear} in Review</Text>
            <View style={S.amberLine} />

            <View style={S.grid2}>
              <View style={S.cell2}><StatCard value={`${thisYear.length}`} label={`${currentYear} finds`} /></View>
              <View style={S.cell2}><StatCard value={`${thisYear.reduce((sum, find) => sum + find.photo_count, 0)}`} label={`${currentYear} photos`} /></View>
              <View style={S.cell2}><StatCard value={`${uniqueCount(thisYear.map(f => f.species_name))}`} label="Species this year" /></View>
              <View style={S.cell2}><StatCard value={`${uniqueCount(thisYear.map(spotLabel))}`} label="Spots this year" /></View>
              <View style={S.cell2}><StatCard value={`${uniqueCount(buildMonthRanking(thisYear).map(m => m.label))}`} label="Active months" /></View>
            </View>

            {thisYear.length > 0 ? (
              <>
                <View style={S.spotBox}>
                  <Text style={S.spotEyebrow}>Year Spotlight</Text>
                  <Text style={S.spotText}>
                    {`${currentYear} brought ${thisYear.length} recorded find${thisYear.length === 1 ? '' : 's'} and ${thisYear.reduce((sum, find) => sum + find.photo_count, 0)} archived photo${thisYear.reduce((sum, find) => sum + find.photo_count, 0) === 1 ? '' : 's'} across ${uniqueCount(thisYear.map(f => f.species_name))} species and ${uniqueCount(thisYear.map(spotLabel))} distinct spot${uniqueCount(thisYear.map(spotLabel)) === 1 ? '' : 's'}.`}
                  </Text>
                </View>

                {yearTopSpecies && (
                  <HighlightCard
                    label="Most Recorded Species"
                    text={`${plainSpeciesName(yearTopSpecies.label)} led with ${yearTopSpecies.count} find${yearTopSpecies.count === 1 ? '' : 's'}.`}
                  />
                )}
                {yearTopSpot && (
                  <HighlightCard
                    label="Favourite Spot"
                    text={`${yearTopSpot.label} - ${yearTopSpot.count} find${yearTopSpot.count === 1 ? '' : 's'} this year.`}
                  />
                )}
                {yearTopMonth && (
                  <HighlightCard
                    label="Peak Month"
                    text={`${yearTopMonth.label} was your busiest month with ${yearTopMonth.count} find${yearTopMonth.count === 1 ? '' : 's'}.`}
                  />
                )}
                {yearChron.length > 0 && (
                  <HighlightCard
                    label="Season Bookends"
                    text={`Opened with ${plainSpeciesName(yearChron[0].species_name)} on ${fmtDate(yearChron[0].date_found)}${yearChron.length > 1 ? `. Most recent: ${plainSpeciesName(yearChron[yearChron.length - 1].species_name)} on ${fmtDate(yearChron[yearChron.length - 1].date_found)}` : ''}.`}
                  />
                )}
              </>
            ) : (
              <View style={S.spotBox}>
                <Text style={S.spotEyebrow}>Year Spotlight</Text>
                <Text style={S.spotText}>
                  {`No photos recorded for ${currentYear} yet. Your full journal follows.`}
                </Text>
              </View>
            )}
            {reviewRibbon.length > 0 ? (
              <View style={S.photoRibbon}>
                {reviewRibbon.map((photo, index) => (
                  <View key={`review-ribbon-${index}`} style={S.photoRibbonCell}>
                    <Image src={photo} style={S.photoRibbonImage} />
                  </View>
                ))}
              </View>
            ) : null}

        <PageFooter left="Gljivobook Journal" />
          </Page>

          {spotlightPages[1] ? (
            <Page size="A4" style={S.page}>
              <Text style={S.eyebrow}>Field Notes</Text>
              <Text style={S.h2}>Collection Highlights</Text>
              <View style={S.amberLine} />
              <SectionIntro text="More of the species that define the shape of your collection, grouped into a denser photo spread." />
              <View style={S.spotSpreadGrid}>
                {spotlightPages[1].map((name) => {
                  const photo = getSpeciesPhoto(finds, name);
                  const speciesFinds = finds.filter(f => f.species_name === name);
                  const userNotes = notesMap.get(name);
                  const desc = buildAutoSpeciesDesc(finds, name);
                  const locations = [...new Set(speciesFinds.map(spotLabel).filter(Boolean))];

                  return (
                    <View key={`spot-spread-middle-${name}`} style={S.spotSpreadCell}>
                      <View style={S.spotSpreadCard}>
                        {photo ? <Image src={photo} style={S.spotSpreadPhoto} /> : null}
                        <View style={S.spotSpreadBody}>
                          <Text style={S.spotSpreadName}>{plainSpeciesName(name)}</Text>
                          <Text style={S.spotSpreadMeta}>
                            {`${speciesFinds.length} find${speciesFinds.length === 1 ? '' : 's'} / ${speciesFinds.reduce((sum, find) => sum + find.photo_count, 0)} photo${speciesFinds.reduce((sum, find) => sum + find.photo_count, 0) === 1 ? '' : 's'}`}
                            {locations.length > 0
                              ? ` · ${locations.slice(0, 2).join(' · ')}${locations.length > 2 ? ` +${locations.length - 2} more` : ''}`
                              : ''}
                          </Text>
                          <Text style={S.spotSpreadDesc}>{desc}</Text>
                          {userNotes && userNotes.trim() ? (
                            <View style={S.spotSpreadNotes}>
                              <Text style={S.spotSpreadNotesText}>{userNotes}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
              <PageFooter left="Collection Highlights" right={`Page 2 of ${spotlightPages.length}`} />
            </Page>
          ) : null}

          {/* ── TOP 10 SPECIES ────────────────────────────────────────────────── */}
          <Page size="A4" style={S.page}>
            <Text style={S.eyebrow}>Rankings</Text>
            <Text style={S.h2}>Top Species</Text>
            <View style={S.amberLine} />
            <SectionIntro text="All species ranked by recorded finds across your journal, paired with your most productive locations." />

        {speciesRanking.slice(0, 10).map((item, i) => {
          const pct = speciesMax > 0 ? Math.max(2, (item.count / speciesMax) * 100) : 2;
          const isFirst = i === 0;
          return (
            <View
              key={`rank-${i}`}
              style={[S.rankRowContainer, isFirst ? { borderLeftColor: C.amber, borderLeftWidth: 3 } : {}]}
            >
              <Text style={S.rankNum}>{i + 1}</Text>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={S.rankLabel}>{plainSpeciesName(item.label)}</Text>
                <View style={{ marginTop: 3, height: 6, backgroundColor: C.bgDeep }}>
                  <View style={{ height: 6, width: `${pct}%`, backgroundColor: isFirst ? C.amber : C.textDim }} />
                </View>
              </View>
              <Text style={S.rankVal}>{item.count} find{item.count === 1 ? '' : 's'}</Text>
            </View>
          );
        })}

        <View style={S.divider} />
        <Text style={[S.eyebrow, { marginBottom: 10 }]}>Top Spots</Text>
        {spotRanking.slice(0, 6).map((item, i) => (
          <View
            key={`spot-rank-${i}`}
            style={[S.rankRowContainer, { marginBottom: 2 }]}
          >
            <Text style={S.rankNum}>{i + 1}</Text>
            <Text style={[S.rankLabel, { marginRight: 0 }]}>{item.label}</Text>
            <Text style={S.rankVal}>{item.count} find{item.count === 1 ? '' : 's'}</Text>
          </View>
        ))}
        {rankingRibbon.length > 0 ? (
          <View style={S.photoRibbon}>
            {rankingRibbon.map((photo, index) => (
              <View key={`ranking-ribbon-${index}`} style={S.photoRibbonCell}>
                <Image src={photo} style={S.photoRibbonImage} />
              </View>
            ))}
          </View>
        ) : null}

            <PageFooter left="Gljivobook Journal" />
          </Page>

          {spotlightPages.slice(2).map((pageNames, pageIndex) => (
            <Page key={`spotlight-sheet-${pageIndex + 2}`} size="A4" style={S.page}>
              <Text style={S.eyebrow}>Field Notes</Text>
              <Text style={S.h2}>Species Highlights</Text>
              <View style={S.amberLine} />
              <SectionIntro text="More standout species, arranged as a compact visual spread instead of single-photo pages." />
              <View style={S.spotSpreadGrid}>
                {pageNames.map((name) => {
                  const photo = getSpeciesPhoto(finds, name);
                  const speciesFinds = finds.filter(f => f.species_name === name);
                  const userNotes = notesMap.get(name);
                  const desc = buildAutoSpeciesDesc(finds, name);
                  const locations = [...new Set(speciesFinds.map(spotLabel).filter(Boolean))];

                  return (
                    <View key={`spot-spread-rest-${name}`} style={S.spotSpreadCell}>
                      <View style={S.spotSpreadCard}>
                        {photo ? <Image src={photo} style={S.spotSpreadPhoto} /> : null}
                        <View style={S.spotSpreadBody}>
                          <Text style={S.spotSpreadName}>{plainSpeciesName(name)}</Text>
                          <Text style={S.spotSpreadMeta}>
                            {`${speciesFinds.length} find${speciesFinds.length === 1 ? '' : 's'} / ${speciesFinds.reduce((sum, find) => sum + find.photo_count, 0)} photo${speciesFinds.reduce((sum, find) => sum + find.photo_count, 0) === 1 ? '' : 's'}`}
                            {locations.length > 0
                              ? ` · ${locations.slice(0, 2).join(' · ')}${locations.length > 2 ? ` +${locations.length - 2} more` : ''}`
                              : ''}
                          </Text>
                          <Text style={S.spotSpreadDesc}>{desc}</Text>
                          {userNotes && userNotes.trim() ? (
                            <View style={S.spotSpreadNotes}>
                              <Text style={S.spotSpreadNotesText}>{userNotes}</Text>
                            </View>
                          ) : null}
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
              <PageFooter left="Species Highlights" right={`Page ${pageIndex + 3} of ${spotlightPages.length}`} />
            </Page>
          ))}

          {/* ── SPECIES FOLDERS ───────────────────────────────────────────────── */}
          <Page size="A4" style={S.page}>
            <Text style={S.eyebrow}>Collection</Text>
            <Text style={S.h2}>Species List</Text>
            <View style={S.amberLine} />
            <SectionIntro text="A clean species list for the collection, ordered by how often each species appears in your journal." />

            {folderRows.map((folder, i) => (
              <View key={`folder-${folder.name}-${i}`} style={S.folderRow}>
                <View style={S.folderTop}>
                  <Text style={S.folderMeta}>
                    {folder.firstDate ? `First recorded ${fmtDate(folder.firstDate)}` : 'No date recorded'}
                  </Text>
                  <View style={S.folderBadge}>
                    <Text style={S.folderBadgeText}>{`${folder.count} find${folder.count === 1 ? '' : 's'}`}</Text>
                  </View>
                </View>
                <Text style={S.folderName}>{plainSpeciesName(folder.name)}</Text>
                <Text style={S.folderLocation}>{folder.latestLocation}</Text>
              </View>
            ))}
            {folderRibbon.length > 0 ? (
              <View style={S.photoRibbon}>
                {folderRibbon.map((photo, index) => (
                  <View key={`folder-ribbon-${index}`} style={S.photoRibbonCell}>
                    <Image src={photo} style={S.photoRibbonImage} />
                  </View>
                ))}
              </View>
            ) : null}

            <PageFooter left="Species List" right={`${uniqueSpecies} total species`} />
          </Page>
        </>
      )}

    </Document>
  );
}
