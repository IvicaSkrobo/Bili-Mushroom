import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

// ─── Interfaces ───────────────────────────────────────────────────────────────

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

interface Props {
  finds: FindForPdf[];
  speciesNotes: SpeciesNoteForPdf[];
  smokeTest?: boolean;
}

interface SmokeTestProps {
  finds: FindForPdf[];
}

export const MAX_PDF_PAGES = 12;
const STATIC_PAGE_COUNT = 5;
export const MAX_SPOTLIGHT_PAGES = Math.max(0, MAX_PDF_PAGES - STATIC_PAGE_COUNT);
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
  bg: '#0F0E09',
  bgCard: '#16130D',
  bgDeep: '#1C170E',
  bdDim: '#2D281B',
  bd: '#403923',
  bdAcc: '#5A4C21',
  amber: '#D4941A',
  text: '#F5E6C8',
  textMid: '#C4B28A',
  textMuted: '#8A7E5C',
  textDim: '#6B6048',
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
    color: C.textMuted,
    letterSpacing: 2,
    marginBottom: 8,
  },
  h2: { fontFamily: 'Times-Bold', fontSize: 21, color: C.text, marginBottom: 4 },
  body: { fontFamily: 'Helvetica', fontSize: 10, color: C.textMid, lineHeight: 1.55 },
  bodySmall: { fontFamily: 'Helvetica', fontSize: 9, color: C.textMuted, lineHeight: 1.45 },
  amberLine: { width: 44, height: 3, backgroundColor: C.amber, marginBottom: 14 },
  divider: { height: 1, backgroundColor: C.bdDim, marginTop: 10, marginBottom: 10 },
  // Stat grids
  grid2: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: -4, marginRight: -4, marginBottom: 12 },
  cell2: { width: '50%', paddingLeft: 4, paddingRight: 4, marginBottom: 8 },
  grid3: { flexDirection: 'row', flexWrap: 'wrap', marginLeft: -4, marginRight: -4, marginBottom: 12 },
  cell3: { width: '33.33%', paddingLeft: 4, paddingRight: 4, marginBottom: 8 },
  statInner: { borderWidth: 1, borderColor: C.bd, backgroundColor: C.bgCard, padding: 12, minHeight: 56 },
  statVal: { fontFamily: 'Times-Bold', fontSize: 20, color: C.text, marginBottom: 4 },
  statLbl: { fontFamily: 'Helvetica', fontSize: 7.5, color: C.textMuted, letterSpacing: 0.8 },
  // Bar chart
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  barLabel: { width: 118, fontFamily: 'Helvetica', fontSize: 9, color: C.textMid, lineHeight: 1.25 },
  barTrack: { flex: 1, height: 10, backgroundColor: C.bgDeep, marginRight: 8 },
  barFill: { height: 10, backgroundColor: C.amber },
  barNum: { width: 22, fontFamily: 'Helvetica-Bold', fontSize: 9, color: C.amber, textAlign: 'right' },
  // Highlight cards
  hlCard: { borderLeftWidth: 3, borderLeftColor: C.amber, paddingLeft: 12, marginBottom: 10 },
  hlLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: C.amber, letterSpacing: 0.8, marginBottom: 3 },
  hlText: { fontFamily: 'Helvetica', fontSize: 10, color: C.textMid, lineHeight: 1.5 },
  // Spotlight box
  spotBox: { borderWidth: 1, borderColor: C.bdAcc, backgroundColor: C.bgDeep, padding: 14, marginBottom: 14 },
  spotEyebrow: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: C.amber, letterSpacing: 1.2, marginBottom: 6 },
  spotText: { fontFamily: 'Times-Bold', fontSize: 14, color: C.text, lineHeight: 1.4 },
  // Cover
  coverHeroPhoto: { width: '100%', height: 248, objectFit: 'cover' },
  coverAmberStripe: { height: 4, backgroundColor: C.amber },
  coverBody: { paddingLeft: 34, paddingRight: 34, paddingTop: 20 },
  coverAmberLine: { width: 44, height: 3, backgroundColor: C.amber, marginBottom: 16 },
  coverStatRow: { flexDirection: 'row', marginTop: 20, marginLeft: -4, marginRight: -4 },
  coverStatCell: {
    flex: 1,
    marginLeft: 4,
    marginRight: 4,
    borderWidth: 1,
    borderColor: C.bd,
    backgroundColor: C.bgCard,
    padding: 12,
    alignItems: 'center',
  },
  coverStatVal: { fontFamily: 'Times-Bold', fontSize: 24, color: C.amber, marginBottom: 4, textAlign: 'center' },
  coverStatLbl: { fontFamily: 'Helvetica', fontSize: 7.5, color: C.textMuted, textAlign: 'center', letterSpacing: 0.8 },
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
    borderLeftWidth: 1,
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
  spotSpreadCard: { borderWidth: 1, borderColor: C.bd, backgroundColor: C.bgCard },
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
        ) : null}

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
              {find.species_name}
            </Text>
          </View>
        ))}

        <PageFooter left="Bili Mushroom Journal" right="Smoke test" />
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

function BarChart({ items, maxValue }: { items: { label: string; count: number }[]; maxValue: number }) {
  return (
    <View>
      {items.map((item, i) => {
        const pct = maxValue > 0 ? Math.max(2, (item.count / maxValue) * 100) : 2;
        return (
          <View key={`bar-${i}-${item.label}`} style={S.barRow}>
            <Text style={S.barLabel}>{item.label}</Text>
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
  const speciesMax = speciesRanking[0]?.count ?? 1;
  const monthMax = monthRanking[0]?.count ?? 1;

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
          <Text style={S.eyebrow}>Bili Mushroom</Text>
          <Text style={{ fontFamily: 'Times-Bold', fontSize: 32, color: C.text, lineHeight: 1.2, marginBottom: 12 }}>
            {'Foraging\nJournal'}
          </Text>
          <View style={S.coverAmberLine} />
          <Text style={[S.body, { color: C.textMuted }]}>
            {`A personal record of your mushroom photos — organised, mapped, and preserved.${yearSpan ? ` Covering ${yearSpan}.` : ''}`}
          </Text>
          <View style={S.coverStatRow}>
            <View style={S.coverStatCell}>
              <Text style={S.coverStatVal}>{totalPhotos}</Text>
              <Text style={S.coverStatLbl}>Total Photos</Text>
            </View>
            <View style={S.coverStatCell}>
              <Text style={S.coverStatVal}>{uniqueSpecies}</Text>
              <Text style={S.coverStatLbl}>Species</Text>
            </View>
            <View style={S.coverStatCell}>
              <Text style={S.coverStatVal}>{uniqueSpots}</Text>
              <Text style={S.coverStatLbl}>Locations</Text>
            </View>
          </View>
        </View>
        <PageFooter left="Bili Mushroom Journal" />
      </Page>

      {/* ── COLLECTION STATS ──────────────────────────────────────────────── */}
      <Page size="A4" style={S.page}>
        <Text style={S.eyebrow}>Overview</Text>
        <Text style={S.h2}>Collection Stats</Text>
        <View style={S.amberLine} />

        <View style={S.grid3}>
          <View style={S.cell3}><StatCard value={`${totalPhotos}`} label="Total photos" /></View>
          <View style={S.cell3}><StatCard value={`${uniqueSpecies}`} label="Unique species" /></View>
          <View style={S.cell3}><StatCard value={`${uniqueSpots}`} label="Locations" /></View>
          <View style={S.cell3}><StatCard value={datedFinds.length > 0 ? fmtDate(datedFinds[0].toISOString().split('T')[0]) : '—'} label="First find" /></View>
          <View style={S.cell3}><StatCard value={yearSpan || '—'} label="Journal span" /></View>
          <View style={S.cell3}><StatCard value={speciesRanking[0]?.label ?? '—'} label="Most found" /></View>
        </View>

        <Text style={[S.eyebrow, { marginBottom: 10 }]}>Top Species</Text>
        <BarChart items={speciesRanking.slice(0, 12)} maxValue={speciesMax} />

        <View style={S.divider} />

        <Text style={[S.eyebrow, { marginBottom: 10 }]}>Best Months</Text>
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

        <PageFooter left="Bili Mushroom Journal" />
      </Page>

      {!smokeTest && spotlightPages[0] ? (
        <Page size="A4" style={S.page}>
          <Text style={S.eyebrow}>Field Notes</Text>
          <Text style={S.h2}>Species Highlights</Text>
          <View style={S.amberLine} />
          <Text style={[S.bodySmall, { marginBottom: 14 }]}>
            A visual break between the numbers, featuring the species that show up most often in your journal.
          </Text>
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
                      <Text style={S.spotSpreadName}>{name}</Text>
                      <Text style={S.spotSpreadMeta}>
                        {`${speciesFinds.reduce((sum, find) => sum + find.photo_count, 0)} photo${speciesFinds.reduce((sum, find) => sum + find.photo_count, 0) === 1 ? '' : 's'}`}
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
                    {`${currentYear} brought ${thisYear.reduce((sum, find) => sum + find.photo_count, 0)} logged photo${thisYear.reduce((sum, find) => sum + find.photo_count, 0) === 1 ? '' : 's'} across ${uniqueCount(thisYear.map(f => f.species_name))} species and ${uniqueCount(thisYear.map(spotLabel))} distinct spot${uniqueCount(thisYear.map(spotLabel)) === 1 ? '' : 's'}.`}
                  </Text>
                </View>

                {yearTopSpecies && (
                  <HighlightCard
                    label="Most Photographed Species"
                    text={`${yearTopSpecies.label} led with ${yearTopSpecies.count} photo${yearTopSpecies.count === 1 ? '' : 's'}.`}
                  />
                )}
                {yearTopSpot && (
                  <HighlightCard
                    label="Favourite Spot"
                    text={`${yearTopSpot.label} — ${yearTopSpot.count} photo${yearTopSpot.count === 1 ? '' : 's'} this year.`}
                  />
                )}
                {yearTopMonth && (
                  <HighlightCard
                    label="Peak Month"
                    text={`${yearTopMonth.label} was your busiest month with ${yearTopMonth.count} photo${yearTopMonth.count === 1 ? '' : 's'}.`}
                  />
                )}
                {yearChron.length > 0 && (
                  <HighlightCard
                    label="Season Bookends"
                    text={`Opened with ${yearChron[0].species_name} on ${fmtDate(yearChron[0].date_found)}${yearChron.length > 1 ? `. Most recent: ${yearChron[yearChron.length - 1].species_name} on ${fmtDate(yearChron[yearChron.length - 1].date_found)}` : ''}.`}
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

            <PageFooter left="Bili Mushroom Journal" />
          </Page>

          {spotlightPages[1] ? (
            <Page size="A4" style={S.page}>
              <Text style={S.eyebrow}>Field Notes</Text>
              <Text style={S.h2}>Collection Highlights</Text>
              <View style={S.amberLine} />
              <Text style={[S.bodySmall, { marginBottom: 14 }]}>
                More of the species that define the shape of your collection, grouped into a denser photo spread.
              </Text>
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
                          <Text style={S.spotSpreadName}>{name}</Text>
                          <Text style={S.spotSpreadMeta}>
                            {`${speciesFinds.reduce((sum, find) => sum + find.photo_count, 0)} photo${speciesFinds.reduce((sum, find) => sum + find.photo_count, 0) === 1 ? '' : 's'}`}
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
            <Text style={[S.bodySmall, { marginBottom: 14 }]}>All species ranked by total photos across your journal.</Text>

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
                <Text style={S.rankLabel}>{item.label}</Text>
                <View style={{ marginTop: 3, height: 6, backgroundColor: C.bgDeep }}>
                  <View style={{ height: 6, width: `${pct}%`, backgroundColor: isFirst ? C.amber : C.textDim }} />
                </View>
              </View>
              <Text style={S.rankVal}>{item.count} photo{item.count === 1 ? '' : 's'}</Text>
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
            <Text style={S.rankVal}>{item.count} photo{item.count === 1 ? '' : 's'}</Text>
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

            <PageFooter left="Bili Mushroom Journal" />
          </Page>

          {spotlightPages.slice(2).map((pageNames, pageIndex) => (
            <Page key={`spotlight-sheet-${pageIndex + 2}`} size="A4" style={S.page}>
              <Text style={S.eyebrow}>Field Notes</Text>
              <Text style={S.h2}>Species Highlights</Text>
              <View style={S.amberLine} />
              <Text style={[S.bodySmall, { marginBottom: 14 }]}>
                More standout species, arranged as a compact visual spread instead of single-photo pages.
              </Text>
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
                          <Text style={S.spotSpreadName}>{name}</Text>
                          <Text style={S.spotSpreadMeta}>
                            {`${speciesFinds.reduce((sum, find) => sum + find.photo_count, 0)} photo${speciesFinds.reduce((sum, find) => sum + find.photo_count, 0) === 1 ? '' : 's'}`}
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
            <Text style={[S.bodySmall, { marginBottom: 14 }]}>
              A clean species list for the collection, ordered by how often each species appears in your journal.
            </Text>

            {folderRows.map((folder, i) => (
              <View key={`folder-${folder.name}-${i}`} style={S.folderRow}>
                <View style={S.folderTop}>
                  <Text style={S.folderMeta}>
                    {folder.firstDate ? `First recorded ${fmtDate(folder.firstDate)}` : 'No date recorded'}
                  </Text>
                  <View style={S.folderBadge}>
                    <Text style={S.folderBadgeText}>{`${folder.count} photo${folder.count === 1 ? '' : 's'}`}</Text>
                  </View>
                </View>
                <Text style={S.folderName}>{folder.name}</Text>
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
