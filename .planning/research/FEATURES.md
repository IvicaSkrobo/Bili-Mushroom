# Feature Landscape: Mushroom Foraging Catalogue App

**Domain:** Personal mushroom foraging catalogue and journal (desktop)
**Researched:** 2026-04-08
**Context:** Windows desktop, fully local, primary user is Croatian forager (Gorski Kotar, Istria, Slavonia)

---

## Table Stakes

Features users expect in serious foraging catalogue app. Missing = incomplete or useless.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Photo storage per find | Foragers document visually; photos = primary record | Low | Core data model — must support multiple photos per find |
| Species name per entry | Every find needs species (even unconfirmed) | Low | Support common + scientific names |
| Date per find | When found = as critical as where | Low | EXIF auto-read + manual fallback |
| Location per find | Foragers protect + revisit spots; location critical | Low | GPS from EXIF; manual map pick fallback |
| Edibility/danger rating | Safety non-negotiable for foragers | Low | Prominent: Edible / Caution / Toxic / Deadly / Unknown |
| Species description | Reference info about find | Medium | Auto-populate from bundled database |
| Interactive map of finds | Visualizing where you've been = core to foraging | Medium | Pins per find; click to see finds |
| Search and filter | Find past finds by name, location, date | Low | Full-text search + field filters |
| Offline functionality | Forests = no signal; app must work offline | Low | All data local — already the architecture |
| Photo import from disk | Most foragers shoot on phone; photos land on PC | Medium | Folder import with EXIF extraction |
| Edit/correct any field | Foragers misidentify; corrections must be easy | Low | All fields editable post-import |
| Duplicate detection on re-import | Re-import same folder = no duplicates | Medium | Hash-based or path+date deduplication |

---

## Differentiators

Features setting this app apart from generic note-taking or mobile ID apps. Not universally expected, but high value once discovered.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| EXIF GPS + date auto-extraction | Zero-friction import — photo taken, metadata flows in | Medium | Rust-side EXIF parsing; fallback to filename date parsing |
| Built-in Croatian/European species database | No other desktop app has localized EU species with Croatian names | High | 150–300 species covering Croatia's forests; include Croatian common names (vrganji, lisičarka, smrčak, etc.) |
| Seasonal calendar (when/where to find) | Foragers plan trips by season; calendar shows what to expect each month | Medium | Per-species seasonality data in bundled database |
| Per-species statistics | "How many times found vrganji? Where? First find?" — rewarding for committed foragers | Medium | Aggregated from find records; no extra data entry |
| Foraging stats dashboard | Total finds, best spots, top months, rarest species — gamifies hobby | Medium | Derived from existing data; high delight-to-effort ratio |
| Wishlist with mark-as-found | "Want to find" list tied into collection | Low | Simple list with found/not-found toggle |
| Location → Date folder organization | Files organized on disk in human-readable structure user owns | Low | Matches forager thinking: place first, then visit |
| Configurable root folder | User chooses where data lives; portable, backup-friendly | Low | Critical for long-term trust |
| PDF export of collection | Printable record; share with mycological society; offline archival | Medium | Generate from find records + photos; useful for clubs + friends |
| Dangerous lookalike warnings | Per-species: "Easily confused with [Deadly species]" — life-safety value | Medium | Part of bundled database; Croatian context (Amanita phalloides common in all Croatian forests) |
| Map pin clustering | Many finds in same area → cluster pins, avoid clutter | Medium | Standard Leaflet.js cluster plugin |
| OpenStreetMap + satellite/terrain toggle | Free, offline-capable tiles; excellent Croatian forest coverage | Low | Leaflet.js with OpenStreetMap default + tile provider switch |
| Manual location pick on map | No GPS on photo (indoor shots, old cameras) → user pins on map | Low | Click-to-place on Leaflet map during entry |
| Filter finds by map area | Draw/click area → see only finds within it | High | Spatial query on SQLite coordinates |

---

## Anti-Features

Features to explicitly NOT build. Each has reason + alternative.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| AI photo identification (v1) | Accuracy unreliable (best apps: 49% in studies); liability risk; adds API cost or heavy local model; false confidence dangerous with toxic species | Bundled database + user-assigned species; mark AI ID as Phase 2+ with local on-device model |
| Cloud sync / backend | Massive infrastructure cost; privacy concerns (foragers territorial about spots); destroys local-first value | Local SQLite + user-controlled backup folder; users use own cloud drive (Dropbox, OneDrive) |
| Community/social features | Single-user app; social = server, accounts, moderation; app distributed to friends, not a platform | PDF export + distributable app IS the sharing model |
| Real-time weather integration | Adds API key dependency; breaks offline-first; v1 out of scope | Seasonal calendar provides planning context without weather API |
| Mobile companion app | Entirely separate project; different stack, distribution, UX; dilutes focus | Windows desktop first; mobile foraging served by existing apps (iNaturalist, etc.) |
| Crowdsourced species validation | Requires community + server; validation creates liability | Authoritative bundled database from Croatian mycological resources |
| Multi-device accounts | Authentication, sync conflict resolution, server cost | Single install per machine; portability through folder |
| Subscription / paywall | Target users = Croatian foragers sharing among friends; paywall kills adoption | Free distributable installer |
| In-app ads | Degrades trust + UX in personal journal app | Free, no ads |
| Map heatmaps (v1) | Complex to render with small personal datasets; pin clusters tell the story at personal scale | Add only at 100+ finds; defer to Phase 2+ |
| Route/track recording | Requires active GPS session; catalogue app, not trail recorder; Gaia GPS does this well | Keep focused on catalogue; foragers already use GPS apps for navigation |
| Spore print, cap shape, gill type fields | Overly detailed mycological data creates friction for casual foragers | Notes field captures ad hoc details; keep entry form simple |
| Web interface / browser app | Tauri already decided; web app = different deployment, different security model | Tauri desktop right choice for local file access |

---

## Feature Dependencies

```
Photo import → EXIF extraction → GPS coordinates + date
                                         ↓
                              Map pin placement + calendar entry
                                         ↓
                              Per-location and per-species stats

Species database → Auto-populate description + edibility + lookalikes
                                         ↓
                              Edibility warning on find detail
                                         ↓
                              Seasonal calendar per species

Find records (all) → Stats dashboard (totals, top species, best spots, top months)
                   → Wishlist mark-as-found trigger
                   → PDF export content

Map display → Cluster pins → Click cluster/pin → Show finds at location
```

---

## MVP Recommendation

MVP must deliver core forager loop: import → organize → view on map → find info → stats.

**Prioritize for MVP:**

1. Photo import with EXIF GPS + date extraction (folder-based)
2. Species assignment per find (manual selection from bundled database)
3. Edibility / danger rating displayed prominently
4. Interactive map with pins (OpenStreetMap + satellite toggle)
5. Find detail view (photo, species, date, location, notes, edibility, description)
6. Search and filter (by name, location, date)
7. Wishlist (add species, mark as found)
8. Foraging stats dashboard (totals, top species, best spots, top months)
9. Seasonal calendar (which species fruiting which month)
10. PDF export of collection

**Defer to Phase 2+:**
- AI photo identification (accuracy too low, adds significant complexity)
- Map area spatial filter (useful but not blocking core loop)
- Pin clustering (add when dataset grows; simple to add later with Leaflet plugin)
- Route/track recording (out of scope, different use case)

---

## Croatian / European Context

Shapes bundled species database scope + naming conventions.

### Priority Species for Croatian Database

**Highly sought edible species (table stakes in the database):**
- Boletus edulis — vrganji (porcini); Croatia's most prized mushroom; May–October
- Cantharellus cibarius — lisičarka / lisičica (golden chanterelle); June–October
- Boletus pinophilus — borikov vrganj (pine bolete)
- Boletus badius — kostanjevka (bay bolete)
- Macrolepiota procera — velika sunčanica (parasol mushroom)
- Agaricus campestris — pećurka (field mushroom)
- Armillaria mellea — krpeljača / medljika (honey fungus)
- Morchella elata / esculenta — smrčak (morel); spring only
- Pleurotus ostreatus — bukovača (oyster mushroom)
- Cantharellus tubaeformis — zimska lisičica (winter chanterelle)
- Craterellus cornucopioides — trubač / crna truba (black trumpet); Slavonia/Papuk in October
- Lactarius deliciosus — rujnica (saffron milkcap)
- Boletus aereus / Boletus aestivalis — ljetni vrganj (summer porcini)
- Tuber melanosporum / Tuber magnatum — crni / bijeli tartuf (truffle); Istria

**Deadly/toxic species requiring prominent warnings:**
- Amanita phalloides — zelena pupavka / smrdljiva pupavka (death cap); 90% of mushroom fatalities worldwide; all Croatian forests
- Amanita virosa — bijela pupavka (destroying angel); often confused with edible Agaricus
- Amanita pantherina — panterina muhara (panther cap); hallucinogenic/toxic
- Amanita muscaria — muhara (fly agaric); iconic but toxic
- Cortinarius orellanus — crvenjača (fool's webcap); kidney-destroying delayed toxicity
- Rubroboletus satanas — vražji vrganj / ludara (Satan's bolete); looks like porcini to beginners
- Galerina marginata — rebrasta patuljica (funeral bell); deadly lookalike for edible Pholiota/Kuehneromyces
- Omphalotus olearius — lažna lisičica (jack-o'-lantern); toxic chanterelle lookalike — critical Croatian pitfall

**Critical dangerous lookalike pairs (Croatia-specific):**
- Cantharellus cibarius (lisičarka / edible) ↔ Omphalotus olearius (lažna lisičica / toxic) — most common Croatian misidentification
- Boletus edulis (vrganj / edible) ↔ Rubroboletus satanas (vražji vrganj / toxic)
- Agaricus campestris (pećurka / edible) ↔ Amanita phalloides (zelena pupavka / deadly)
- Macrolepiota procera (velika sunčanica / edible) ↔ Amanita phalloides young buttons (deadly)

### Seasonality (Northern Mediterranean / Balkan climate)
- **Spring (March–May):** Smrčak (morel), St. George's mushroom, first chanterelles in Istria
- **Summer (June–August):** Chanterelles peak, first porcini, bay bolete
- **Autumn (September–November):** Porcini peak (September–October), black trumpet (Slavonia), honey fungus, saffron milkcap — "golden season" for Croatian foragers
- **Winter (December–February):** Very limited; oyster mushrooms on dead wood, velvet shank

### Legal Context
- Foraging in Croatia requires free permit from Croatian Forests (Hrvatske šume)
- Daily personal limit: 3 kg
- Fines: 133–933 euros
- App should note this in onboarding/help text (inform only — don't enforce)

---

## Sources

- GroCycle mushroom app comparison: https://grocycle.com/best-mushroom-identification-apps/
- EcoCation best free apps review: https://ecocation.org/best-free-mushroom-identification-apps/
- Real Mushrooms app review: https://realmushrooms.com/blogs/rm/best-mushroom-identification-app-top-3-reviewed/
- Modern Forager — Gaia GPS for mushroom hunting: https://modern-forager.com/the-best-gps-app-for-mushroom-hunting-gaia-gps/
- Expat in Croatia — mushroom harvest guide: https://www.expatincroatia.com/mushroom-harvest-croatia/
- Paths of Croatia — mushroom hunting guide: https://pathsofcroatia.com/mushroom-hunting-in-croatia/
- Fungi Atlas — Mushroom Forager's Calendar: https://fungiatlas.com/mushroom-calendar/
- Croatian ethnobotanical survey (PMC): https://pmc.ncbi.nlm.nih.gov/articles/PMC11175058/
- Mushroom Observer 2024 features: https://mushroomobserver.org/articles/43
- Selfsufficientish foraging app feature brainstorm: https://selfsufficientish.com/forum/viewtopic.php?t=27318
- Amanita phalloides lookalikes: https://fungiatlas.com/amanita-phalloides/
- PubMed app accuracy study: https://pubmed.ncbi.nlm.nih.gov/36794335/
- GeoForager spot tracking: https://geoforager.com/
- Mushroom Tracker (Canada): https://www.mushroomtracker.ca/
- Total Croatia — vrganji overview: https://www.total-croatia-news.com/lifestyle/31161-101-tastes-of-croatia-vrganji