# Feature Landscape: Mushroom Foraging Catalogue App

**Domain:** Personal mushroom foraging catalogue and journal (desktop)
**Researched:** 2026-04-08
**Context:** Windows desktop, fully local, primary user is a Croatian forager (Gorski Kotar, Istria, Slavonia)

---

## Table Stakes

Features users expect in any serious foraging catalogue app. Missing = product feels incomplete or useless.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Photo storage per find | Foragers document everything visually; photos are the primary record | Low | Core data model — must support multiple photos per find |
| Species name per entry | Every find must be attributed to a species (even if unconfirmed) | Low | Support both common and scientific names |
| Date per find | When you found it is as important as where | Low | EXIF auto-read + manual fallback |
| Location per find | Foragers protect and revisit spots; location is critical | Low | GPS from EXIF; manual map pick fallback |
| Edibility/danger rating | Safety is non-negotiable for foragers | Low | Prominent display: Edible / Caution / Toxic / Deadly / Unknown |
| Species description | Reference info about what you found | Medium | Can be auto-populated from bundled database |
| Interactive map of finds | Visualizing where you've been is core to foraging | Medium | Pins per find; click to see what was found there |
| Search and filter | Finding past finds by name, location, date | Low | Full-text search plus filter by field |
| Offline functionality | Forests have no signal; app must work without internet | Low | All data local — this is already the architecture |
| Photo import from disk | Most foragers shoot on phone; photos land on PC | Medium | Folder import with EXIF extraction |
| Edit/correct any field | Foragers misidentify; corrections must be easy | Low | All fields editable post-import |
| Duplicate detection on re-import | Re-importing from same folder must not create duplicates | Medium | Hash-based or path+date deduplication |

---

## Differentiators

Features that set this app apart from generic note-taking or mobile ID apps. Not universally expected, but highly valued once discovered.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| EXIF GPS + date auto-extraction | Zero-friction import — photo taken, metadata flows in automatically | Medium | Rust-side EXIF parsing; fallback to filename date parsing |
| Built-in Croatian/European species database | No other desktop app has localized EU species with Croatian names | High | 150–300 species covering Croatia's forests; include Croatian common names (vrganji, lisičarka, smrčak, etc.) |
| Seasonal calendar (when/where to find) | Foragers plan trips by season; calendar view shows what to expect each month | Medium | Per-species seasonality data in the bundled database |
| Per-species statistics | "How many times have I found vrganji? Where? First find?" — rewarding for committed foragers | Medium | Aggregated from find records; no extra data entry |
| Foraging stats dashboard | Total finds, best spots, top months, rarest species — gamifies the hobby | Medium | Derived from existing data; high delight-to-effort ratio |
| Wishlist with mark-as-found | Dedicated "want to find" list that ties into the collection | Low | Simple list with found/not-found toggle |
| Location → Date folder organization | Files organized on disk in a human-readable structure the user owns | Low | Matches how foragers think: place first, then visit |
| Configurable root folder | User chooses where their mushroom data lives; portable, backup-friendly | Low | Critical for long-term trust in the app |
| PDF export of collection | Printable record; share with mycological society; offline archival | Medium | Generate from find records + photos; useful for clubs and foraging friends |
| Dangerous lookalike warnings | Per-species: "Easily confused with [Deadly species]" — life-safety value | Medium | Part of bundled species database; Croatian context (Amanita phalloides is common in all Croatian forests) |
| Map pin clustering | When many finds are in the same area, cluster pins to avoid clutter | Medium | Standard Leaflet.js cluster plugin |
| OpenStreetMap + satellite/terrain toggle | Free, offline-capable tiles; excellent coverage for Croatian forests | Low | Leaflet.js with OpenStreetMap default + tile provider switch |
| Manual location pick on map | When photos lack GPS (indoor shots, old cameras), user can pin on map | Low | Click-to-place on Leaflet map during entry |
| Filter finds by map area | Draw or click an area on map to see only finds within it | High | Spatial query on SQLite coordinates |

---

## Anti-Features

Features to explicitly NOT build. Each has a reason and an alternative.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| AI photo identification (v1) | Accuracy is unreliable (best apps get 49% correct in studies); liability risk; adds API cost or heavy local model; false confidence is dangerous with toxic species | Bundled species database with user-assigned species; mark AI ID as Phase 2+ when approached with local on-device model |
| Cloud sync / backend | Massive infrastructure cost; privacy concerns (foragers are territorial about spots); destroys local-first value proposition | Local SQLite + user-controlled backup folder; let users use their own cloud drive (Dropbox, OneDrive) for backup |
| Community/social features | Single-user app; social = server, accounts, moderation; this app is distributed to friends, not a platform | PDF export and distributable app IS the sharing model |
| Real-time weather integration | Adds API key dependency; breaks offline-first; v1 out of scope | Seasonal calendar provides planning context without weather API |
| Mobile companion app | Entirely separate project; different stack, distribution, UX; dilutes focus | Windows desktop first; mobile foraging workflows served by existing apps (iNaturalist, etc.) |
| Crowdsourced species validation | Requires community and server; accuracy validation creates liability | Authoritative bundled database sourced from Croatian mycological resources |
| Multi-device accounts | Authentication, sync conflict resolution, server cost | Single install per machine; data portability through folder |
| Subscription / paywall | Target users are Croatian foragers sharing among friends; paywall kills adoption | Free distributable installer |
| In-app ads | Degrades trust and UX in a personal journal app | Free, no ads |
| Map heatmaps (v1) | Complex to render meaningfully with small personal datasets; pin clusters tell the story at personal scale | Add only when user has 100+ finds; defer to Phase 2+ |
| Route/track recording | Requires active GPS tracking session; this is a catalogue app, not a trail recorder; Gaia GPS does this well | Keep app focused on catalogue; foragers already use GPS apps for navigation |
| Spore print, cap shape, gill type fields | Overly detailed mycological data entry creates friction for casual foragers | Notes field captures ad hoc details; keep entry form simple |
| Web interface / browser app | Tauri is already decided; web app = different deployment, different security model | Tauri desktop is the right choice for local file access |

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

The minimum viable product must deliver the core forager loop: import → organize → view on map → find info → stats.

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

This context shapes the bundled species database scope and naming conventions.

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
- Amanita phalloides — zelena pupavka / smrdljiva pupavka (death cap); responsible for 90% of mushroom fatalities worldwide; found across all Croatian forests
- Amanita virosa — bijela pupavka (destroying angel); often confused with edible Agaricus
- Amanita pantherina — panterina muhara (panther cap); hallucinogenic/toxic
- Amanita muscaria — muhara (fly agaric); iconic but toxic
- Cortinarius orellanus — crvenjača (fool's webcap); kidney-destroying delayed toxicity
- Rubroboletus satanas — vražji vrganj / ludara (Satan's bolete); looks like porcini to beginners
- Galerina marginata — rebrasta patuljica (funeral bell); deadly lookalike for edible Pholiota/Kuehneromyces
- Omphalotus olearius — lažna lisičica (jack-o'-lantern); toxic lookalike for chanterelle — critical Croatian pitfall

**Critical dangerous lookalike pairs for the database (Croatia-specific):**
- Cantharellus cibarius (lisičarka / edible) ↔ Omphalotus olearius (lažna lisičica / toxic) — most common Croatian misidentification
- Boletus edulis (vrganj / edible) ↔ Rubroboletus satanas (vražji vrganj / toxic)
- Agaricus campestris (pećurka / edible) ↔ Amanita phalloides (zelena pupavka / deadly)
- Macrolepiota procera (velika sunčanica / edible) ↔ Amanita phalloides young buttons (deadly)

### Seasonality (Northern Mediterranean / Balkan climate)
- **Spring (March–May):** Smrčak (morel), St. George's mushroom, first chanterelles in Istria
- **Summer (June–August):** Chanterelles peak, first porcini, bay bolete
- **Autumn (September–November):** Porcini peak (September–October), black trumpet (Slavonia), honey fungus, saffron milkcap — the "golden season" for Croatian foragers
- **Winter (December–February):** Very limited; oyster mushrooms on dead wood, velvet shank

### Legal Context
- Foraging in Croatia requires a free permit from Croatian Forests (Hrvatske šume)
- Daily personal collection limit: 3 kg
- Fines for violations: 133–933 euros
- The app should note this in onboarding or help text (not enforce it — just inform)

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
