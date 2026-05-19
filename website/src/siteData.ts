export const release = {
  version: 'v0.2.28',
  date: 'May 19, 2026',
  installerUrl: 'https://github.com/IvicaSkrobo/Bili-Mushroom/releases/latest',
  notes: {
    en: [
      'Renamed the app to Gljivobook with a new open-book icon.',
      'Added first-run language selection and a subtle donate entry.',
      'Planned the website, release, community, ideas, and funding roadmap.',
    ],
    hr: [
      'Aplikacija je preimenovana u Gljivobook i dobila novu ikonu otvorene knjige.',
      'Dodan je odabir jezika na prvom pokretanju i diskretan link za donacije.',
      'Isplaniran je website, release, community, ideje i funding roadmap.',
    ],
  },
};

export const ideas = [
  { title: 'Better photo editor', titleHr: 'Bolji editor fotografija', votes: 42, status: 'Funding', statusHr: 'Financiranje' },
  { title: 'Species wish list', titleHr: 'Popis vrsta koje zelis pronaci', votes: 31, status: 'Popular', statusHr: 'Popularno' },
  { title: 'Offline map packs', titleHr: 'Offline paketi karata', votes: 24, status: 'Planned', statusHr: 'Planirano' },
];

export const funding = [
  {
    title: 'Better photo editor',
    titleHr: 'Bolji editor fotografija',
    current: 35,
    goal: 150,
  },
];

export const roadmap = [
  {
    phase: 'Phase 1',
    phaseHr: 'Faza 1',
    title: 'Website foundation',
    titleHr: 'Temelj websitea',
    status: 'Done',
    statusHr: 'Gotovo',
    body: 'Bilingual landing page, app-like theme, latest release fallback, donate strip, and GitHub Pages workflow.',
    bodyHr: 'Dvojezicna pocetna stranica, tema slicna aplikaciji, fallback za zadnji release, doniraj traka i GitHub Pages workflow.',
  },
  {
    phase: 'Phase 2',
    phaseHr: 'Faza 2',
    title: 'Real app alignment check',
    titleHr: 'Provjera prema stvarnoj aplikaciji',
    status: 'Next',
    statusHr: 'Sljedece',
    body: 'Audit the website against the real app: collection, species, map, and the full find workflow from import to edit, folder, map, and export.',
    bodyHr: 'Provjeriti website prema stvarnoj aplikaciji: zbirka, vrste, mapa i cijeli workflow nalaza od uvoza do uredjivanja, foldera, mape i exporta.',
  },
  {
    phase: 'Phase 3',
    phaseHr: 'Faza 3',
    title: 'Real app screenshots',
    titleHr: 'Stvarni screenshotovi aplikacije',
    status: 'Planned',
    statusHr: 'Planirano',
    body: 'Replace the stylized mockups with exact screenshots for collection, species, map, stats, and PDF export once demo data is ready.',
    bodyHr: 'Zamijeniti stilizirane mockupe tocnim screenshotovima za zbirku, vrste, mapu, statistike i PDF export kad demo podaci budu spremni.',
  },
  {
    phase: 'Phase 4',
    phaseHr: 'Faza 4',
    title: 'Community and release comments',
    titleHr: 'Zajednica i komentari uz release',
    status: 'Planned',
    statusHr: 'Planirano',
    body: 'Add Giscus under release notes so users can report small bugs, ask questions, and discuss each version.',
    bodyHr: 'Dodati Giscus ispod release biljeski da korisnici mogu prijaviti male bugove, pitati i komentirati svaku verziju.',
  },
  {
    phase: 'Phase 5',
    phaseHr: 'Faza 5',
    title: 'Ideas and voting',
    titleHr: 'Ideje i glasanje',
    status: 'Planned',
    statusHr: 'Planirano',
    body: 'Connect feature ideas to GitHub Discussions or Issues, count reactions as votes, and highlight popular requests.',
    bodyHr: 'Spojiti ideje na GitHub Discussions ili Issues, brojati reakcije kao glasove i istaknuti popularne prijedloge.',
  },
  {
    phase: 'Phase 6',
    phaseHr: 'Faza 6',
    title: 'Updater and signed releases',
    titleHr: 'Updater i potpisani releaseovi',
    status: 'Planned',
    statusHr: 'Planirano',
    body: 'Finish the Tauri updater path once signing keys and release JSON are confirmed in GitHub Actions.',
    bodyHr: 'Zavrsiti Tauri updater kad potvrdimo signing keys i release JSON kroz GitHub Actions.',
  },
];
