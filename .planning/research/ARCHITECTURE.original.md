# Architecture Patterns

**Domain:** Local-first Tauri 2 desktop mushroom catalogue app
**Researched:** 2026-04-08
**Confidence:** HIGH (Tauri 2 docs verified, SQLite patterns verified, library choices verified)

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend (WebView)                  │
│                                                                   │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────────┐  │
│  │   UI Layer  │  │ TanStack     │  │     Zustand Store       │  │
│  │  (pages,    │  │ Query cache  │  │  (UI state, filters,    │  │
│  │  components)│  │ (server data)│  │   active find, modal)   │  │
│  └─────────────┘  └──────────────┘  └────────────────────────┘  │
│         │                │                       │               │
│         └────────────────┴───────────────────────┘               │
│                          │ invoke() / listen()                    │
└──────────────────────────│─────────────────────────────────────--┘
                           │ Tauri IPC (message passing)
┌──────────────────────────│──────────────────────────────────────┐
│                   Rust Backend (src-tauri)                        │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Tauri Commands                          │   │
│  │  import_photos  │  get_finds  │  search_finds             │   │
│  │  save_find      │  get_species│  export_pdf               │   │
│  │  scan_folder    │  tile_proxy │  get_stats                │   │
│  └────────────┬────┴─────────────┴───────────┬──────────────┘   │
│               │                               │                   │
│  ┌────────────▼──────────┐  ┌─────────────────▼─────────────┐   │
│  │   SQLite (sqlx)       │  │  File System (std::fs)         │   │
│  │   AppData/bili.db     │  │  User-chosen mushroom dir      │   │
│  │   FTS5 search index   │  │  Thumbnails in AppData cache   │   │
│  └───────────────────────┘  └───────────────────────────────┘   │
│                                                                   │
│  ┌───────────────────────┐  ┌───────────────────────────────┐   │
│  │  EXIF extraction      │  │  Map tile proxy                │   │
│  │  (kamadak-exif crate) │  │  (HTTP request + disk cache)   │   │
│  └───────────────────────┘  └───────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| React Pages (Map, Gallery, Species, Stats) | UI rendering, user interactions | TanStack Query hooks, Zustand store |
| TanStack Query layer | Caches Tauri command results, auto-invalidates | Tauri `invoke()` IPC |
| Zustand store | UI-only state (selected find, active filters, modal open/close, map view) | React components directly |
| Tauri Commands (Rust) | All business logic, file I/O, DB access | SQLite via sqlx, std::fs, kamadak-exif |
| SQLite database | Persistent structured data, FTS5 search index | Rust commands only (never directly from JS) |
| File system (user data dir) | Photos (original), thumbnails | Rust commands; thumbnails served via Tauri asset protocol |
| Tile cache (disk) | OpenStreetMap tile images cached locally | Rust tile proxy command |
| Species DB (bundled JSON/SQL) | Read-only species knowledge base | Loaded into SQLite at first run |

**Critical boundary rule:** The frontend never touches SQLite or the file system directly. All data access goes through typed Tauri commands. This enforces validation in Rust and prevents path traversal or injection.

---

## Data Flow

### Find Import Flow
```
User selects folder (dialog)
  → Rust: scan_folder command
    → Read all image files in folder recursively
    → Extract EXIF date + GPS coords (kamadak-exif)
    → Hash file contents for dedup check
    → Return candidate list to frontend
  → React shows preview/confirmation UI (TanStack Query holds candidates)
  → User confirms/edits
  → Rust: import_confirmed command
    → Copy files into Location/Date folder structure
    → Generate thumbnails (image crate, 300px wide, saved to AppData/thumbs/)
    → Insert rows into SQLite (finds, photos tables)
    → Update FTS5 index
  → TanStack Query invalidates find queries → UI refreshes
```

### Find Read Flow
```
React component mounts
  → useQuery(['finds'], () => invoke('get_finds', { filters }))
  → Rust: queries SQLite, returns typed FindRow structs serialized to JSON
  → TanStack Query caches result in memory
  → Component renders from cache
  → On stale or invalidation: re-invoke, update cache silently
```

### Map Tile Flow
```
Leaflet requests tile URL (custom tile layer pointing to localhost or asset)
  → Rust tile proxy command receives z/x/y params
    → Check AppData/tile-cache/{z}/{x}/{y}.png
    → Cache hit: return bytes immediately
    → Cache miss: fetch from OSM tile server, write to cache, return bytes
  → Leaflet renders tile
```

### Search Flow
```
User types in search box
  → Debounced (300ms) → invoke('search_finds', { query, filters })
  → Rust: SQLite FTS5 query (MATCH against finds_fts virtual table)
  → Returns ranked results (BM25)
  → TanStack Query updates search results key
```

---

## SQLite Schema

Database file: `AppData/Roaming/bili-mushroom/bili.db`

```sql
-- Core species reference (bundled, read-only after initial seed)
CREATE TABLE species (
  id          INTEGER PRIMARY KEY,
  latin_name  TEXT NOT NULL UNIQUE,
  common_name TEXT NOT NULL,            -- Croatian/local name
  common_name_en TEXT,
  edibility   TEXT NOT NULL CHECK(edibility IN ('edible','toxic','deadly','inedible','unknown')),
  description TEXT,                     -- Rich text / markdown
  season_start INTEGER,                 -- Month 1-12
  season_end   INTEGER,
  habitat      TEXT,
  lookalikes   TEXT,                    -- JSON array of species IDs
  created_at   TEXT DEFAULT (datetime('now'))
);

-- Named locations (foraging spots)
CREATE TABLE locations (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,            -- e.g. "Gorski Kotar - Risnjak"
  lat         REAL,
  lon         REAL,
  country     TEXT DEFAULT 'Croatia',
  region      TEXT,                     -- e.g. "Gorski Kotar"
  notes       TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Individual foraging sessions/finds
CREATE TABLE finds (
  id          INTEGER PRIMARY KEY,
  species_id  INTEGER REFERENCES species(id),
  location_id INTEGER REFERENCES locations(id),
  found_at    TEXT NOT NULL,            -- ISO 8601 date: "2024-05-10"
  quantity    INTEGER,
  edibility_override TEXT,             -- User can override species default
  notes       TEXT,
  user_name   TEXT,                    -- User's label for this find
  lat         REAL,                    -- Find-specific coords (may differ from location)
  lon         REAL,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

-- Photos attached to a find
CREATE TABLE photos (
  id          INTEGER PRIMARY KEY,
  find_id     INTEGER NOT NULL REFERENCES finds(id) ON DELETE CASCADE,
  filename    TEXT NOT NULL,           -- Original filename
  stored_path TEXT NOT NULL,           -- Relative path under user data dir
  thumb_path  TEXT NOT NULL,           -- Relative path under AppData/thumbs/
  file_hash   TEXT NOT NULL UNIQUE,    -- SHA-256 for dedup
  exif_date   TEXT,                    -- Extracted from EXIF
  exif_lat    REAL,
  exif_lon    REAL,
  width       INTEGER,
  height      INTEGER,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- Wishlist (species user wants to find)
CREATE TABLE wishlist (
  id          INTEGER PRIMARY KEY,
  species_id  INTEGER REFERENCES species(id),
  custom_name TEXT,                    -- If species not in DB
  notes       TEXT,
  priority    INTEGER DEFAULT 0,
  found_find_id INTEGER REFERENCES finds(id), -- Set when found, null when not
  created_at  TEXT DEFAULT (datetime('now'))
);

-- App settings (key-value store)
CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL
  -- e.g. ('data_dir', 'C:/Users/Ivica/Mushrooms')
  --       ('map_center_lat', '45.5')
  --       ('map_zoom', '8')
);

-- FTS5 virtual table for full-text search
CREATE VIRTUAL TABLE finds_fts USING fts5(
  content='finds',
  content_rowid='id',
  notes,
  user_name,
  tokenize='unicode61'
);

-- FTS5 on species for knowledge base search
CREATE VIRTUAL TABLE species_fts USING fts5(
  content='species',
  content_rowid='id',
  common_name,
  common_name_en,
  latin_name,
  description,
  tokenize='unicode61'
);

-- Triggers to keep FTS5 in sync
CREATE TRIGGER finds_ai AFTER INSERT ON finds BEGIN
  INSERT INTO finds_fts(rowid, notes, user_name) VALUES (new.id, new.notes, new.user_name);
END;
CREATE TRIGGER finds_ad AFTER DELETE ON finds BEGIN
  INSERT INTO finds_fts(finds_fts, rowid, notes, user_name) VALUES('delete', old.id, old.notes, old.user_name);
END;
CREATE TRIGGER finds_au AFTER UPDATE ON finds BEGIN
  INSERT INTO finds_fts(finds_fts, rowid, notes, user_name) VALUES('delete', old.id, old.notes, old.user_name);
  INSERT INTO finds_fts(rowid, notes, user_name) VALUES (new.id, new.notes, new.user_name);
END;

-- Indexes for common query patterns
CREATE INDEX idx_finds_location ON finds(location_id);
CREATE INDEX idx_finds_species  ON finds(species_id);
CREATE INDEX idx_finds_date     ON finds(found_at);
CREATE INDEX idx_photos_find    ON photos(find_id);
CREATE INDEX idx_photos_hash    ON photos(file_hash);
```

**Notes on schema decisions:**
- `found_at` stored as TEXT (ISO 8601) — simple date range queries work with string comparison when format is consistent.
- `stored_path` is relative to user-configured `data_dir` (from settings table) — database stays portable if user moves their data folder.
- `thumb_path` is relative to `AppData/thumbs/` — thumbnails are regenerable, kept separate from user data.
- `file_hash` on photos table prevents re-import of same photo. Check before copying.
- `finds_fts` uses `content=` external content mode — the FTS index references the `finds` table, triggers keep it in sync, avoids double-storage.

---

## Tauri Command Split: Rust vs React

### Belongs in Rust Backend (Tauri Commands)

| Command | Why Rust |
|---------|----------|
| `scan_folder(path)` | File system enumeration, safe path handling |
| `extract_exif(path)` | Binary parsing via kamadak-exif crate |
| `import_photos(candidates)` | File copying, dedup hash, thumbnail generation |
| `get_finds(filters)` | SQLite query, returns typed structs |
| `save_find(find)` | Validated write to SQLite |
| `delete_find(id)` | Cascading delete (photos, FTS index) |
| `search_finds(query)` | FTS5 MATCH query via sqlx |
| `get_species(id)` | SQLite lookup |
| `get_stats()` | Aggregation queries (COUNT, GROUP BY) |
| `get_tile(z, x, y)` | HTTP fetch + disk cache |
| `export_pdf(find_ids)` | PDF generation (printpdf crate) |
| `get_settings()` / `save_settings()` | Read/write AppData |
| `choose_data_dir()` | Native folder dialog (tauri-plugin-dialog) |

### Belongs in React Frontend

| Concern | Why Frontend |
|---------|-------------|
| Map rendering (Leaflet) | WebView capability, JavaScript library |
| Search debouncing | UI concern (300ms delay before invoke) |
| Photo lightbox / gallery UI | Pure display logic |
| Filter state (active species, date range) | Ephemeral UI state, Zustand |
| Form validation display | UX feedback layer |
| Seasonal calendar rendering | Computed from data already fetched |
| Wishlist UI interactions | Operates on already-fetched data |

---

## File System Architecture

### User Data Directory (user-configurable)
Stored in settings table as `data_dir`. Defaults to `Documents/Bili-Mushroom/`.

```
{data_dir}/
  Croatia/
    Gorski Kotar/
      2024-05-10/
        DSC_0042.jpg          ← original (never modified)
        DSC_0043.jpg
      2024-08-15/
        ...
    Istria/
      ...
  Slovenia/
    ...
```

### App Internal Directory (AppData, managed by app)
```
AppData/Roaming/bili-mushroom/
  bili.db                     ← SQLite database
  thumbs/
    {photo_id}.jpg            ← 300px wide JPEG thumbnails
  tile-cache/
    {z}/
      {x}/
        {y}.png               ← OSM tile cache
```

**Rationale for split:**
- User data dir is the "forager's archive" — they can back it up, copy it, open it in Explorer.
- AppData holds regenerable cache (thumbnails, tiles) and the index (SQLite). If bili.db is deleted, the app can re-scan and re-index.
- Never store original photos in AppData — they belong to the user, not the app.

---

## Map Architecture: Tile Caching Strategy

**Recommended approach: Rust tile proxy via Tauri command + Leaflet custom tile layer.**

The alternative (PMTiles with MapLibre GL) is better for truly offline apps needing full regional downloads up front. For this app, progressive tile caching as the user browses is the better UX.

**Implementation:**

1. Rust command `get_tile(z, x, y, source)` acts as a caching proxy:
   - Check `AppData/tile-cache/{source}/{z}/{x}/{y}.png`
   - Hit: return bytes as base64 or via Tauri asset protocol
   - Miss: fetch from `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, write to disk, return
2. React registers a custom Leaflet `TileLayer` with a URL template pointing to `tauri://localhost/tile/{z}/{x}/{y}` or invoking the command via a JavaScript fetch interceptor.
3. Tiles accumulate on disk as the user browses — no explicit "download region" step needed for v1.

**OSM tile usage note:** OSM tiles require User-Agent header and reasonable rate limiting. Rust proxy can add these transparently (the frontend never makes direct HTTP requests).

**Satellite layer:** Switch tile source (e.g., ESRI World Imagery) in the same proxy — just change the upstream URL parameter.

---

## Photo Management

### Import
1. User selects source folder via `tauri-plugin-dialog`
2. `scan_folder` Rust command: walk directory, collect image files
3. `extract_exif` per image: date, GPS coords, orientation
4. Hash file content (SHA-256) — check against `photos.file_hash` for dedup
5. Return candidate list to React for confirmation UI
6. On confirm: `import_photos` copies originals to `{data_dir}/{Location}/{Date}/`
7. Generate thumbnail: `image` crate → resize to 300px wide → save to `AppData/thumbs/{id}.jpg`
8. Strip EXIF GPS from thumbnails (privacy-conscious) — preserve it in DB only
9. Insert `photos` row, update `finds_fts` index

### Serving Photos to React
- Thumbnails: served via Tauri asset protocol from AppData — fast, no IPC overhead
- Full-res: invoke `open_photo(id)` which returns path, React constructs `convertFileSrc(path)` URL
- Never base64-encode photos through IPC — use Tauri's asset serving

### EXIF Crate Choice
**Use `kamadak-exif` (pure Rust) over `rexiv2`.**
- `rexiv2` wraps gexiv2/Exiv2 (C++ library) — requires dynamic linking, complicates Windows distribution
- `kamadak-exif` is pure Rust, compiles cleanly on Windows, reads GPS coords and datetime from JPEG/TIFF/HEIF/PNG/WebP (MEDIUM confidence — verify HEIF support on target build)

---

## Search Architecture

**Use SQLite FTS5.** Do not use in-memory filtering for a catalogue that could hold thousands of finds.

FTS5 advantages for this app:
- BM25 ranking built in — relevant finds surface first
- Supports prefix search (`Vrganj*` → matches Vrganji)
- Unicode tokenizer handles Croatian characters correctly (`unicode61` tokenizer)
- Integrated with the same SQLite connection — no separate search process
- At Tauri's reported 50ms for 10,000 files, this is fast enough for a forager's catalogue

**Search scope:**
- `finds_fts`: notes, user_name — personal observations
- `species_fts`: names, description — knowledge base search
- Combine with SQL filters: date range, location, edibility — these stay as SQL WHERE clauses, not FTS

**Non-FTS filtering** (use SQL WHERE, not FTS):
- Date range: `found_at BETWEEN '2024-01-01' AND '2024-12-31'`
- Location: `location_id = ?`
- Edibility: JOIN with species table

---

## State Management

**Three-layer pattern:**

| Layer | Tool | What It Holds |
|-------|------|---------------|
| Server state | TanStack Query | All SQLite-backed data (finds, species, stats) |
| Global UI state | Zustand | Selected find, active map view, search query string, filters, modal open state |
| Local UI state | React `useState` | Form field values, hover states, animation states |

**Key patterns:**

```typescript
// TanStack Query wraps Tauri invocations
const { data: finds } = useQuery({
  queryKey: ['finds', filters],
  queryFn: () => invoke<Find[]>('get_finds', { filters }),
  staleTime: 30_000,
})

// After a mutation, invalidate the relevant query
const mutation = useMutation({
  mutationFn: (find: NewFind) => invoke('save_find', { find }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['finds'] }),
})
```

**Why not use the Tauri SQL plugin directly from JS?**
Using `tauri-plugin-sql` from JavaScript exposes raw SQL to the frontend — schema details leak to the UI layer, and there's no validation boundary. Prefer typed Tauri commands that return domain types. The Rust layer is the only SQL author.

---

## Patterns to Follow

### Pattern 1: Command per use case, not per table
**What:** One command per user action (import_photos, save_find) not one per SQL operation (insert_photo, update_find, delete_photo).
**Why:** Encapsulates multi-step transactions. Import involves copying files, generating thumbnails, inserting rows, and updating FTS — all in one atomic command.

### Pattern 2: Relative paths in database
**What:** Store `stored_path` as path relative to `data_dir`, not absolute.
**Why:** If user moves their mushroom folder or shares the database, paths remain valid.

### Pattern 3: Thumbnails are always regenerable
**What:** Thumbs directory can be wiped. A `regenerate_thumbnails` command re-creates from originals.
**Why:** AppData can be cleared by Windows cleanup tools. App must not be broken by this.

### Pattern 4: FTS triggers, not dual writes
**What:** Use SQLite triggers to keep FTS5 index in sync, not application-level dual writes.
**Why:** Rust commands only write to the base table. Triggers handle FTS automatically — no risk of base table and index diverging.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Storing absolute file paths in database
**What goes wrong:** User moves their mushroom folder → all photo paths break
**Instead:** Store relative paths + resolve at runtime from settings.data_dir

### Anti-Pattern 2: Loading all photos as base64 over IPC
**What goes wrong:** Loading 50 thumbnails for a gallery page sends megabytes over the IPC bridge
**Instead:** Use `convertFileSrc()` / Tauri asset protocol to serve images directly from disk

### Anti-Pattern 3: Running SQL from the frontend (tauri-plugin-sql)
**What goes wrong:** Schema details couple to UI; no validation boundary; raw SQL in JS is fragile
**Instead:** Typed Tauri commands that accept/return domain types

### Anti-Pattern 4: Blocking the Rust command thread
**What goes wrong:** EXIF extraction on 200 photos blocks UI
**Instead:** All Tauri commands are async; use `tokio::spawn` for parallel EXIF extraction during import

### Anti-Pattern 5: Downloading satellite tiles without attribution
**What goes wrong:** ESRI and OSM both have ToS; mass downloads during testing may get IP blocked
**Instead:** Respect rate limits in tile proxy (tokio sleep between misses), add User-Agent header

---

## Suggested Build Order

The fastest path to a usable app, based on data dependencies:

**Stage 1 — Foundation (nothing works without this)**
1. SQLite schema + migrations (sqlx, `bili.db` created on first launch)
2. Settings command — store/retrieve `data_dir`
3. Basic Tauri command scaffold (one hello-world command proves IPC works)
4. TanStack Query + Zustand wired in React

**Stage 2 — Import pipeline (core value unlocked)**
5. Folder scan command (returns file list)
6. EXIF extraction (kamadak-exif — date and GPS)
7. Photo copy + thumbnail generation (image crate)
8. `import_photos` command — ties scan + EXIF + copy + DB insert
9. React import UI (folder picker → preview → confirm)

**Stage 3 — Browse and find management**
10. Find list/gallery view (photos, species name, date)
11. Find detail view (edit notes, location, date)
12. Species DB seed (bundled JSON → insert into species table at first launch)
13. Species autocomplete in find edit form

**Stage 4 — Map**
14. Leaflet base map (Croatia view, OSM tiles online first)
15. Find pins on map
16. Tile proxy + disk cache (enables offline use)
17. Satellite layer toggle

**Stage 5 — Search and filter**
18. FTS5 search (text search across finds)
19. SQL filters (date range, location, edibility)
20. Wishlist CRUD

**Stage 6 — Stats and export**
21. Stats dashboard (aggregation queries)
22. Seasonal calendar
23. PDF export (printpdf crate)

**Rationale for this order:**
- Stage 1 unblocks all later stages — no work can happen without persistence
- Stage 2 first because the core value proposition is "import and organise" — validates that the whole pipeline works end-to-end
- Map deferred to Stage 4 because tile proxy adds complexity; find import is more important to validate
- Stats and export are last — they depend on having real data

---

## Scalability Considerations

| Concern | At 500 finds | At 5,000 finds | At 50,000 finds |
|---------|-------------|----------------|-----------------|
| Gallery load | SELECT all, fine | Pagination needed | Pagination + lazy load |
| FTS search | <10ms | <50ms | <200ms, still fine |
| Map pins | All pins fine | Cluster markers | Cluster markers required |
| Thumbnail cache | ~150MB | ~1.5GB | User-managed cleanup needed |
| Tile cache | ~500MB Croatia | Cap at 2GB, LRU evict | LRU eviction required |
| Stats queries | Instant | Instant | May need materialized views |

A typical forager will have hundreds to low thousands of finds. 50K finds is an extreme case (decades of professional use). Design for 5,000 comfortably.

---

## Sources

- Tauri 2 Architecture: https://v2.tauri.app/concept/architecture/ (HIGH confidence)
- Tauri SQL Plugin: https://v2.tauri.app/plugin/sql/ (HIGH confidence)
- Tauri File System Plugin: https://v2.tauri.app/plugin/file-system/ (HIGH confidence)
- kamadak-exif (pure Rust EXIF): https://github.com/kamadak/exif-rs (HIGH confidence)
- image crate (thumbnails): https://docs.rs/image/latest/image/ (HIGH confidence)
- SQLite FTS5: https://www.sqlite.org/fts5.html (HIGH confidence)
- TanStack Query + Tauri pattern: https://medium.com/@mojca.rojko/supercharging-sqlite-with-react-query-in-tauri-0c613da4f3c9 (MEDIUM confidence)
- Zustand + TanStack Query split: https://dev.to/martinrojas/federated-state-done-right-zustand-tanstack-query-and-the-patterns-that-actually-work-27c0 (MEDIUM confidence)
- Tauri offline maps POC (PMTiles): https://github.com/inro-digital/tauri-offline-maps (MEDIUM confidence — alternative approach, not recommended for v1)
- Leaflet IndexedDB tile caching: https://github.com/mWater/offline-leaflet-map (MEDIUM confidence — considered but Rust proxy preferred)
- rexiv2 (C++ wrapper, NOT recommended): https://github.com/felixc/rexiv2 (HIGH confidence on why to avoid)
