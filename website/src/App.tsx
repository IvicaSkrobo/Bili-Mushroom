import {
  BookOpen,
  Bug,
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
  Sun,
  Timer,
  TrendingUp,
  Vote,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { GiscusPanel } from './GiscusPanel';
import { funding, ideas, release, roadmap } from './siteData';

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
  }>;
};

type RemoteIssue = {
  html_url: string;
  title: string;
  comments: number;
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

const configuredBugReportUrl = import.meta.env.VITE_BUG_REPORT_URL as string | undefined;
const configuredDonateUrl = import.meta.env.VITE_DONATE_URL as string | undefined;
const ideaSubmitUrl =
  'https://github.com/IvicaSkrobo/Bili-Mushroom/issues/new?template=feature_idea.yml&labels=idea';
const ideasListUrl = 'https://github.com/IvicaSkrobo/Bili-Mushroom/issues?q=is%3Aissue%20label%3Aidea';

const copy = {
  en: {
    eyebrow: 'Local-first field journal for Windows',
    title: 'Mushroom Book',
    subtitle: 'Your foraging journal',
    intro:
      'A quiet desktop app for foragers who want every find stored, mapped, searchable, and remembered on their own machine.',
    download: 'Download for Windows',
    releaseDetails: 'Release details',
    installerReady: 'Direct installer',
    installerFallback: 'Release page',
    support: 'Donate',
    supportHero: 'Donate if you like the app',
    latest: 'Latest release',
    changelog: 'Small changelog',
    language: 'Hrvatski',
    nav: ['Download', 'Changelog', 'Community', 'Ideas', 'Donate'],
    theme: 'Theme',
    fundingTop: 'Donate if you like it',
    pillars: [
      ['Collect', 'Import photos, notes, locations, dates, and species details into one local library.'],
      ['Map', 'See field history by place, species, and season without losing context.'],
      ['Understand', 'Stats, seasons, field outings, and PDF export turn your archive into a useful journal.'],
    ],
    workflowTitle: 'How finds are handled',
    workflowBody:
      'The website should stay honest to the real app: every find belongs to a collection species, can be opened on the map, edited later, and traced back to its local folder.',
    workflow: [
      ['Import or add a find', 'Photos, date, location, Croatian/common name, notes, status badges, and fruiting body count stay editable.'],
      ['Browse by collection and species', 'The collection groups finds by species, while the species view keeps notes, other names, synonyms, recipes, and per-species history.'],
      ['Map and export the archive', 'Pins, location filtering, stats, field outings, and PDF export turn stored finds into usable history.'],
    ],
    downloadBody:
      'The website reads the latest GitHub Release and falls back to bundled release notes if GitHub is unavailable.',
    installTitle: 'Install notes',
    installBody:
      'Download the Windows setup file, run it, and if Windows SmartScreen appears choose More info, then Run anyway.',
    privacyTitle: 'Local by default',
    privacyBody:
      'Finds, notes, folders, and photos stay on your computer. Core cataloging works without an account or cloud service.',
    communityTitle: 'Community without a custom backend',
    communityBody:
      'GitHub Discussions and Giscus will power release comments, questions, showcase posts, and feature ideas. Private bug reports can use a separate form.',
    bugTitle: 'Report bugs',
    bugBody:
      'Bug reports should be private by default, because screenshots, paths, logs, and locations can contain personal data.',
    bugAction: 'Open private bug form',
    bugPending: 'Private bug form is coming soon.',
    ideasTitle: 'Ideas users can vote on',
    ideasBody:
      'Feature requests will live in GitHub Discussions. Users vote with reactions, and popular ideas can move into funding goals.',
    ideasAction: 'Add an idea',
    ideasList: 'View ideas',
    fundingTitle: 'Voluntary support',
    fundingBody:
      'If the app helps you, you can support it from goodwill. Larger ideas can still become visible goals later.',
    donatePending: 'Donate link is coming soon.',
    screenshotsTitle: 'Real app surfaces to verify',
    screenshots: ['Collection', 'Species', 'Map', 'Find workflow'],
    screenshotDetails: [
      'Grouped finds, folders, badges, search, and open-in-species/map actions.',
      'Species notes, other names, synonyms, status badges, recipes, and find history.',
      'Pins, species filtering, location picker, region/local zones, and popups.',
      'Import, manual add, edit details, crop/rotate photos, open folder, and export.',
    ],
    roadmapTitle: 'Build roadmap',
    roadmapBody:
      'The site is built in practical layers so releases, comments, voting, donations, and updates can become real without adding a custom backend too early.',
    footer: 'Built for mushroom notes, maps, seasons, and patient local archives.',
  },
  hr: {
    eyebrow: 'Lokalni gljivarski dnevnik za Windows',
    title: 'Gljivobook',
    subtitle: 'Tvoj gljivarski dnevnik',
    intro:
      'Mirna desktop aplikacija za gljivare koji zele svaki nalaz spremiti, mapirati, pretraziti i sacuvati na svom racunalu.',
    download: 'Preuzmi za Windows',
    releaseDetails: 'Detalji verzije',
    installerReady: 'Direktni installer',
    installerFallback: 'Release stranica',
    support: 'Doniraj',
    supportHero: 'Doniraj za Gljivobook',
    latest: 'Zadnja verzija',
    changelog: 'Kratki changelog',
    language: 'English',
    nav: ['Preuzimanje', 'Promjene', 'Zajednica', 'Ideje', 'Doniraj'],
    theme: 'Tema',
    fundingTop: 'Doniraj iz dobre volje',
    pillars: [
      ['Zbirka', 'Uvezi fotografije, biljeske, lokacije, datume i podatke o vrsti u lokalnu knjiznicu.'],
      ['Mapa', 'Vidi povijest terena po mjestu, vrsti i sezoni bez gubljenja konteksta.'],
      ['Uvidi', 'Statistike, sezone, izlasci na teren i PDF export pretvaraju arhivu u koristan dnevnik.'],
    ],
    workflowTitle: 'Kako se vode nalazi',
    workflowBody:
      'Website treba ostati vjeran stvarnoj aplikaciji: svaki nalaz pripada vrsti u zbirci, moze se otvoriti na mapi, kasnije urediti i povezati s lokalnim folderom.',
    workflow: [
      ['Uvezi ili dodaj nalaz', 'Fotografije, datum, lokacija, hrvatski naziv, biljeske, status badgevi i broj plodnih tijela ostaju uredjivi.'],
      ['Pregledaj kroz zbirku i vrste', 'Zbirka grupira nalaze po vrsti, a Vrste cuvaju biljeske, druge nazive, sinonime, recepte i povijest pojedine vrste.'],
      ['Mapiraj i izvezi arhivu', 'Pinovi, filteri lokacije, statistike, izlasci na teren i PDF export pretvaraju spremljene nalaze u korisnu povijest.'],
    ],
    downloadBody:
      'Website cita zadnji GitHub Release i koristi lokalni fallback ako GitHub trenutno nije dostupan.',
    installTitle: 'Napomena za instalaciju',
    installBody:
      'Preuzmi Windows setup, pokreni ga, a ako se pojavi Windows SmartScreen odaberi More info pa Run anyway.',
    privacyTitle: 'Lokalno po defaultu',
    privacyBody:
      'Nalazi, biljeske, mape i fotografije ostaju na tvom racunalu. Osnovno katalogiziranje radi bez racuna i clouda.',
    communityTitle: 'Zajednica bez vlastitog backend-a',
    communityBody:
      'GitHub Discussions i Giscus ce nositi komentare na release, pitanja, prikaze nalaza i ideje. Privatni bugovi mogu ici kroz zaseban obrazac.',
    bugTitle: 'Prijavi bug',
    bugBody:
      'Bugovi trebaju biti privatni po defaultu jer screenshotovi, putanje, logovi i lokacije mogu sadrzavati osobne podatke.',
    bugAction: 'Otvori privatni obrazac',
    bugPending: 'Privatni obrazac za bugove dolazi uskoro.',
    ideasTitle: 'Ideje za koje korisnici mogu glasati',
    ideasBody:
      'Prijedlozi funkcija zivjet ce u GitHub Discussions. Korisnici glasaju reakcijama, a popularne ideje mogu ici u funding ciljeve.',
    ideasAction: 'Dodaj ideju',
    ideasList: 'Pogledaj ideje',
    fundingTitle: 'Dobrovoljna podrska',
    fundingBody:
      'Ako ti aplikacija pomaze, mozes je podrzati iz dobre volje. Vece ideje kasnije mogu dobiti zaseban cilj.',
    donatePending: 'Link za donacije dolazi uskoro.',
    screenshotsTitle: 'Stvarni dijelovi appa za provjeru',
    screenshots: ['Zbirka', 'Vrste', 'Mapa', 'Workflow nalaza'],
    screenshotDetails: [
      'Grupirani nalazi, folderi, badgevi, pretraga i akcije za vrste/mapu.',
      'Biljeske vrste, drugi nazivi, sinonimi, status badgevi, recepti i povijest nalaza.',
      'Pinovi, filter po vrsti, odabir lokacije, regije/lokalne zone i popupovi.',
      'Uvoz, rucni unos, uredjivanje detalja, crop/rotate fotografija, folder i export.',
    ],
    roadmapTitle: 'Roadmap izrade',
    roadmapBody:
      'Website gradimo u prakticnim slojevima da releaseovi, komentari, glasanje, donacije i updater postanu stvarni bez prerano dodanog vlastitog backend-a.',
    footer: 'Gradeno za gljivarske biljeske, karte, sezone i strpljive lokalne arhive.',
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

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 140 140" role="img">
        <path className="book left" d="M15 58c16-8 34-8 53 2v50c-18-10-36-12-53-4V58Z" />
        <path className="book right" d="M73 60c19-10 37-10 53-2v48c-17-8-35-6-53 4V60Z" />
        <path className="spine" d="M68 60c2 8 2 42 0 50" />
        <path className="spine right" d="M73 60c-2 8-2 42 0 50" />
        <path className="stem main" d="M70 94c-3-22 0-41 9-58" />
        <path className="stem side left" d="M61 96c-7-12-9-23-6-33" />
        <path className="stem side right" d="M84 96c8-12 10-23 6-33" />
        <path className="cap main" d="M40 34c13-31 55-35 76-9 6 8 9 17 9 25 0 10-8 17-18 17H48c-13 0-19-13-8-33Z" />
        <path className="cap left" d="M31 80c6-17 25-18 34-4 4 6 0 14-7 15l-18 3c-7 1-12-7-9-14Z" />
        <path className="cap right" d="M86 79c7-18 27-19 35-3 3 6-1 13-8 13H94c-6 0-10-5-8-10Z" />
        <path className="moss left" d="M36 99c14 5 33 4 47-1" />
        <path className="moss right" d="M75 100c15 4 34 3 48-2" />
        <circle className="spot" cx="58" cy="38" r="3.4" />
        <circle className="spot" cx="74" cy="31" r="2.4" />
        <circle className="spot" cx="94" cy="41" r="3" />
      </svg>
    </div>
  );
}

function AppScreenshot({ label, detail, index }: { label: string; detail: string; index: number }) {
  const kind = ['collection', 'species', 'map', 'find'][index] ?? 'collection';
  return (
    <div className={`shot shot-${kind}`}>
      <div className="shot-top">
        <span />
        <span />
        <span />
      </div>
      <div className="shot-surface" aria-hidden="true">
        {kind === 'collection' ? (
          <>
            <div className="shot-search" />
            <div className="shot-folder active"><span /><strong /></div>
            <div className="shot-folder"><span /><strong /></div>
            <div className="shot-action-row"><i /><i /><i /></div>
          </>
        ) : null}
        {kind === 'species' ? (
          <>
            <div className="shot-photo" />
            <div className="shot-species-copy">
              <strong />
              <span />
              <span className="short" />
              <div><i /><i /><i /></div>
            </div>
          </>
        ) : null}
        {kind === 'map' ? (
          <>
            <div className="shot-map-grid" />
            <span className="shot-pin a" />
            <span className="shot-pin b" />
            <span className="shot-pin c" />
            <div className="shot-popup"><strong /><span /><i /></div>
          </>
        ) : null}
        {kind === 'find' ? (
          <>
            <div className="shot-form-line long" />
            <div className="shot-form-row"><span /><span /><span /></div>
            <div className="shot-form-box" />
            <div className="shot-action-row"><i /><i /><i /></div>
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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const stored = window.localStorage.getItem('gljivobook-site-theme');
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
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

  const releaseVersion = latestRelease?.tag_name ?? release.version;
  const installerAsset = pickWindowsInstaller(latestRelease);
  const releaseDetailsUrl = latestRelease?.html_url ?? release.installerUrl;
  const releaseUrl = installerAsset?.browser_download_url ?? releaseDetailsUrl;
  const releaseDate = latestRelease?.published_at
    ? new Intl.DateTimeFormat(lang === 'hr' ? 'hr-HR' : 'en-US', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(latestRelease.published_at))
    : release.date;
  const releaseNotes = latestRelease?.body
    ? latestRelease.body
        .split('\n')
        .map((line) => line.replace(/^[-*#\s]+/, '').trim())
        .filter(Boolean)
        .slice(0, 4)
    : release.notes[lang];
  const bugReportUrl = configuredBugReportUrl?.trim();
  const donateUrl = configuredDonateUrl?.trim();
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
    ? { count: '3 nalaza - travanj', badge: 'Jestiva', edit: 'Uredi nalaz', folder: 'Otvori folder' }
    : { count: '3 finds - April', badge: 'Edible', edit: 'Edit find', folder: 'Open folder' };

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
          {(t.nav as string[]).map((item, index) => (
            <a key={item} href={`#${['download', 'changelog', 'community', 'ideas', 'support'][index]}`}>
              {item}
            </a>
          ))}
        </nav>
        <a className="funding-strip" href="#support" aria-label={t.fundingTop as string}>
          <span>
            <Heart size={14} />
            {t.fundingTop as string}
          </span>
        </a>
        <div className="header-actions">
          <button
            className="theme-switch"
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`${t.theme as string}: ${themeLabel}`}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            {themeLabel}
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
              <a className="button secondary" href="#support">
                <Heart size={18} />
                {t.supportHero as string}
              </a>
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
                    <small>{lang === 'hr' ? 'Zadnji zapis danas' : 'Last entry today'}</small>
                  </div>
                </div>
                <div className="window-map">
                  <div className="window-tabs">
                    <span className="selected">{appTabs.collection}</span>
                    <span>{appTabs.species}</span>
                    <span>{appTabs.map}</span>
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
                <Icon size={22} />
                <h2>{title}</h2>
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
                  <Icon size={22} />
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section id="download" className="section split">
          <div>
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
            <p className="mono">{releaseDate}</p>
            <h3>{t.changelog as string}</h3>
            <ul>
              {releaseNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        </section>

        <section className="section info-grid" aria-label={lang === 'hr' ? 'Instalacija i privatnost' : 'Install and privacy'}>
          <article>
            <ShieldCheck size={24} />
            <h2>{t.installTitle as string}</h2>
            <p>{t.installBody as string}</p>
          </article>
          <article>
            <HardDrive size={24} />
            <h2>{t.privacyTitle as string}</h2>
            <p>{t.privacyBody as string}</p>
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
              />
            ))}
          </div>
        </section>

        <section className="section roadmap-section">
          <p className="eyebrow"><Timer size={15} />{t.roadmapTitle as string}</p>
          <h2>{t.roadmapTitle as string}</h2>
          <p className="section-lead">{t.roadmapBody as string}</p>
          <div className="roadmap-list">
            {roadmap.map((item) => (
              <article className="roadmap-card" key={item.phase}>
                <div>
                  <span className="mono">{lang === 'hr' ? item.phaseHr : item.phase}</span>
                  <strong>{lang === 'hr' ? item.statusHr : item.status}</strong>
                </div>
                <h3>{lang === 'hr' ? item.titleHr : item.title}</h3>
                <p>{lang === 'hr' ? item.bodyHr : item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="community" className="section community-grid">
          <div className="feature-panel">
            <MessageCircle size={24} />
            <h2>{t.communityTitle as string}</h2>
            <p>{t.communityBody as string}</p>
            <div className="link-row">
              <a href="https://github.com/IvicaSkrobo/Bili-Mushroom/discussions">GitHub Discussions</a>
              <a href="#bug-report"><Bug size={14} /> Bugs</a>
            </div>
          </div>
          <div className="feature-panel" id="bug-report">
            <Bug size={24} />
            <h2>{t.bugTitle as string}</h2>
            <p>{t.bugBody as string}</p>
            <div className="link-row">
              {bugReportUrl ? (
                <a href={bugReportUrl}>
                  <Bug size={14} />
                  {t.bugAction as string}
                </a>
              ) : (
                <span className="pending-link">
                  <Bug size={14} />
                  {t.bugPending as string}
                </span>
              )}
            </div>
          </div>
          <div id="ideas" className="feature-panel">
            <Vote size={24} />
            <h2>{t.ideasTitle as string}</h2>
            <p>{t.ideasBody as string}</p>
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

        <section id="support" className="section split">
          <div>
            <p className="eyebrow"><Heart size={15} />{t.support as string}</p>
            <h2>{t.fundingTitle as string}</h2>
            <p>{t.fundingBody as string}</p>
            {donateUrl ? (
              <a className="button secondary" href={donateUrl}>
                {t.supportHero as string}
                <ExternalLink size={16} />
              </a>
            ) : (
              <span className="pending-link">
                <Heart size={14} />
                {t.donatePending as string}
              </span>
            )}
          </div>
          <div className="funding-card">
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
      </main>

      <footer>
        <BrandMark />
        <p>{t.footer as string}</p>
      </footer>
    </div>
  );
}
