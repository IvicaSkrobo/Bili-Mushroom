import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface FindForPdf {
  species_name: string;
  date_found: string;
  country: string;
  region: string;
  location_note: string;
  lat: number | null;
  lng: number | null;
  notes: string;
  photos_base64: string[];
}

export interface SpeciesNoteForPdf {
  species_name: string;
  notes: string;
}

interface Props {
  finds: FindForPdf[];
  speciesNotes: SpeciesNoteForPdf[];
}

export const MAX_PDF_PAGES = 12;
const STATIC_PAGE_COUNT = 5;
export const MAX_SPOTLIGHT_PAGES = Math.max(0, MAX_PDF_PAGES - STATIC_PAGE_COUNT);
const MAX_RECENT_FINDS = 36;

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
  // Find entry page
  feTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 2 },
  feName: { fontFamily: 'Times-Bold', fontSize: 20, color: C.amber, flex: 1, lineHeight: 1.25 },
  feEntryNum: { fontFamily: 'Helvetica', fontSize: 8.5, color: C.textDim },
  feMeta: { fontFamily: 'Helvetica', fontSize: 9.5, color: C.textMuted, lineHeight: 1.45, marginBottom: 2 },
  feCoords: { fontFamily: 'Helvetica', fontSize: 8, color: C.textDim },
  fePhoto: { width: '100%', height: 260, objectFit: 'cover', marginTop: 12, marginBottom: 10 },
  feNotes: { fontFamily: 'Helvetica', fontSize: 10, color: C.textMid, lineHeight: 1.6, marginTop: 4 },
  feNoNotes: { fontFamily: 'Helvetica', fontSize: 9.5, color: C.textDim, marginTop: 4 },
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

export function MushroomJournal({ finds, speciesNotes }: Props) {
  const currentYear = new Date().getFullYear();
  const thisYear = finds.filter(f => parseDate(f.date_found)?.getFullYear() === currentYear);

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
  const spotlightNames = getTopSpeciesWithPhotos(finds, MAX_SPOTLIGHT_PAGES);
  const notesMap = new Map(speciesNotes.map(n => [n.species_name, n.notes]));
  const recentFinds = finds.slice(0, MAX_RECENT_FINDS);

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
            {`A personal record of every mushroom find — organised, mapped, and preserved.${yearSpan ? ` Covering ${yearSpan}.` : ''}`}
          </Text>
          <View style={S.coverStatRow}>
            <View style={S.coverStatCell}>
              <Text style={S.coverStatVal}>{finds.length}</Text>
              <Text style={S.coverStatLbl}>Total Finds</Text>
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
          <View style={S.cell3}><StatCard value={`${finds.length}`} label="Total finds" /></View>
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

        <PageFooter left="Bili Mushroom Journal" />
      </Page>

      {/* ── YEAR IN REVIEW ────────────────────────────────────────────────── */}
      <Page size="A4" style={S.page}>
        <Text style={S.eyebrow}>{currentYear}</Text>
        <Text style={S.h2}>{currentYear} in Review</Text>
        <View style={S.amberLine} />

        <View style={S.grid2}>
          <View style={S.cell2}><StatCard value={`${thisYear.length}`} label={`${currentYear} finds`} /></View>
          <View style={S.cell2}><StatCard value={`${uniqueCount(thisYear.map(f => f.species_name))}`} label="Species this year" /></View>
          <View style={S.cell2}><StatCard value={`${uniqueCount(thisYear.map(spotLabel))}`} label="Spots this year" /></View>
          <View style={S.cell2}><StatCard value={`${uniqueCount(buildMonthRanking(thisYear).map(m => m.label))}`} label="Active months" /></View>
        </View>

        {thisYear.length > 0 ? (
          <>
            <View style={S.spotBox}>
              <Text style={S.spotEyebrow}>Year Spotlight</Text>
              <Text style={S.spotText}>
                {`${currentYear} brought ${thisYear.length} logged find${thisYear.length === 1 ? '' : 's'} across ${uniqueCount(thisYear.map(f => f.species_name))} species and ${uniqueCount(thisYear.map(spotLabel))} distinct spot${uniqueCount(thisYear.map(spotLabel)) === 1 ? '' : 's'}.`}
              </Text>
            </View>

            {yearTopSpecies && (
              <HighlightCard
                label="Best Find This Year"
                text={`${yearTopSpecies.label} led with ${yearTopSpecies.count} find${yearTopSpecies.count === 1 ? '' : 's'}.`}
              />
            )}
            {yearTopSpot && (
              <HighlightCard
                label="Favourite Spot"
                text={`${yearTopSpot.label} — ${yearTopSpot.count} find${yearTopSpot.count === 1 ? '' : 's'} this year.`}
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
                text={`Opened with ${yearChron[0].species_name} on ${fmtDate(yearChron[0].date_found)}${yearChron.length > 1 ? `. Most recent: ${yearChron[yearChron.length - 1].species_name} on ${fmtDate(yearChron[yearChron.length - 1].date_found)}` : ''}.`}
              />
            )}
          </>
        ) : (
          <View style={S.spotBox}>
            <Text style={S.spotEyebrow}>Year Spotlight</Text>
            <Text style={S.spotText}>
              {`No finds recorded for ${currentYear} yet. Your full journal follows.`}
            </Text>
          </View>
        )}

        <PageFooter left="Bili Mushroom Journal" />
      </Page>

      {/* ── TOP 10 SPECIES ────────────────────────────────────────────────── */}
      <Page size="A4" style={S.page}>
        <Text style={S.eyebrow}>Rankings</Text>
        <Text style={S.h2}>Top Species</Text>
        <View style={S.amberLine} />
        <Text style={[S.bodySmall, { marginBottom: 14 }]}>All species ranked by total finds across your journal.</Text>

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

        <PageFooter left="Bili Mushroom Journal" />
      </Page>

      {/* ── SPECIES SPOTLIGHTS ────────────────────────────────────────────── */}
      {spotlightNames.map((name) => {
        const photo = getSpeciesPhoto(finds, name);
        const speciesFinds = finds.filter(f => f.species_name === name);
        const userNotes = notesMap.get(name);
        const desc = buildAutoSpeciesDesc(finds, name);
        const locations = [...new Set(speciesFinds.map(spotLabel).filter(Boolean))];

        return (
          <Page key={`spotlight-${name}`} size="A4" style={S.coverPage}>
            {photo ? <Image src={photo} style={S.ssPhoto} /> : null}
            <View style={[S.ssBody, { paddingTop: photo ? 14 : 36 }]}>
              <Text style={S.ssName}>{name}</Text>
              <View style={S.ssLine} />
              <Text style={S.ssMeta}>
                {`${speciesFinds.length} find${speciesFinds.length === 1 ? '' : 's'}`}
                {locations.length > 0
                  ? ` · ${locations.slice(0, 3).join(' · ')}${locations.length > 3 ? ` +${locations.length - 3} more` : ''}`
                  : ''}
              </Text>
              <Text style={S.ssDesc}>{desc}</Text>
              {userNotes && userNotes.trim() ? (
                <View style={S.ssUserNotes}>
                  <Text style={S.ssUserNotesText}>{userNotes}</Text>
                </View>
              ) : null}
            </View>
            <PageFooter left={`Species Spotlight · ${name}`} />
          </Page>
        );
      })}

      {/* ── RECENT FINDS (compact list, no photos) ────────────────────────── */}
      <Page size="A4" style={S.page}>
        <Text style={S.eyebrow}>Journal</Text>
        <Text style={S.h2}>Recent Finds</Text>
        <View style={S.amberLine} />
        <Text style={[S.bodySmall, { marginBottom: 14 }]}>
          {`Most recent ${Math.min(finds.length, MAX_RECENT_FINDS)} of ${finds.length} total entries.`}
        </Text>

        {recentFinds.map((find, i) => (
          <View
            key={`recent-${i}`}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              paddingTop: 5,
              paddingBottom: 5,
              borderBottomWidth: 1,
              borderBottomColor: C.bdDim,
            }}
          >
            <Text style={{ width: 90, fontFamily: 'Helvetica', fontSize: 8.5, color: C.textDim, paddingTop: 1 }}>
              {fmtDate(find.date_found)}
            </Text>
            <Text style={{ flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 9.5, color: C.text, lineHeight: 1.3 }}>
              {find.species_name}
            </Text>
            <Text style={{ width: 140, fontFamily: 'Helvetica', fontSize: 8.5, color: C.textMuted, textAlign: 'right', lineHeight: 1.3 }}>
              {spotLabel(find) || '—'}
            </Text>
          </View>
        ))}

        <PageFooter left="Bili Mushroom Journal" right={`${finds.length} total finds`} />
      </Page>

    </Document>
  );
}
