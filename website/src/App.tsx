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
  TrendingUp,
  Vote,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { GiscusPanel } from './GiscusPanel';
import { funding, ideas, release } from './siteData';

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
const defaultBugReportUrl =
  'https://github.com/IvicaSkrobo/Bili-Mushroom/issues/new?template=bug_report.yml&labels=bug';
const ideaSubmitUrl =
  'https://github.com/IvicaSkrobo/Bili-Mushroom/issues/new?template=feature_idea.yml&labels=idea';
const ideasListUrl = 'https://github.com/IvicaSkrobo/Bili-Mushroom/issues?q=is%3Aissue%20label%3Aidea';

const copy = {
  en: {
    eyebrow: 'Local-first field journal for Windows',
    title: 'Mushroom Book',
    subtitle: 'Your foraging journal',
    intro: 'A local Windows journal for mushroom finds, maps, notes, seasons, and photos.',
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
      ['Collect', 'Photos, notes, species, dates, and folders in one local library.'],
      ['Map', 'See where each species appears through your own field history.'],
      ['Understand', 'Stats, seasons, outings, and PDF export for your archive.'],
    ],
    workflowTitle: 'From find to archive',
    workflowBody: 'Add a find once. Keep it editable, mapped, searchable, and tied to its folder.',
    workflow: [
      ['Add', 'Import photos or create a find manually.'],
      ['Edit', 'Adjust species, date, location, notes, badges, and photos later.'],
      ['Use', 'Open folders, filter maps, read stats, and export a PDF.'],
    ],
    downloadBody:
      'Latest Windows download. Local fallback protects the page if GitHub returns old release data.',
    installTitle: 'Install notes',
    installBody:
      'Download the Windows setup file, run it, and if Windows SmartScreen appears choose More info, then Run anyway.',
    privacyTitle: 'Local by default',
    privacyBody:
      'Finds, notes, folders, and photos stay on your computer. Core cataloging works without an account or cloud service.',
    communityTitle: 'Community without a custom backend',
    communityBody:
      'Questions, release comments, showcase posts, bugs, and ideas live through GitHub.',
    bugTitle: 'Report bugs',
    bugBody: 'Report crashes, broken buttons, wrong translations, or confusing workflows.',
    bugAction: 'Report a bug',
    bugExternal: 'Uses GitHub issue form',
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
    screenshotsTitle: 'What the app actually covers',
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
  },
  hr: {
    eyebrow: 'Lokalni gljivarski dnevnik za Windows',
    title: 'Gljivobook',
    subtitle: 'Tvoj gljivarski dnevnik',
    intro: 'Lokalni Windows dnevnik za nalaze, mape, biljeske, sezone i fotografije.',
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
      ['Zbirka', 'Fotografije, biljeske, vrste, datumi i folderi u jednoj lokalnoj zbirci.'],
      ['Mapa', 'Vidi gdje se koja vrsta pojavljuje kroz tvoju povijest terena.'],
      ['Uvidi', 'Statistike, sezone, izlasci i PDF export za tvoju arhivu.'],
    ],
    workflowTitle: 'Od nalaza do arhive',
    workflowBody: 'Unesi nalaz jednom. Ostaje uredjiv, mapiran, pretraziv i vezan uz folder.',
    workflow: [
      ['Dodaj', 'Uvezi fotografije ili rucno napravi nalaz.'],
      ['Uredi', 'Promijeni vrstu, datum, lokaciju, biljeske, badgeve i fotografije.'],
      ['Koristi', 'Otvori foldere, filtriraj mapu, citaj statistike i izvezi PDF.'],
    ],
    downloadBody:
      'Zadnji Windows download. Lokalni fallback cuva stranicu ako GitHub vrati stariji release.',
    installTitle: 'Napomena za instalaciju',
    installBody:
      'Preuzmi Windows setup, pokreni ga, a ako se pojavi Windows SmartScreen odaberi More info pa Run anyway.',
    privacyTitle: 'Lokalno po defaultu',
    privacyBody:
      'Nalazi, biljeske, mape i fotografije ostaju na tvom racunalu. Osnovno katalogiziranje radi bez racuna i clouda.',
    communityTitle: 'Zajednica bez vlastitog backend-a',
    communityBody: 'Pitanja, komentari, prikazi nalaza, bugovi i ideje idu kroz GitHub.',
    bugTitle: 'Prijavi bug',
    bugBody: 'Prijavi crash, pokvareni gumb, krivi prijevod ili zbunjujuci workflow.',
    bugAction: 'Prijavi bug',
    bugExternal: 'Koristi GitHub issue obrazac',
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
    screenshotsTitle: 'Sto app stvarno pokriva',
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

function BrandMark() {
  return (
    <div className="brand-mark" aria-hidden="true">
      <img src="./gljivobook-icon.png" alt="" />
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
  const bugReportUrl = configuredBugReportUrl?.trim() || defaultBugReportUrl;
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
              <a href={bugReportUrl}>
                <Bug size={14} />
                {t.bugAction as string}
              </a>
              <span className="micro-note">{t.bugExternal as string}</span>
            </div>
          </div>
          <div id="ideas" className="feature-panel">
            <Vote size={24} />
            <h2>{t.ideasTitle as string}</h2>
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
      </main>

      <footer>
        <BrandMark />
        <p>{t.footer as string}</p>
      </footer>
    </div>
  );
}
