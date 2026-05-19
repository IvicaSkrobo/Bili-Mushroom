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
    title: 'Real app previews',
    titleHr: 'Stvarni prikazi aplikacije',
    status: 'Next',
    statusHr: 'Sljedece',
    body: 'Replace the current stylized mockups with exact app screenshots from collection, map, species, stats, and PDF export.',
    bodyHr: 'Zamijeniti trenutne stilizirane mockupe tocnim screenshotovima iz zbirke, mape, vrsta, statistika i PDF exporta.',
  },
  {
    phase: 'Phase 3',
    phaseHr: 'Faza 3',
    title: 'Community and release comments',
    titleHr: 'Zajednica i komentari uz release',
    status: 'Planned',
    statusHr: 'Planirano',
    body: 'Add Giscus under release notes so users can report small bugs, ask questions, and discuss each version.',
    bodyHr: 'Dodati Giscus ispod release biljeski da korisnici mogu prijaviti male bugove, pitati i komentirati svaku verziju.',
  },
  {
    phase: 'Phase 4',
    phaseHr: 'Faza 4',
    title: 'Ideas and voting',
    titleHr: 'Ideje i glasanje',
    status: 'Planned',
    statusHr: 'Planirano',
    body: 'Connect feature ideas to GitHub Discussions or Issues, count reactions as votes, and highlight popular requests.',
    bodyHr: 'Spojiti ideje na GitHub Discussions ili Issues, brojati reakcije kao glasove i istaknuti popularne prijedloge.',
  },
  {
    phase: 'Phase 5',
    phaseHr: 'Faza 5',
    title: 'Updater and signed releases',
    titleHr: 'Updater i potpisani releaseovi',
    status: 'Planned',
    statusHr: 'Planirano',
    body: 'Finish the Tauri updater path once signing keys and release JSON are confirmed in GitHub Actions.',
    bodyHr: 'Zavrsiti Tauri updater kad potvrdimo signing keys i release JSON kroz GitHub Actions.',
  },
];
