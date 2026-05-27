import {
  BookOpen,
  ChevronDown,
  ChevronRight,
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
  Trash2,
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
  body?: string | null;
  comments: number;
  updated_at?: string | null;
  state?: string;
  labels?: Array<string | { name?: string }>;
  pull_request?: unknown;
  reactions?: {
    total_count?: number;
  };
};

type RemoteComment = {
  id: number;
  body: string;
  created_at: string;
  user: { login: string } | null;
};

type LocalComment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
  images?: string[];
};

type LocalIssueEdit = {
  title: string;
  description: string;
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
const internalIssuesUrl =
  'https://github.com/IvicaSkrobo/Bili-Mushroom/issues?q=is%3Aissue%20label%3Ainternal';
const internalIssueSubmitUrl =
  'https://github.com/IvicaSkrobo/Bili-Mushroom/issues/new?labels=internal&title=%5BInternal%5D%20';
const repoUrl = 'https://github.com/IvicaSkrobo/Bili-Mushroom';
const bugReportEndpoint = 'https://gljivobook-bug-report.skroboivica.workers.dev/';

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
  const [remoteInternalIssues, setRemoteInternalIssues] = useState<RemoteIssue[]>([]);
  const [remoteBugsLoading, setRemoteBugsLoading] = useState(false);
  const [remoteInternalLoading, setRemoteInternalLoading] = useState(false);
  const [websiteBugForm, setWebsiteBugForm] = useState({
    title: '',
    description: '',
    steps: '',
    contact: '',
    trap: '',
  });
  const [websiteBugSubmitting, setWebsiteBugSubmitting] = useState(false);
  const [websiteBugResult, setWebsiteBugResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [totalDownloads, setTotalDownloads] = useState<number | null>(null);
  const [showHiddenBugs, setShowHiddenBugs] = useState(() => window.location.hash === '#bugs');
  const [bugBoardUnlocked, setBugBoardUnlocked] = useState(() => window.sessionStorage.getItem('bb') === '1');
  const [bugPassword, setBugPassword] = useState('');
  const [bugPasswordError, setBugPasswordError] = useState(false);
  const [expandedBug, setExpandedBug] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
  const [localStatuses, setLocalStatuses] = useState<Record<number, string>>(() => {
    try { return JSON.parse(localStorage.getItem('bb-statuses') ?? '{}'); } catch { return {}; }
  });
  const [bugComments, setBugComments] = useState<Record<number, RemoteComment[]>>({});
  const [loadingComments, setLoadingComments] = useState<Record<number, boolean>>({});
  const [localComments, setLocalComments] = useState<Record<string, LocalComment[]>>(() => {
    try { return JSON.parse(localStorage.getItem('bb-lc') ?? '{}'); } catch { return {}; }
  });
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [commentAuthor, setCommentAuthor] = useState<string>(() => localStorage.getItem('bb-author') ?? 'Ico');
  const [commentImages, setCommentImages] = useState<Record<string, string[]>>({});
  const [issueOverrides, setIssueOverrides] = useState<Record<string, LocalIssueEdit>>(() => {
    try { return JSON.parse(localStorage.getItem('bb-issue-edits') ?? '{}'); } catch { return {}; }
  });
  const [issueEditDrafts, setIssueEditDrafts] = useState<Record<string, LocalIssueEdit>>({});
  const [hiddenGithubComments, setHiddenGithubComments] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('bb-gh-hidden-comments') ?? '[]'); } catch { return []; }
  });
  const [bugBoardTab, setBugBoardTab] = useState<'internal' | 'from-users'>('internal');
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
      setRemoteInternalIssues([]);
      setRemoteBugsLoading(false);
      setRemoteInternalLoading(false);
      return;
    }

    const controller = new AbortController();
    setRemoteBugsLoading(true);
    setRemoteInternalLoading(true);
    const githubHeaders = { Accept: 'application/vnd.github+json' };
    fetch('https://api.github.com/repos/IvicaSkrobo/Bili-Mushroom/issues?state=open&labels=bug&per_page=20', {
      signal: controller.signal,
      headers: githubHeaders,
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
    fetch('https://api.github.com/repos/IvicaSkrobo/Bili-Mushroom/issues?state=open&labels=internal&per_page=50', {
      signal: controller.signal,
      headers: githubHeaders,
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((data: RemoteIssue[]) => {
        setRemoteInternalIssues(data.filter((issue) => !issue.pull_request));
      })
      .catch(() => {
        // Internal work remains GitHub-backed; keep it empty if GitHub is unavailable.
      })
      .finally(() => {
        if (!controller.signal.aborted) setRemoteInternalLoading(false);
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
  const websiteBugCanSubmit =
    websiteBugForm.title.trim().length >= 4 && websiteBugForm.description.trim().length >= 10;

  function updateWebsiteBugField(field: keyof typeof websiteBugForm, value: string) {
    setWebsiteBugForm((prev) => ({ ...prev, [field]: value }));
  }

  async function submitWebsiteBugReport() {
    if (!websiteBugCanSubmit || websiteBugSubmitting) return;
    setWebsiteBugSubmitting(true);
    setWebsiteBugResult(null);
    try {
      const response = await fetch(bugReportEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          ...websiteBugForm,
          title: websiteBugForm.title.trim(),
          description: websiteBugForm.description.trim(),
          steps: websiteBugForm.steps.trim(),
          contact: websiteBugForm.contact.trim(),
          language: lang,
          theme,
          source: 'website',
          appVersion: release.version,
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          reportedAt: new Date().toISOString(),
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setWebsiteBugResult({
        type: 'success',
        message: lang === 'hr' ? 'Prijava je poslana na GitHub issues.' : 'Report was sent to GitHub issues.',
      });
      setWebsiteBugForm({ title: '', description: '', steps: '', contact: '', trap: '' });
    } catch {
      setWebsiteBugResult({
        type: 'error',
        message: lang === 'hr' ? 'Prijava nije poslana. Pokusaj ponovno kasnije.' : 'Report was not sent. Try again later.',
      });
    } finally {
      setWebsiteBugSubmitting(false);
    }
  }

  function saveLocalStatus(issueNum: number, status: string) {
    const updated = { ...localStatuses, [issueNum]: status };
    setLocalStatuses(updated);
    localStorage.setItem('bb-statuses', JSON.stringify(updated));
  }

  function toggleBug(key: string) {
    const opening = expandedBug !== key;
    setExpandedBug(opening ? key : null);
    const num = Number(key);
    if (opening && num && !isNaN(num) && !bugComments[num] && !loadingComments[num]) {
      setLoadingComments((prev) => ({ ...prev, [num]: true }));
      fetch(`https://api.github.com/repos/IvicaSkrobo/Bili-Mushroom/issues/${num}/comments`, {
        headers: { Accept: 'application/vnd.github+json' },
      })
        .then((r) => r.ok ? r.json() : [])
        .then((data: RemoteComment[]) => setBugComments((prev) => ({ ...prev, [num]: data })))
        .catch(() => setBugComments((prev) => ({ ...prev, [num]: [] })))
        .finally(() => setLoadingComments((prev) => ({ ...prev, [num]: false })));
    }
  }

  function addLocalComment(key: string, body: string) {
    const imgs = commentImages[key] ?? [];
    const comment: LocalComment = { id: Date.now().toString(), author: commentAuthor, body, createdAt: new Date().toISOString(), images: imgs.length ? imgs : undefined };
    const updated = { ...localComments, [key]: [...(localComments[key] ?? []), comment] };
    setLocalComments(updated);
    localStorage.setItem('bb-lc', JSON.stringify(updated));
    setCommentDrafts((prev) => ({ ...prev, [key]: '' }));
    setCommentImages((prev) => ({ ...prev, [key]: [] }));
  }

  function deleteLocalComment(key: string, commentId: string) {
    const updated = { ...localComments, [key]: (localComments[key] ?? []).filter((c) => c.id !== commentId) };
    setLocalComments(updated);
    localStorage.setItem('bb-lc', JSON.stringify(updated));
  }

  function hideGithubComment(commentId: number) {
    const id = String(commentId);
    const updated = hiddenGithubComments.includes(id) ? hiddenGithubComments : [...hiddenGithubComments, id];
    setHiddenGithubComments(updated);
    localStorage.setItem('bb-gh-hidden-comments', JSON.stringify(updated));
  }

  function startIssueEdit(key: string, title: string, description: string) {
    setIssueEditDrafts((prev) => ({ ...prev, [key]: { title, description } }));
  }

  function cancelIssueEdit(key: string) {
    setIssueEditDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function saveIssueEdit(key: string) {
    const draft = issueEditDrafts[key];
    if (!draft?.title.trim()) return;

    const updated = {
      ...issueOverrides,
      [key]: { title: draft.title.trim(), description: draft.description },
    };
    setIssueOverrides(updated);
    localStorage.setItem('bb-issue-edits', JSON.stringify(updated));

    cancelIssueEdit(key);
  }

  function renderIssueEditPanel(key: string, title: string, description: string) {
    const draft = issueEditDrafts[key];
    if (!draft) {
      return (
        <div className="bug-edit-summary">
          <div>
            <label className="bug-detail-label">Title</label>
            <h3>{title}</h3>
          </div>
          <button
            type="button"
            className="bug-edit-toggle"
            onClick={(e) => { e.stopPropagation(); startIssueEdit(key, title, description); }}
          >
            Edit
          </button>
          {description.trim() ? (
            <p className="bug-detail-description">{description}</p>
          ) : (
            <p className="bug-detail-description bug-detail-description-empty">No description yet.</p>
          )}
        </div>
      );
    }

    return (
      <div className="bug-edit-panel" onClick={(e) => e.stopPropagation()}>
        <label className="bug-detail-label" htmlFor={`bug-title-${key}`}>Title</label>
        <input
          id={`bug-title-${key}`}
          className="bug-detail-textarea bug-edit-title"
          value={draft.title}
          onChange={(e) => setIssueEditDrafts((prev) => ({ ...prev, [key]: { ...draft, title: e.target.value } }))}
        />
        <label className="bug-detail-label" htmlFor={`bug-desc-${key}`}>Description</label>
        <textarea
          id={`bug-desc-${key}`}
          className="bug-detail-textarea"
          value={draft.description}
          onChange={(e) => setIssueEditDrafts((prev) => ({ ...prev, [key]: { ...draft, description: e.target.value } }))}
        />
        <div className="bug-edit-actions">
          <button
            type="button"
            className="button primary"
            disabled={!draft.title.trim()}
            onClick={() => saveIssueEdit(key)}
          >
            Save
          </button>
          <button type="button" className="button ghost" onClick={() => cancelIssueEdit(key)}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const LOCAL_STATUSES = [
    { key: 'open', label: 'Open' },
    { key: 'confirmed', label: 'Confirmed' },
    { key: 'in-progress', label: 'In Progress' },
    { key: 'needs-user-verify', label: 'Needs user verify' },
    { key: 'fixed', label: 'Fixed' },
    { key: 'canceled', label: 'Canceled' },
    { key: 'not-priority', label: 'Not priority' },
    { key: 'verified', label: 'Verified' },
  ];

  function renderLocalCommentsSection(issueKey: string) {
    const comments = localComments[issueKey] ?? [];
    const body = commentDrafts[issueKey] ?? '';
    const showComments = expandedComments[issueKey] ?? false;
    return (
      <div className="bug-detail-panel">
        {comments.length > 0 && (
          <button
            className="bug-comments-toggle"
            type="button"
            onClick={() => setExpandedComments((prev) => ({ ...prev, [issueKey]: !showComments }))}
          >
            {showComments ? `▲ Hide comments` : `▼ Show ${comments.length} comment${comments.length !== 1 ? 's' : ''}`}
          </button>
        )}
        {showComments && comments.map((c) => (
          <div key={c.id} className="bug-lc-item">
            <div className="bug-lc-item-meta">
              <strong>{c.author}</strong>
              <span>{new Intl.DateTimeFormat('en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(c.createdAt))}</span>
              <button
                className="bug-lc-delete"
                type="button"
                title="Delete comment"
                aria-label="Delete comment"
                onClick={() => deleteLocalComment(issueKey, c.id)}
              >
                <Trash2 size={12} />
              </button>
            </div>
            <p className="bug-comment-body">{c.body}</p>
            {c.images?.length ? (
              <div className="bb-img-previews">
                {c.images.map((src, i) => <img key={i} className="bb-comment-img" src={src} alt="" />)}
              </div>
            ) : null}
          </div>
        ))}
        <div className="bug-lc-inline-form">
          <div className="bb-author-switcher">
            {['Ico', 'Bili'].map((name) => (
              <button
                key={name}
                type="button"
                className={`bb-author-btn${commentAuthor === name ? ' bb-author-btn-active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setCommentAuthor(name); localStorage.setItem('bb-author', name); }}
              >{name}</button>
            ))}
          </div>
          <input
            className="bug-lc-body-inline"
            type="text"
            placeholder="Add a comment..."
            value={body}
            onKeyDown={(e) => { if (e.key === 'Enter' && body.trim()) { addLocalComment(issueKey, body); setExpandedComments((prev) => ({ ...prev, [issueKey]: true })); } }}
            onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [issueKey]: e.target.value }))}
            onPaste={(e) => {
              const items = Array.from(e.clipboardData?.items ?? []);
              const imgItem = items.find((item) => item.type.startsWith('image/'));
              if (!imgItem) return;
              e.preventDefault();
              const file = imgItem.getAsFile();
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const src = ev.target?.result as string;
                const img = new Image();
                img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const maxW = 800;
                  const scale = img.width > maxW ? maxW / img.width : 1;
                  canvas.width = img.width * scale;
                  canvas.height = img.height * scale;
                  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
                  const compressed = canvas.toDataURL('image/jpeg', 0.7);
                  setCommentImages((prev) => ({ ...prev, [issueKey]: [...(prev[issueKey] ?? []), compressed] }));
                };
                img.src = src;
              };
              reader.readAsDataURL(file);
            }}
          />
          <button
            className="bug-lc-add"
            type="button"
            disabled={!body.trim()}
            onClick={() => { if (body.trim()) { addLocalComment(issueKey, body); setExpandedComments((prev) => ({ ...prev, [issueKey]: true })); } }}
          >↵</button>
        </div>
        {(commentImages[issueKey] ?? []).length > 0 && (
          <div className="bb-img-previews">
            {(commentImages[issueKey] ?? []).map((src, i) => (
              <div key={i} className="bb-img-thumb">
                <img src={src} alt="" />
                <button type="button" className="bb-img-remove" onClick={() => setCommentImages((prev) => ({ ...prev, [issueKey]: prev[issueKey].filter((_, j) => j !== i) }))}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const bugBoardContent = (
    <section id="bugs" className="section bug-board-section">
      <div className="bug-board-heading">
        <p className="eyebrow"><AlertCircle size={15} />{t.bugBoardTitle as string}</p>
        <h2>{t.bugBoardTitle as string}</h2>
      </div>

      <div className="bb-tab-bar">
        <div className="bb-tab-pill-track">
          <button
            type="button"
            className={`bb-tab-btn${bugBoardTab === 'internal' ? ' bb-tab-btn-active' : ''}`}
            onClick={() => setBugBoardTab('internal')}
          >
            <span className="bb-tab-btn-title">Internal</span>
            {remoteInternalIssues.length > 0 && <span className="bb-tab-count">{remoteInternalIssues.length}</span>}
          </button>
          <button
            type="button"
            className={`bb-tab-btn${bugBoardTab === 'from-users' ? ' bb-tab-btn-active' : ''}`}
            onClick={() => setBugBoardTab('from-users')}
          >
            <span className="bb-tab-btn-title">From users</span>
            {remoteBugs.length > 0 && <span className="bb-tab-count">{remoteBugs.length}</span>}
            {totalDownloads !== null && <span className="bb-tab-downloads">↓ {totalDownloads}</span>}
          </button>
        </div>
      </div>
      <div className="bb-tab-context">
        {bugBoardTab === 'internal' ? (
          <><span className="bb-tab-ctx-icon"><Github size={13} /></span><span>Internal issues - synced through GitHub label <strong>internal</strong>, so you and your friend see the same list</span></>
        ) : (
          <><span className="bb-tab-ctx-icon"><Github size={13} /></span><span>Bug reports submitted from the app — pulled live from GitHub Issues</span></>
        )}
      </div>

      <div className="website-bug-report-panel">
        <div className="website-bug-report-head">
          <div>
            <p className="bug-detail-label">{lang === 'hr' ? 'Prijava bez GitHub racuna' : 'No-account report'}</p>
            <h3>{lang === 'hr' ? 'Posalji bug s weba' : 'Send a bug from the website'}</h3>
          </div>
          <span>{lang === 'hr' ? 'Ide preko istog worker endpointa kao aplikacija.' : 'Uses the same worker endpoint as the app.'}</span>
        </div>
        <div className="website-bug-form">
          <input
            className="bug-detail-textarea website-bug-title"
            type="text"
            placeholder={lang === 'hr' ? 'Naslov problema' : 'Problem title'}
            value={websiteBugForm.title}
            maxLength={120}
            onChange={(e) => updateWebsiteBugField('title', e.target.value)}
          />
          <textarea
            className="bug-detail-textarea"
            placeholder={lang === 'hr' ? 'Sto se dogodilo?' : 'What happened?'}
            value={websiteBugForm.description}
            maxLength={3000}
            onChange={(e) => updateWebsiteBugField('description', e.target.value)}
          />
          <textarea
            className="bug-detail-textarea"
            placeholder={lang === 'hr' ? 'Koraci za ponoviti (opcionalno)' : 'Steps to reproduce (optional)'}
            value={websiteBugForm.steps}
            maxLength={2000}
            onChange={(e) => updateWebsiteBugField('steps', e.target.value)}
          />
          <input
            className="bug-detail-textarea website-bug-title"
            type="text"
            placeholder={lang === 'hr' ? 'Kontakt (opcionalno)' : 'Contact (optional)'}
            value={websiteBugForm.contact}
            maxLength={160}
            onChange={(e) => updateWebsiteBugField('contact', e.target.value)}
          />
          <input
            className="hidden"
            tabIndex={-1}
            autoComplete="off"
            value={websiteBugForm.trap}
            onChange={(e) => updateWebsiteBugField('trap', e.target.value)}
            aria-hidden="true"
          />
          <div className="website-bug-actions">
            <button
              type="button"
              className="button primary"
              disabled={!websiteBugCanSubmit || websiteBugSubmitting}
              onClick={submitWebsiteBugReport}
            >
              {websiteBugSubmitting
                ? (lang === 'hr' ? 'Saljem...' : 'Sending...')
                : (lang === 'hr' ? 'Posalji prijavu' : 'Send report')}
            </button>
            {websiteBugResult && (
              <span className={`website-bug-result website-bug-result-${websiteBugResult.type}`}>
                {websiteBugResult.message}
              </span>
            )}
          </div>
        </div>
      </div>

      {bugBoardTab === 'internal' && (
        <div className="bug-internal">
          <div className="bug-section-header">
            <a className="button ghost" href={internalIssueSubmitUrl} target="_blank" rel="noopener noreferrer">
              + New synced issue <ExternalLink size={13} />
            </a>
          </div>
          <div className="bb-table-wrap">
            <div className="bb-table-header">
              <span>#</span>
              <span>Title</span>
              <span>Description</span>
              <span>Status</span>
              <span />
            </div>
            <div className="bug-board">
              {remoteInternalLoading ? (
                <div className="bug-empty">Loading synced internal issues...</div>
              ) : remoteInternalIssues.length === 0 ? (
                <div className="bug-empty">No synced internal issues yet. Use + New synced issue to create one on GitHub.</div>
              ) : remoteInternalIssues.map((issue) => {
                const issueKey = String(issue.number ?? issue.html_url);
                const isExpanded = expandedBug === issueKey;
                const ghStatus = bugStatus(issue, lang);
                const descPreview = (issue.body ?? '').replace(/[#*_`[\]>]/g, '').trim().slice(0, 120);
                return (
                  <div key={issue.html_url} className={`bug-row-wrap${isExpanded ? ' bug-row-wrap-expanded' : ''}`}>
                    <div
                      className={`bug-row${isExpanded ? ' bug-row-expanded' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleBug(issueKey)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBug(issueKey); } }}
                    >
                      <span className="bug-number">{issue.number ? `#${issue.number}` : '?'}</span>
                      <strong>{issue.title}</strong>
                      <span className="bb-row-desc-preview">{descPreview || '—'}</span>
                      <div className="bug-status-cell" data-status={ghStatus.key}>
                        <span className="bug-status bug-status-local">{ghStatus.label}</span>
                      </div>
                      <span className="bug-chevron" aria-hidden="true">
                        {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="bug-detail">
                        <div className="bug-edit-summary">
                          <div>
                            <label className="bug-detail-label">Synced GitHub issue</label>
                            <h3>{issue.title}</h3>
                          </div>
                          <a className="bug-edit-toggle" href={issue.html_url} target="_blank" rel="noopener noreferrer">
                            Edit on GitHub <ExternalLink size={12} />
                          </a>
                          {issue.body?.trim() ? (
                            <p className="bug-detail-description">{issue.body}</p>
                          ) : (
                            <p className="bug-detail-description bug-detail-description-empty">No description yet.</p>
                          )}
                        </div>
                        <a className="text-link bug-gh-link" href={issue.html_url} target="_blank" rel="noopener noreferrer">
                          Open synced issue <ExternalLink size={12} />
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <a className="text-link bug-board-link" href={internalIssuesUrl} target="_blank" rel="noopener noreferrer">
            View synced internal issues
            <ExternalLink size={14} />
          </a>
        </div>
      )}

      {bugBoardTab === 'from-users' && (
        <div className="bb-table-wrap">
          <div className="bb-table-header">
            <span>#</span>
            <span>Title</span>
            <span>Description</span>
            <span>Status</span>
            <span />
          </div>
          <div className="bug-board">
            {remoteBugsLoading ? (
              <div className="bug-empty">{t.bugBoardLoading as string}</div>
            ) : remoteBugs.length ? remoteBugs.map((bug) => {
              const ghStatus = bugStatus(bug, lang);
              const localStatus = localStatuses[bug.number ?? 0];
              const bugKey = String(bug.number ?? 0);
              const isExpanded = expandedBug === bugKey;
              const num = bug.number ?? 0;
              const bugOverride = issueOverrides[bugKey];
              const displayTitle = bugOverride?.title ?? bug.title;
              const displayDescription = bugOverride?.description ?? (bug.body ?? '');
              const descPreview = displayDescription.replace(/[#*_`[\]>]/g, '').trim().slice(0, 120);
              return (
                <div key={bug.html_url} className={`bug-row-wrap${isExpanded ? ' bug-row-wrap-expanded' : ''}`}>
                  <div
                    className={`bug-row${isExpanded ? ' bug-row-expanded' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => toggleBug(bugKey)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleBug(bugKey); } }}
                  >
                    <span className="bug-number">{num ? `#${num}` : '?'}</span>
                    <strong>{displayTitle}</strong>
                    <span className="bb-row-desc-preview">{descPreview || '—'}</span>
                    <div className="bug-status-cell" data-status={localStatus ?? ghStatus.key}>
                      <select
                        className="bug-row-status-select"
                        value={localStatus ?? ghStatus.key}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => { e.stopPropagation(); saveLocalStatus(num, e.target.value); }}
                      >
                        {LOCAL_STATUSES.map((s) => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                    <span className="bug-chevron" aria-hidden="true">
                      {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </span>
                  </div>
                  {isExpanded && (
                    <div className="bug-detail">
                      {renderIssueEditPanel(bugKey, displayTitle, displayDescription)}
                      {renderLocalCommentsSection(bugKey)}
                      {(bugComments[num] ?? []).filter((comment) => !hiddenGithubComments.includes(String(comment.id))).length > 0 && (
                        <div className="bug-detail-section bug-gh-comments">
                          <label className="bug-detail-label">GitHub comments</label>
                          {(bugComments[num] ?? [])
                            .filter((comment) => !hiddenGithubComments.includes(String(comment.id)))
                            .map((comment) => (
                            <div key={comment.id} className="bug-comment">
                              <div className="bug-comment-meta">
                                <strong>
                                  {comment.user?.login ?? 'unknown'}
                                  <a href={bug.html_url} target="_blank" rel="noopener noreferrer" className="bug-comment-gh-link" title="Open on GitHub">
                                    <ExternalLink size={11} />
                                  </a>
                                </strong>
                                <span>{new Intl.DateTimeFormat(lang === 'hr' ? 'hr-HR' : 'en-US', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(comment.created_at))}</span>
                                <button
                                  className="bug-lc-delete"
                                  type="button"
                                  title="Hide comment"
                                  aria-label="Hide comment"
                                  onClick={(e) => { e.stopPropagation(); hideGithubComment(comment.id); }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                              <p className="bug-comment-body">{comment.body}</p>
                            </div>
                          ))}
                        </div>
                      )}
                      <a className="text-link bug-gh-link" href={bug.html_url} target="_blank" rel="noopener noreferrer">
                        GitHub <ExternalLink size={12} />
                      </a>
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="bug-empty">{t.bugBoardEmpty as string}</div>
            )}
          </div>
          <a className="text-link bug-board-link" href={bugsListUrl}>
            {t.bugBoardAction as string}
            <ExternalLink size={14} />
          </a>
        </div>
      )}
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
            <div className="hidden-bugs-topbar-actions">
              <button
                className="theme-switch"
                data-theme-state={theme}
                type="button"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label={`${t.theme as string}: ${themeLabel}`}
                title={`${t.theme as string}: ${themeLabel}`}
              >
                <span className="theme-switch-thumb" aria-hidden="true" />
                <span className="theme-switch-option" aria-hidden="true"><Sun size={14} /></span>
                <span className="theme-switch-option" aria-hidden="true"><Moon size={14} /></span>
              </button>
              <a className="button ghost" href={lang === 'hr' ? './?lang=hr' : './'}>
                {t.bugBoardBack as string}
              </a>
            </div>
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
