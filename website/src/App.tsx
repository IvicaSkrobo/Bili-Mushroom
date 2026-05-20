import {
  BookOpen,
  ClipboardList,
  Download,
  ExternalLink,
  FolderOpen,
  HardDrive,
  Heart,
  Map,
  MessageCircle,
  Moon,
  ShieldCheck,
  Sparkles,
  Sprout,
  Star,
  AlertCircle,
  Sun,
  TrendingUp,
  Vote,
  Github,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { GiscusPanel } from './GiscusPanel';
import { downloadCountFrom, funding, ideas, release } from './siteData';

type Lang = 'en' | 'hr';

type RemoteRelease = {
  html_url: string;
  tag_name: string;
  name: string | null;
  published_at: string | null;
  body: string | null;
  assets?: Array<{
    name: string;
    browser_download_url: string;
    size: number;
    download_count?: number;
  }>;
};

type RemoteIssue = {
  number?: number;
  html_url: string;
  title: string;
  comments: number;
  updated_at?: string | null;
  state?: string;
  labels?: Array<string | { name?: string }>;
  pull_request?: unknown;
  reactions?: {
    total_count?: number;
  };
};

type VisibleIdea = {
  title: string;
  titleHr: string;
  votes: number;
  status: string;
  statusHr: string;
  url: string;
};

const configuredDonateUrl = import.meta.env.VITE_DONATE_URL as string | undefined;
const ideaSubmitUrl =
  'https://github.com/IvicaSkrobo/Bili-Mushroom/issues/new?template=feature_idea.yml&labels=idea';
const ideasListUrl = 'https://github.com/IvicaSkrobo/Bili-Mushroom/issues?q=is%3Aissue%20label%3Aidea';
const bugsListUrl = 'https://github.com/IvicaSkrobo/Bili-Mushroom/issues?q=is%3Aissue%20label%3Abug';
const repoUrl = 'https://github.com/IvicaSkrobo/Bili-Mushroom';

const copy = {
  en: {
    eyebrow: 'Local-first field journal for Windows',
    title: 'Mushroom Book',
    subtitle: 'Your foraging journal',
    intro: 'A quiet Windows app for saving mushroom finds, photos, notes, folders, maps, and seasons on your own computer.',
    download: 'Download for Windows',
    releaseDetails: 'Release details',
    installerReady: 'Direct installer',
    installerFallback: 'Release page',
    installerHint: 'Windows installer',
    releaseSource: 'GitHub release',
    releaseUpdated: 'Updated',
    appFacts: ['Windows app', 'Local data', 'No account'],
    support: 'Donate',
    supportHero: 'Donate if you like the app',
    latest: 'Latest release',
    changelog: 'Small changelog',
    language: 'Hrvatski',
    nav: ['Download', 'Changelog', 'Community', 'Ideas', 'Donate'],
    theme: 'Theme',
    fundingTop: 'Donate if you like it',
    pillars: [
      ['Collect', 'Photos, notes, species, dates, and folders stay together.'],
      ['Map', 'Filter your own finds by species, region, date, and zones.'],
      ['Understand', 'See seasons, outings, locations, and personal species history.'],
    ],
    workflowTitle: 'From find to archive',
    workflowBody: 'Add a find once, then keep it editable, searchable, mapped, and tied to its folder.',
    workflow: [
      ['Add', 'Import photos or create a manual find.'],
      ['Edit', 'Correct species, date, location, notes, badges, and photos later.'],
      ['Use', 'Open folders, filter maps, read stats, and export your archive.'],
    ],
    downloadBody:
      'Latest Windows download. Local fallback protects the page if GitHub returns old release data.',
    installTitle: 'Install notes',
    installBody:
      'Download the Windows setup file, run it, and if Windows SmartScreen appears choose More info, then Run anyway.',
    privacyTitle: 'Local by default',
    privacyBody:
      'Finds, notes, folders, and photos stay on your computer. Core cataloging works without an account or cloud service.',
    responsibilityTitle: 'Shared in good faith',
    responsibilityBody:
      'Mushroom Book was first made to help a fellow forager keep a personal archive, then shared with anyone who may find it useful. I hope you like it. Please keep your own backups: your data stays local and remains yours, and I cannot take responsibility for data loss, damaged files, or decisions made from your records.',
    communityTitle: 'Community without a custom backend',
    communityBody:
      'Questions, release comments, showcase posts, and feature ideas live through GitHub. Bug reports are sent from the app.',
    bugBoardTitle: 'Bug board',
    bugBoardBody: 'Unlisted overview of open GitHub bug reports. Bug reporting itself stays inside the app.',
    bugBoardLoading: 'Loading bug reports...',
    bugBoardEmpty: 'No public bug reports yet.',
    bugBoardAction: 'View all bugs',
    bugBoardBack: 'Back to website',
    bugStatusOpen: 'Open',
    bugStatusProgress: 'In progress',
    bugStatusFixed: 'Fixed - verify',
    bugStatusVerify: 'Needs verification',
    bugStatusVerified: 'Verified',
    ideasTitle: 'Ideas users can vote on',
    ideasBody:
      'Suggest features, vote with reactions, and push strong ideas toward funding goals.',
    ideaFlow: [
      ['1', 'Suggest', 'A user writes a feature idea.'],
      ['2', 'Vote', 'Others add reactions and comments.'],
      ['3', 'Fund', 'Strong ideas can become support goals.'],
    ],
    ideasAction: 'Add an idea',
    ideasList: 'View ideas',
    fundingTitle: 'Voluntary support',
    fundingBody:
      'Support the app from goodwill, or help push popular feature ideas forward.',
    donatePending: 'Donate link is coming soon.',
    screenshotsTitle: 'What the app covers',
    screenshots: ['Collection', 'Species', 'Map', 'Find workflow'],
    screenshotDetails: [
      'Grouped finds, folders, badges, search, and quick actions.',
      'Notes, other names, synonyms, recipes, and species history.',
      'Pins, filters, location picker, region zones, and popups.',
      'Import, manual add, edit details, crop, rotate, and export.',
    ],
    fundingGoalsTitle: 'App ideas that could come next',
    fundingGoalsBody: 'App features, not website tasks. Amounts are rough priority goals.',
    footer: 'Built for mushroom notes, maps, seasons, and local archives.',
    footerRepo: 'Source and releases',
  },
  hr: {
    eyebrow: 'Lokalni gljivarski dnevnik za Windows',
    title: 'Gljivobook',
    subtitle: 'Tvoj gljivarski dnevnik',
    intro: 'Mirna Windows aplikacija za nalaze, fotografije, biljeske, foldere, karte i sezone na tvom racunalu.',
    download: 'Preuzmi za Windows',
    releaseDetails: 'Detalji verzije',
    installerReady: 'Direktni installer',
    installerFallback: 'Release stranica',
    installerHint: 'Windows installer',
    releaseSource: 'GitHub release',
    releaseUpdated: 'Azurirano',
    appFacts: ['Windows aplikacija', 'Lokalni podaci', 'Bez racuna'],
    support: 'Doniraj',
    supportHero: 'Doniraj za Gljivobook',
    latest: 'Zadnja verzija',
    changelog: 'Kratki changelog',
    language: 'English',
    nav: ['Preuzimanje', 'Promjene', 'Zajednica', 'Ideje', 'Doniraj'],
    theme: 'Tema',
    fundingTop: 'Doniraj iz dobre volje',
    pillars: [
      ['Zbirka', 'Fotografije, biljeske, vrste, datumi i folderi ostaju zajedno.'],
      ['Mapa', 'Filtriraj svoje nalaze po vrsti, regiji, datumu i zonama.'],
      ['Uvidi', 'Vidi sezone, izlaske, lokacije i povijest svake vrste.'],
    ],
    workflowTitle: 'Od nalaza do arhive',
    workflowBody: 'Unesi nalaz jednom, a kasnije ga mozes urediti, pretraziti, mapirati i otvoriti u folderu.',
    workflow: [
      ['Dodaj', 'Uvezi fotografije ili rucno napravi nalaz.'],
      ['Uredi', 'Popravi vrstu, datum, lokaciju, biljeske, badgeve i fotografije.'],
      ['Koristi', 'Otvori foldere, filtriraj mapu, citaj statistiku i izvezi arhivu.'],
    ],
    downloadBody:
      'Zadnji Windows download. Lokalni fallback cuva stranicu ako GitHub vrati stariji release.',
    installTitle: 'Napomena za instalaciju',
    installBody:
      'Preuzmi Windows setup, pokreni ga, a ako se pojavi Windows SmartScreen odaberi More info pa Run anyway.',
    privacyTitle: 'Lokalno po defaultu',
    privacyBody:
      'Nalazi, biljeske, mape i fotografije ostaju na tvom racunalu. Osnovno katalogiziranje radi bez racuna i clouda.',
    responsibilityTitle: 'Podijeljeno u dobroj namjeri',
    responsibilityBody:
      'Gljivobook je prvo napravljen da kolegi olaksa cuvanje osobne gljivarske arhive, a onda smo ga odlucili podijeliti svima koji ga zele koristiti za sebe. Nadam se da ce vam se svidjeti. Svi podaci su lokalni i samo vasi, zato molim cuvajte vlastite backup kopije: ne mogu preuzeti odgovornost za gubitak podataka, ostecene datoteke ili odluke donesene prema vasim zapisima.',
    communityTitle: 'Zajednica bez vlastitog backend-a',
    communityBody: 'Pitanja, komentari, prikazi nalaza i ideje idu kroz GitHub. Bugovi se prijavljuju iz aplikacije.',
    bugBoardTitle: 'Lista bugova',
    bugBoardBody: 'Skriveni pregled otvorenih GitHub bug prijava. Sama prijava buga ostaje samo u aplikaciji.',
    bugBoardLoading: 'Ucitavam bug prijave...',
    bugBoardEmpty: 'Jos nema javnih bug prijava.',
    bugBoardAction: 'Pogledaj sve bugove',
    bugBoardBack: 'Natrag na website',
    bugStatusOpen: 'Otvoreno',
    bugStatusProgress: 'U radu',
    bugStatusFixed: 'Rijeseno - provjeri',
    bugStatusVerify: 'Treba provjeriti',
    bugStatusVerified: 'Potvrdjeno',
    ideasTitle: 'Ideje za koje korisnici mogu glasati',
    ideasBody:
      'Predlozi funkciju, drugi glasaju reakcijama, a jake ideje mogu u funding ciljeve.',
    ideaFlow: [
      ['1', 'Predlozi', 'Korisnik napise ideju za funkciju.'],
      ['2', 'Glasaj', 'Drugi dodaju reakcije i komentare.'],
      ['3', 'Financiraj', 'Jake ideje mogu postati ciljevi podrske.'],
    ],
    ideasAction: 'Dodaj ideju',
    ideasList: 'Pogledaj ideje',
    fundingTitle: 'Dobrovoljna podrska',
    fundingBody:
      'Podrzi aplikaciju iz dobre volje ili poguraj popularne ideje naprijed.',
    donatePending: 'Link za donacije dolazi uskoro.',
    screenshotsTitle: 'Sto app pokriva',
    screenshots: ['Zbirka', 'Vrste', 'Mapa', 'Workflow nalaza'],
    screenshotDetails: [
      'Grupirani nalazi, folderi, badgevi, pretraga i brze akcije.',
      'Biljeske, drugi nazivi, sinonimi, recepti i povijest vrste.',
      'Pinovi, filteri, odabir lokacije, zone i popupovi.',
      'Uvoz, rucni unos, uredjivanje, crop, rotate i export.',
    ],
    fundingGoalsTitle: 'Ideje za aplikaciju koje mogu doci sljedece',
    fundingGoalsBody: 'Funkcije aplikacije, ne website taskovi. Iznosi su okvirni ciljevi.',
    footer: 'Gradeno za gljivarske biljeske, karte, sezone i lokalne arhive.',
    footerRepo: 'Kod i releaseovi',
  },
} satisfies Record<Lang, Record<string, unknown>>;

function getLang(): Lang {
  const params = new URLSearchParams(window.location.search);
  if (params.get('lang') === 'hr') return 'hr';
  if (params.get('lang') === 'en') return 'en';
  return window.location.pathname.toLowerCase().startsWith('/hr') ? 'hr' : 'en';
}

function langPath(target: Lang) {
  return target === 'hr' ? './?lang=hr' : './?lang=en';
}

function formatBytes(bytes: number, lang: Lang) {
  const formatter = new Intl.NumberFormat(lang === 'hr' ? 'hr-HR' : 'en-US', {
    maximumFractionDigits: 1,
  });
  if (bytes >= 1024 * 1024) return `${formatter.format(bytes / 1024 / 1024)} MB`;
  if (bytes >= 1024) return `${formatter.format(bytes / 1024)} KB`;
  return `${formatter.format(bytes)} B`;
}

function pickWindowsInstaller(releaseData: RemoteRelease | null) {
  const assets = releaseData?.assets ?? [];
  return (
    assets.find((asset) => /setup.*\.exe$/i.test(asset.name)) ??
    assets.find((asset) => /\.exe$/i.test(asset.name)) ??
    assets.find((asset) => /\.msi$/i.test(asset.name)) ??
    null
  );
}

function parseVersion(version: string) {
  const match = version.match(/v?(\d+)\.(\d+)\.(\d+)/i);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])] as const;
}

function isOlderVersion(candidate: string, baseline: string) {
  const a = parseVersion(candidate);
  const b = parseVersion(baseline);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return false;
}

function issueLabelNames(issue: RemoteIssue) {
  return (issue.labels ?? [])
    .map((label) => (typeof label === 'string' ? label : label.name ?? ''))
    .map((label) => label.toLowerCase())
    .filter(Boolean);
}

function bugStatus(issue: RemoteIssue, lang: Lang) {
  const labels = issueLabelNames(issue);
  if (labels.includes('verified')) {
    return { key: 'verified', label: lang === 'hr' ? 'Potvrdjeno' : 'Verified' };
  }
  if (labels.includes('needs-verification')) {
    return { key: 'verify', label: lang === 'hr' ? 'Treba provjeriti' : 'Needs verification' };
  }
  if (labels.includes('fixed')) {
    return { key: 'fixed', label: lang === 'hr' ? 'Rijeseno - provjeri' : 'Fixed - verify' };
  }
  if (labels.includes('in-progress') || labels.includes('in progress')) {
    return { key: 'progress', label: lang === 'hr' ? 'U radu' : 'In progress' };
  }
  return { key: 'open', label: lang === 'hr' ? 'Otvoreno' : 'Open' };
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <img src="./gljivobook-icon.png" alt="" />
    </div>
  );
}

function AppScreenshot({ label, detail, index, lang }: { label: string; detail: string; index: number; lang: Lang }) {
  const kind = ['collection', 'species', 'map', 'find'][index] ?? 'collection';
  const preview = lang === 'hr'
    ? {
        search: 'Pretrazi vrste...',
        collectionFirst: '3 nalaza - 18 foto',
        collectionSecond: '2 nalaza - Zagreb',
        speciesCommon: 'lisicarka',
        speciesFirst: 'Prvi nalaz 18.06.2025.',
        edible: 'Jestiva',
        common: 'Cesta',
        season: 'Sezona',
        mapCount: '3 nalaza - travanj',
        open: 'Otvori',
        latinName: 'Latinski naziv',
        date: 'dd mm yyyy',
        country: 'Drzava',
        region: 'Regija',
        note: 'Biljeska o vrsti...',
        save: 'Spremi',
        editPhoto: 'Uredi foto',
        map: 'Karta',
      }
    : {
        search: 'Search species...',
        collectionFirst: '3 finds - 18 photos',
        collectionSecond: '2 finds - Zagreb',
        speciesCommon: 'chanterelle',
        speciesFirst: 'First find 18.06.2025',
        edible: 'Edible',
        common: 'Common',
        season: 'Season',
        mapCount: '3 finds - April',
        open: 'Open',
        latinName: 'Latin name',
        date: 'dd mm yyyy',
        country: 'Country',
        region: 'Region',
        note: 'Species note...',
        save: 'Save',
        editPhoto: 'Edit photo',
        map: 'Map',
      };
  return (
    <div className={`shot shot-${kind}`}>
      <div className="shot-top">
        <span />
        <span />
        <span />
        <strong>{label}</strong>
      </div>
      <div className="shot-surface" aria-hidden="true">
        {kind === 'collection' ? (
          <>
            <div className="shot-search">{preview.search}</div>
            <div className="shot-folder active">
              <span>12.05.</span>
              <strong>Morchella esculenta</strong>
              <em>{preview.collectionFirst}</em>
            </div>
            <div className="shot-folder">
              <span>04.04.</span>
              <strong>Boletus edulis</strong>
              <em>{preview.collectionSecond}</em>
            </div>
            <div className="shot-action-row"><i>{label}</i><i>Folder</i><i>{preview.map}</i></div>
          </>
        ) : null}
        {kind === 'species' ? (
          <>
            <div className="shot-photo">foto</div>
            <div className="shot-species-copy">
              <strong>Cantharellus cibarius</strong>
              <span>{preview.speciesCommon}</span>
              <span className="short">{preview.speciesFirst}</span>
              <div><i>{preview.edible}</i><i>{preview.common}</i><i>{preview.season}</i></div>
            </div>
          </>
        ) : null}
        {kind === 'map' ? (
          <>
            <div className="shot-map-grid" />
            <span className="shot-pin a" />
            <span className="shot-pin b" />
            <span className="shot-pin c" />
            <div className="shot-popup"><strong>Morchella esculenta</strong><span>{preview.mapCount}</span><i>{preview.open}</i></div>
          </>
        ) : null}
        {kind === 'find' ? (
          <>
            <div className="shot-form-line long">{preview.latinName}</div>
            <div className="shot-form-row"><span>{preview.date}</span><span>{preview.country}</span><span>{preview.region}</span></div>
            <div className="shot-form-box">{preview.note}</div>
            <div className="shot-action-row"><i>{preview.save}</i><i>{preview.editPhoto}</i><i>{preview.map}</i></div>
          </>
        ) : null}
      </div>
      <div className="shot-caption">
        <p>{label}</p>
        <span>{detail}</span>
      </div>
    </div>
  );
}

export function App() {
  const lang = getLang();
  const t = copy[lang];
  const [latestRelease, setLatestRelease] = useState<RemoteRelease | null>(null);
  const [remoteIdeas, setRemoteIdeas] = useState<RemoteIssue[]>([]);
  const [remoteBugs, setRemoteBugs] = useState<RemoteIssue[]>([]);
  const [remoteBugsLoading, setRemoteBugsLoading] = useState(false);
  const [totalDownloads, setTotalDownloads] = useState<number | null>(null);
  const [showHiddenBugs, setShowHiddenBugs] = useState(() => window.location.hash === '#bugs');
  const [bugBoardUnlocked, setBugBoardUnlocked] = useState(() => window.sessionStorage.getItem('bb') === '1');
  const [bugPassword, setBugPassword] = useState('');
  const [bugPasswordError, setBugPasswordError] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = window.localStorage.getItem('gljivobook-site-theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return 'dark';
  });
  const themeLabel = useMemo(
    () => (theme === 'dark' ? (lang === 'hr' ? 'Svijetlo' : 'Light') : (lang === 'hr' ? 'Tamno' : 'Dark')),
    [lang, theme],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('gljivobook-site-theme', theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.title as string;
  }, [lang, t.title]);

  useEffect(() => {
    const syncHiddenBugBoard = () => setShowHiddenBugs(window.location.hash === '#bugs');
    syncHiddenBugBoard();
    window.addEventListener('hashchange', syncHiddenBugBoard);
    return () => window.removeEventListener('hashchange', syncHiddenBugBoard);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('https://api.github.com/repos/IvicaSkrobo/Bili-Mushroom/releases?per_page=50', {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((data: Array<{ tag_name: string; assets?: Array<{ name: string; download_count?: number }> }>) => {
        const cutoff = parseVersion(downloadCountFrom);
        const total = data
          .filter((rel) => {
            if (!cutoff) return true;
            const v = parseVersion(rel.tag_name);
            return v !== null && !isOlderVersion(rel.tag_name, downloadCountFrom);
          })
          .reduce((sum, rel) => {
            return sum + (rel.assets ?? [])
              .filter((a) => /setup.*\.exe$/i.test(a.name))
              .reduce((s, a) => s + (a.download_count ?? 0), 0);
          }, 0);
        setTotalDownloads(total);
      })
      .catch(() => {
        // Keep the stat hidden if GitHub is unavailable or rate-limited.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('https://api.github.com/repos/IvicaSkrobo/Bili-Mushroom/releases/latest', {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: RemoteRelease | null) => {
        if (data?.tag_name) setLatestRelease(data);
      })
      .catch(() => {
        // Keep the static fallback when GitHub is unavailable or rate-limited.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch('https://api.github.com/repos/IvicaSkrobo/Bili-Mushroom/issues?state=open&labels=idea&per_page=10', {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((data: RemoteIssue[]) => {
        setRemoteIdeas(data.filter((issue) => !issue.pull_request));
      })
      .catch(() => {
        // Local idea fallback keeps the page useful before GitHub labels are set up.
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!showHiddenBugs) {
      setRemoteBugs([]);
      setRemoteBugsLoading(false);
      return;
    }

    const controller = new AbortController();
    setRemoteBugsLoading(true);
    fetch('https://api.github.com/repos/IvicaSkrobo/Bili-Mushroom/issues?state=open&labels=bug&per_page=8', {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((data: RemoteIssue[]) => {
        setRemoteBugs(data.filter((issue) => !issue.pull_request));
      })
      .catch(() => {
        // Keep the bug board quiet if GitHub is unavailable or rate-limited.
      })
      .finally(() => {
        if (!controller.signal.aborted) setRemoteBugsLoading(false);
      });
    return () => controller.abort();
  }, [showHiddenBugs]);

  const effectiveRelease = latestRelease && !isOlderVersion(latestRelease.tag_name, release.version) ? latestRelease : null;
  const releaseVersion = effectiveRelease?.tag_name ?? release.version;
  const installerAsset = pickWindowsInstaller(effectiveRelease);
  const releaseDetailsUrl = effectiveRelease?.html_url ?? release.installerUrl;
  const releaseUrl = installerAsset?.browser_download_url ?? releaseDetailsUrl;
  const releaseDate = effectiveRelease?.published_at
    ? new Intl.DateTimeFormat(lang === 'hr' ? 'hr-HR' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(effectiveRelease.published_at))
    : release.date;
  const releaseNotes = effectiveRelease?.body
    ? effectiveRelease.body
        .split('\n')
        .map((line) => line.replace(/^[-*#\s]+/, '').trim())
        .filter(Boolean)
        .slice(0, 4)
    : release.notes[lang];
  const donateUrl = configuredDonateUrl?.trim() ?? '';
  const hasDonateUrl = /^https:\/\//i.test(donateUrl);
  const navTargets = ['download', 'changelog', 'community', 'ideas', 'support'] as const;
  const navLabels = t.nav as string[];
  const navItems = navTargets
    .map((target, index) => ({ item: navLabels[index], target }))
    .filter(({ item }) => Boolean(item))
    .filter(({ target }) => target !== 'support' || hasDonateUrl);
  const visibleIdeas: VisibleIdea[] = remoteIdeas.length
    ? remoteIdeas.map((idea) => ({
        title: idea.title,
        titleHr: idea.title,
        votes: idea.reactions?.total_count ?? idea.comments,
        status: 'GitHub',
        statusHr: 'GitHub',
        url: idea.html_url,
      }))
    : ideas.map((idea) => ({
        ...idea,
        url: 'https://github.com/IvicaSkrobo/Bili-Mushroom/issues',
      }));
  const appTabs =
    lang === 'hr'
      ? { collection: 'Zbirka', species: 'Vrste', map: 'Mapa', stats: 'Statistike' }
      : { collection: 'Collection', species: 'Species', map: 'Map', stats: 'Stats' };
  const activeFind = lang === 'hr'
    ? {
        count: '3 nalaza - travanj',
        badge: 'Jestiva',
        edit: 'Uredi',
        folder: 'Folder',
        latest: 'Zadnji zapis danas',
        finds: 'Nalazi',
        species: 'Vrste',
        outings: 'Izlasci',
      }
    : {
        count: '3 finds - April',
        badge: 'Edible',
        edit: 'Edit',
        folder: 'Folder',
        latest: 'Last entry today',
        finds: 'Finds',
        species: 'Species',
        outings: 'Outings',
      };

  const bugBoardContent = (
    <section id="bugs" className="section bug-board-section">
      <div className="bug-board-heading">
        <p className="eyebrow"><AlertCircle size={15} />{t.bugBoardTitle as string}</p>
        <h2>{t.bugBoardTitle as string}</h2>
        <p>{t.bugBoardBody as string}</p>
      </div>
      {totalDownloads !== null && (
        <p className="bug-board-downloads">Total downloads: {totalDownloads}</p>
      )}
      <div className="bug-board">
        {remoteBugsLoading ? (
          <div className="bug-empty">{t.bugBoardLoading as string}</div>
        ) : remoteBugs.length ? remoteBugs.map((bug) => {
          const status = bugStatus(bug, lang);
          return (
            <a className="bug-row" href={bug.html_url} key={bug.html_url}>
              <span className="bug-number">{bug.number ? `#${bug.number}` : 'Bug'}</span>
              <strong>{bug.title}</strong>
              <span className={`bug-status status-${status.key}`}>{status.label}</span>
              <span>{bug.comments} {lang === 'hr' ? 'komentara' : 'comments'}</span>
            </a>
          );
        }) : (
          <div className="bug-empty">{t.bugBoardEmpty as string}</div>
        )}
      </div>
      <a className="text-link bug-board-link" href={bugsListUrl}>
        {t.bugBoardAction as string}
        <ExternalLink size={14} />
      </a>
    </section>
  );

  if (showHiddenBugs) {
    return (
      <div className="site-shell hidden-bugs-shell">
        <main className="hidden-bugs-page">
          <div className="hidden-bugs-topbar">
            <a className="brand" href={lang === 'hr' ? './?lang=hr' : './'} aria-label={`${t.title as string} home`}>
              <BrandMark />
              <span>
                <strong>{t.title as string}</strong>
                <small>{lang === 'hr' ? 'Hrvatski' : 'English'}</small>
              </span>
            </a>
            <a className="button ghost" href={lang === 'hr' ? './?lang=hr' : './'}>
              {t.bugBoardBack as string}
            </a>
          </div>
          {bugBoardUnlocked ? bugBoardContent : (
            <section className="section bug-gate">
              <div className="bug-gate-box">
                <AlertCircle size={28} />
                <h2>Bug Board</h2>
                <p>Enter the password to continue.</p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (bugPassword === 'Tajland') {
                      window.sessionStorage.setItem('bb', '1');
                      setBugBoardUnlocked(true);
                      setBugPasswordError(false);
                    } else {
                      setBugPasswordError(true);
                    }
                  }}
                >
                  <input
                    type="password"
                    className="bug-gate-input"
                    placeholder="Password"
                    value={bugPassword}
                    autoFocus
                    onChange={(e) => { setBugPassword(e.target.value); setBugPasswordError(false); }}
                  />
                  {bugPasswordError && <p className="bug-gate-error">Wrong password.</p>}
                  <button className="button primary" type="submit">Enter</button>
                </form>
              </div>
            </section>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href={lang === 'hr' ? './?lang=hr' : './'} aria-label={`${t.title as string} home`}>
          <BrandMark />
          <span>
            <strong>{t.title as string}</strong>
            <small>{lang === 'hr' ? 'Hrvatski' : 'English'}</small>
          </span>
        </a>
        <nav aria-label="Primary navigation">
          {navItems.map(({ item, target }) => (
            <a key={item} href={`#${target}`}>
              {item}
            </a>
          ))}
        </nav>
        {hasDonateUrl ? (
          <a className="funding-strip" href="#support" aria-label={t.fundingTop as string}>
            <span>
              <Heart size={14} />
              {t.fundingTop as string}
            </span>
          </a>
        ) : null}
        <div className="header-actions">
          <button
            className="theme-switch"
            data-theme-state={theme}
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`${t.theme as string}: ${themeLabel}`}
            title={`${t.theme as string}: ${themeLabel}`}
          >
            <span className="theme-switch-thumb" aria-hidden="true" />
            <span className="theme-switch-option" aria-hidden="true">
              <Sun size={14} />
            </span>
            <span className="theme-switch-option" aria-hidden="true">
              <Moon size={14} />
            </span>
          </button>
          <div className="language-flags" aria-label="Language">
            {(['hr', 'en'] as const).map((target) => (
              <a
                key={target}
                className="flag-switch"
                href={langPath(target)}
                aria-current={target === lang ? 'true' : undefined}
                aria-label={target === 'hr' ? 'Hrvatski' : 'English'}
                title={target === 'hr' ? 'Hrvatski' : 'English'}
              >
                <span className={`flag-icon flag-${target}`} aria-hidden="true" />
                <span className="flag-label">{target.toUpperCase()}</span>
              </a>
            ))}
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow"><Sprout size={15} />{t.eyebrow as string}</p>
            <h1>
              <span className="hero-title-word">{t.title as string}</span>
              <span className="hero-subtitle">{t.subtitle as string}</span>
            </h1>
            <p className="intro">{t.intro as string}</p>
            <div className="app-facts" aria-label={lang === 'hr' ? 'Osnovne informacije' : 'App facts'}>
              {(t.appFacts as string[]).map((fact) => (
                <span key={fact}>{fact}</span>
              ))}
            </div>
            <div className="hero-actions">
              <a className="button primary" href={releaseUrl}>
                <Download size={18} />
                {t.download as string}
              </a>
              {installerAsset ? (
                <a className="button ghost" href={releaseDetailsUrl}>
                  {t.releaseDetails as string}
                  <ExternalLink size={16} />
                </a>
              ) : null}
              {hasDonateUrl ? (
                <a className="button secondary" href="#support">
                  <Heart size={18} />
                  {t.supportHero as string}
                </a>
              ) : null}
            </div>
          </div>
          <div className="hero-visual" aria-label={`${t.title as string} app preview`}>
            <div className="window-shell">
              <div className="window-bar">
                <span />
                <span />
                <span />
                <strong>{t.title as string}</strong>
              </div>
              <div className="window-content">
                <div className="window-list">
                  <div>
                    <span>Cantharellus cibarius</span>
                    <small>{lang === 'hr' ? '2 nalaza' : '2 finds'}</small>
                  </div>
                  <div>
                    <span>Boletus edulis</span>
                    <small>{lang === 'hr' ? '4 nalaza' : '4 finds'}</small>
                  </div>
                  <div className="active">
                    <span>Morchella esculenta</span>
                    <small>{activeFind.latest}</small>
                    <em>{activeFind.badge}</em>
                  </div>
                </div>
                <div className="window-map">
                  <div className="window-tabs">
                    <span>{appTabs.collection}</span>
                    <span>{appTabs.species}</span>
                    <span className="selected">{appTabs.map}</span>
                    <span>{appTabs.stats}</span>
                  </div>
                  <Map size={44} />
                  <span className="pin one" />
                  <span className="pin two" />
                  <span className="pin three" />
                  <div className="map-callout">
                    <strong>Morchella esculenta</strong>
                    <small>{activeFind.count}</small>
                    <em>{activeFind.badge}</em>
                    <div className="callout-actions">
                      <span>{activeFind.edit}</span>
                      <span>{activeFind.folder}</span>
                    </div>
                  </div>
                  <div className="window-stats">
                    <span><strong>128</strong>{activeFind.finds}</span>
                    <span><strong>46</strong>{activeFind.species}</span>
                    <span><strong>19</strong>{activeFind.outings}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pillars" aria-label="Product highlights">
          {(t.pillars as [string, string][]).map(([title, body], index) => {
            const Icon = [BookOpen, Map, TrendingUp][index];
            return (
              <article key={title}>
                <div className="title-with-icon">
                  <Icon size={22} />
                  <h2>{title}</h2>
                </div>
                <p>{body}</p>
              </article>
            );
          })}
        </section>

        <section className="section workflow-section">
          <div className="workflow-heading">
            <p className="eyebrow"><ClipboardList size={15} />{t.workflowTitle as string}</p>
            <h2>{t.workflowTitle as string}</h2>
            <p>{t.workflowBody as string}</p>
          </div>
          <div className="workflow-grid">
            {(t.workflow as [string, string][]).map(([title, body], index) => {
              const Icon = [Download, FolderOpen, Map][index];
              return (
                <article key={title}>
                  <div className="title-with-icon title-with-icon-small">
                    <Icon size={22} />
                    <h3>{title}</h3>
                  </div>
                  <p>{body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="download" className="section split download-section">
          <div className="download-copy">
            <p className="eyebrow"><Download size={15} />{t.latest as string}</p>
            <h2>{releaseVersion}</h2>
            <p>{t.downloadBody as string}</p>
            <p className="download-meta">
              <span>{installerAsset ? (t.installerReady as string) : (t.installerFallback as string)}</span>
              {installerAsset ? (
                <>
                  <strong>{installerAsset.name}</strong>
                  <em>{formatBytes(installerAsset.size, lang)}</em>
                </>
              ) : null}
            </p>
            <a className="button primary" href={releaseUrl}>
              {t.download as string}
              <ExternalLink size={16} />
            </a>
            {installerAsset ? (
              <a className="text-link" href={releaseDetailsUrl}>
                {t.releaseDetails as string}
                <ExternalLink size={14} />
              </a>
            ) : null}
          </div>
          <div id="changelog" className="release-card">
            <div className="release-card-top">
              <span className="mono">{releaseDate}</span>
              <span>{t.releaseSource as string}</span>
            </div>
            <h3>{t.changelog as string}</h3>
            <div className="release-version-row">
              <strong>{releaseVersion}</strong>
              <em>{installerAsset ? (t.installerHint as string) : (t.installerFallback as string)}</em>
            </div>
            <ul>
              {releaseNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        </section>

        <section className="section info-grid" aria-label={lang === 'hr' ? 'Instalacija i privatnost' : 'Install and privacy'}>
          <article>
            <div className="title-with-icon">
              <ShieldCheck size={24} />
              <h2>{t.installTitle as string}</h2>
            </div>
            <p>{t.installBody as string}</p>
          </article>
          <article>
            <div className="title-with-icon">
              <HardDrive size={24} />
              <h2>{t.privacyTitle as string}</h2>
            </div>
            <p>{t.privacyBody as string}</p>
          </article>
          <article className="responsibility-card">
            <div className="title-with-icon">
              <AlertCircle size={24} />
              <h2>{t.responsibilityTitle as string}</h2>
            </div>
            <p>{t.responsibilityBody as string}</p>
          </article>
        </section>

        <section className="section">
          <p className="eyebrow"><Sparkles size={15} />{t.screenshotsTitle as string}</p>
          <div className="screenshots">
            {(t.screenshots as string[]).map((label, index) => (
              <AppScreenshot
                key={label}
                label={label}
                detail={(t.screenshotDetails as string[])[index]}
                index={index}
                lang={lang}
              />
            ))}
          </div>
        </section>

        <section id="community" className="section community-grid">
          <div className="feature-panel">
            <div className="title-with-icon">
              <MessageCircle size={24} />
              <h2>{t.communityTitle as string}</h2>
            </div>
            <p>{t.communityBody as string}</p>
            <div className="link-row">
              <a href="https://github.com/IvicaSkrobo/Bili-Mushroom/discussions">GitHub Discussions</a>
            </div>
          </div>
          <div id="ideas" className="feature-panel">
            <div className="title-with-icon">
              <Vote size={24} />
              <h2>{t.ideasTitle as string}</h2>
            </div>
            <p>{t.ideasBody as string}</p>
            <div className="idea-flow" aria-label={lang === 'hr' ? 'Put ideje do funding cilja' : 'Idea to funding flow'}>
              {(t.ideaFlow as [string, string, string][]).map(([step, title, body]) => (
                <article key={step}>
                  <strong>{step}</strong>
                  <span>{title}</span>
                  <p>{body}</p>
                </article>
              ))}
            </div>
            <div className="idea-list">
              {visibleIdeas.map((idea) => (
                <a className="idea" href={idea.url} key={idea.title}>
                  <span>{lang === 'hr' ? idea.titleHr : idea.title}</span>
                  <strong><Star size={14} /> {idea.votes}</strong>
                  <em>{lang === 'hr' ? idea.statusHr : idea.status}</em>
                </a>
              ))}
            </div>
            <div className="link-row compact-links">
              <a href={ideaSubmitUrl}>
                <Vote size={14} />
                {t.ideasAction as string}
              </a>
              <a href={ideasListUrl}>
                <ExternalLink size={14} />
                {t.ideasList as string}
              </a>
            </div>
          </div>
        </section>

        <GiscusPanel lang={lang} theme={theme} />

        {hasDonateUrl ? (
          <section id="support" className="section split">
            <div>
              <p className="eyebrow"><Heart size={15} />{t.support as string}</p>
              <h2>{t.fundingTitle as string}</h2>
              <p>{t.fundingBody as string}</p>
              <a className="button secondary" href={donateUrl}>
                {t.supportHero as string}
                <ExternalLink size={16} />
              </a>
            </div>
            <div className="funding-card">
              <h3>{t.fundingGoalsTitle as string}</h3>
              <p className="funding-note">{t.fundingGoalsBody as string}</p>
              {funding.map((item) => {
                const pct = Math.round((item.current / item.goal) * 100);
                return (
                  <article key={item.title}>
                    <span className="mono">{pct}%</span>
                    <h3>{lang === 'hr' ? item.titleHr : item.title}</h3>
                    <div className="progress" aria-label={`${pct}% funded`}>
                      <span style={{ width: `${pct}%` }} />
                    </div>
                    <p>{`EUR ${item.current} / EUR ${item.goal}`}</p>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}
      </main>

      <footer>
        <div className="footer-brand">
          <BrandMark />
          <p>{t.footer as string}</p>
        </div>
        <div className="footer-links">
          <a href={repoUrl}>
            <Github size={14} />
            {t.footerRepo as string}
          </a>
          <span>{releaseVersion}</span>
        </div>
      </footer>
    </div>
  );
}
