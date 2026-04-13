# Phase 03: Map - Research

**Researched:** 2026-04-09
**Domain:** Interactive mapping (Leaflet + react-leaflet v5), Rust tile proxy, offline tile caching, marker clustering
**Confidence:** HIGH (core stack verified), MEDIUM (cluster library peer-dep workaround), HIGH (tile proxy architecture)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Two-level popup. Level 1: species name + date found. Level 2 (on name click): mini card with thumbnail, name, date, Edit button that opens `EditFindDialog` in CollectionTab.
- **D-02:** Multiple finds at same lat/lng → cluster pin with count badge (e.g. "3"). Clicking cluster shows scrollable list. Each row clickable to Level 2 mini card.
- **D-03:** Modal map picker. `EditFindDialog` gets a "Pick on map" button. Opens full-screen modal. User taps to place draggable pin; "Confirm location" closes modal and writes lat/lng back to edit form.
- **D-04:** Picker opens centered on existing coordinates if find already has them; pin is moveable.
- **D-05:** Esri World Imagery for satellite/aerial layer. Free, no API key. URL: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
- **D-06:** Two layers only — OSM (default) + Esri satellite. Leaflet `L.control.layers` widget.
- **D-07:** Auto-cache as user browses. Every tile through the Rust proxy is written to disk automatically.
- **D-08:** Online/offline status badge visible on the map (small colored dot: green = online, grey = cached).
- **D-09:** Settings panel: current tile cache size (MB) + "Clear tile cache" button.
- **D-10:** Default max cache size: 200 MB, user-configurable in Settings. LRU eviction when limit reached.
- **D-11:** Tile cache stored at `<StorageRoot>/tile-cache/`. Keeps all user data portable in one folder.
- **D-12:** Tile fetching MUST go through a Rust Tauri command (HTTP fetch + disk write). Do NOT use browser IndexedDB or service workers — Tauri WebView2 limitations make these unreliable. (Phase 1 decision — locked.)

### Claude's Discretion

- Exact visual design of cluster badge, popup dimensions, and mini card layout — match existing shadcn/ui card style from CollectionTab.
- LRU eviction implementation details (SQLite metadata table vs. filesystem timestamps) — pick the lighter approach.
- Map default center coordinates (Croatia region) and zoom level — use approximately `[45.1, 15.2]`, zoom 7.
- How to pass the `storagePath` to the tile proxy Rust command — read from Zustand store and pass as a parameter.
- Exact Leaflet cluster library choice (Leaflet.markercluster or manual grouping) — choose what integrates cleanly with react-leaflet v5.

### Deferred Ideas (OUT OF SCOPE)

- Pre-download a region for full offline use before going into the field (v2 — MAP-V2-01)
- Terrain/topographic layer (OpenTopoMap) — noted as v2 option
- Reverse geocoding on location picker (no external API allowed in v1)
- Map clustering animation/spiderfy (v2 polish)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MAP-01 | All finds displayed as clickable pins on an interactive map | `useFinds()` already returns `lat`/`lng`; Leaflet `<Marker>` + `<Popup>` renders them |
| MAP-02 | User can switch between OSM street view and satellite/terrain view | `<LayersControl>` with two `<LayersControl.BaseLayer>` entries; Esri tile URL confirmed |
| MAP-03 | Map tiles cached on disk for offline use (within previously viewed areas) | Rust async URI scheme protocol + reqwest + disk write; `data:` URIs allowed in existing CSP |
| MAP-04 | Clicking a pin shows the mushroom(s) found at that location | Two-level `<Popup>` pattern; same coordinate grouping done client-side before render |
| MAP-05 | Map defaults to Croatia/Balkans; auto-zooms to fit all pins when finds outside region | `MapContainer center={[45.1, 15.2]} zoom={7}`; `map.fitBounds()` via `useMap()` hook |
| MAP-06 | User can pick a location on the map when manually entering or editing a find's location | Full-screen `<Dialog>` containing `<MapContainer>` + click/drag handler; callback prop to `EditFindDialog` |
</phase_requirements>

---

## Summary

Phase 3 implements the interactive map tab for Bili Mushroom using the committed stack: Leaflet 1.9.x + react-leaflet 5.0.x. The library trio (`leaflet`, `react-leaflet`, `@types/leaflet`) is not yet installed and must be added in Wave 0 of the plan. The critical architectural constraint from Phase 1 — a Rust-side tile proxy using a custom URI scheme rather than browser IndexedDB — is confirmed correct by the current CSP configuration: external tile server domains (`tile.openstreetmap.org`, `server.arcgisonline.com`) are not whitelisted in `connect-src`, but `data:` and `blob:` URIs ARE allowed in `img-src`. This means tiles must travel: remote URL → Rust fetch → disk cache → base64 `data:` URI → `<img src>` in Leaflet.

The marker clustering requirement (D-02) has a library compatibility wrinkle: `react-leaflet-cluster` v4.x requires React 19 as a peer dependency, but this project uses React 18. Version 3.1.1 supports `react ^18.2.0 || ^19.0.0` and `react-leaflet ^4.0.0` — but phase uses react-leaflet v5. The recommended approach is to install `react-leaflet-cluster@3.1.1 --legacy-peer-deps` (which works at runtime with react-leaflet v5's compatible API surface) or to implement same-location grouping manually client-side before rendering, avoiding the cluster library entirely. Manual grouping is simpler, well within phase scope given the low pin density (personal forager collection, rarely > 200 finds), and has zero peer dependency risk.

The location picker (MAP-06) opens a second `<MapContainer>` inside a `<Dialog>`. The key integration pattern is a callback prop `onLocationPicked(lat: number, lng: number)` passed into the picker modal and called when the user confirms. `EditFindDialog` already accepts this shape.

**Primary recommendation:** Install react-leaflet + leaflet + @types/leaflet. Implement cluster as client-side grouping (no library). Implement tile proxy as Tauri async URI scheme protocol (`tile://`) with reqwest + rusqlite metadata table for LRU. Return tiles as `data:image/png;base64,...` data URIs.

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 3 |
|-----------|-------------------|
| Platform: Windows primary (Win 10/11) | Leaflet works in WebView2 (Chromium-based); no platform-specific concerns |
| Storage: 100% local; no internet required for core features | Tile proxy + disk cache satisfies this; confirmed CSP does not allow external tile fetch from browser side |
| Tech Stack: Tauri 2.x + React 18+ + Rust | react-leaflet v5 + React 18 are confirmed compatible |
| Leaflet 1.9.x + react-leaflet 5.0.x | These are the ONLY map libraries to use |
| leaflet.offline 3.2.x — evaluate against custom Rust proxy | Decision D-12 locks the Rust proxy; `leaflet.offline` (IndexedDB) is explicitly prohibited |
| Heavy I/O in Rust Tauri commands | Tile fetching and disk write stay in Rust |
| Zustand + TanStack Query | Map reads finds via `useFinds()` (already TanStack Query); Zustand for `storagePath` |
| shadcn/ui + Tailwind v4 | Popups, picker modal, cluster badges use existing shadcn Card, Button, Dialog, Badge |

---

## Standard Stack

### Core (must install)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| leaflet | 1.9.4 | Map engine | Confirmed: `npm view leaflet version` → 1.9.4 [VERIFIED: npm registry] |
| react-leaflet | 5.0.0 | React bindings | Confirmed: `npm view react-leaflet version` → 5.0.0 [VERIFIED: npm registry] |
| @types/leaflet | 1.9.21 | TypeScript types | Confirmed: `npm view @types/leaflet version` → 1.9.21 [VERIFIED: npm registry] |

### Rust dependencies (must add to Cargo.toml)
| Crate | Version | Purpose | Why |
|-------|---------|---------|-----|
| reqwest | 0.13.2 | HTTP client for tile fetch in Rust | Latest stable [VERIFIED: cargo search]. Use `features = ["rustls-tls"]` to avoid native OpenSSL dependency on Windows |
| tauri (already present) | 2.10.3 | `register_asynchronous_uri_scheme_protocol` | Already in Cargo.toml; the async URI scheme API is available in current version [VERIFIED: cargo search] |

### Already installed (no action needed)
| Library | Version | Purpose |
|---------|---------|---------|
| zustand | 5.x | Zustand already in package.json |
| @tanstack/react-query | 5.x | Already in package.json; `useFinds()` hook already built |
| shadcn/ui (Card, Button, Badge, Dialog) | current | All needed UI primitives already present in `src/components/ui/` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Rust async URI scheme proxy | leaflet.offline (IndexedDB) | Prohibited by D-12 and confirmed by CSP: browser can't reach external tile hosts |
| Manual same-location grouping | react-leaflet-cluster | Cluster library v4.x requires React 19; v3.x supports react-leaflet ^4 not v5; manual grouping is simpler and sufficient for personal collection scale |
| `data:` base64 tiles | Blob URLs (`URL.createObjectURL`) | Blob URLs work but `data:` URIs are self-contained (no lifetime management needed); both are in CSP |

**Installation:**
```bash
npm install leaflet react-leaflet @types/leaflet
```

**Cargo.toml addition:**
```toml
reqwest = { version = "0.13", features = ["rustls-tls"] }
```

**Version verification:** Verified 2026-04-09 via `npm view` commands.

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── tabs/
│   └── MapTab.tsx                    # replaces EmptyState; owns MapContainer + finds pins
├── components/map/
│   ├── FindsMap.tsx                  # MapContainer wrapper; handles fitBounds logic
│   ├── FindPins.tsx                  # renders grouped pins + cluster badges
│   ├── FindPopup.tsx                 # two-level popup (Level 1 + Level 2 expansion)
│   ├── LayerSwitcher.tsx             # LayersControl with OSM + Esri basemaps
│   ├── OnlineStatusBadge.tsx         # green/grey dot overlay
│   ├── LocationPickerModal.tsx       # full-screen Dialog containing MapContainer
│   └── TileLayer.tsx                 # custom GridLayer that routes through Rust proxy
src-tauri/src/commands/
└── tile_proxy.rs                     # fetch_tile command; HTTP fetch + disk cache + LRU
src-tauri/src/
└── tile_cache_db.rs                  # SQLite metadata table helpers for LRU eviction
```

### Pattern 1: react-leaflet MapContainer Setup

**What:** Initialize Leaflet map with correct container styling and CSS import.
**When to use:** Always — MapContainer must have an explicit height or Leaflet renders invisible.

```typescript
// Import in main.tsx (global, once)
import 'leaflet/dist/leaflet.css';

// Fix broken default marker icons (Vite bundler path issue) — add in any file that
// imports leaflet before MapContainer renders:
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });
```

```typescript
// Source: react-leaflet.js.org/docs/api-map/ [CITED]
<MapContainer
  center={[45.1, 15.2]}
  zoom={7}
  style={{ height: '100%', width: '100%' }}
  className="rounded-md"
>
  {/* children */}
</MapContainer>
```

**CRITICAL:** MapContainer props are immutable after first render. Use the `useMap()` hook inside a child component to imperatively call `map.fitBounds()` when finds load.

### Pattern 2: Custom TileLayer via Rust Proxy

**What:** Replace Leaflet's default HTTP tile fetch with a `GridLayer.createTile()` override that calls the Rust `fetch_tile` command and returns a `data:` URI.
**When to use:** All tile rendering — both OSM and Esri layers must go through the proxy.

```typescript
// Source: leafletjs.com/examples/extending/extending-2-layers.html [CITED] +
//         Tauri IPC pattern [ASSUMED for exact Tauri invoke inside GridLayer]
import L from 'leaflet';
import { invoke } from '@tauri-apps/api/core';

const RustProxyLayer = L.GridLayer.extend({
  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const img = document.createElement('img');
    img.setAttribute('role', 'presentation');
    const tileUrl = (this as any).getTileUrl(coords);
    invoke<string>('fetch_tile', {
      url: tileUrl,
      storagePath: (this as any).options.storagePath,
    })
      .then((dataUri) => {
        img.src = dataUri;
        done(undefined, img);
      })
      .catch((err) => done(new Error(String(err)), img));
    return img;
  },
});

// Wrap in a React component using createElementObject from @react-leaflet/core
// or simply use a useEffect + map.addLayer pattern inside a MapContainer child.
```

**Rust side** (`commands/tile_proxy.rs`):
```rust
// Source: [ASSUMED] — pattern derived from Tauri command + reqwest docs
#[tauri::command]
pub async fn fetch_tile(url: String, storage_path: String) -> Result<String, String> {
    // 1. Derive cache key from URL (e.g., hex hash of url)
    // 2. Check <storage_path>/tile-cache/<hash>.png exists
    // 3a. Cache hit: read file, base64-encode, return "data:image/png;base64,..."
    // 3b. Cache miss: reqwest GET url, write bytes to disk, update SQLite metadata,
    //     trigger LRU eviction if over limit, return data URI
}
```

### Pattern 3: LayersControl with Two Basemaps

```typescript
// Source: react-leaflet.js.org/docs/api-components/ [CITED]
import { LayersControl, TileLayer } from 'react-leaflet';

const OSM_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ESRI_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

<LayersControl position="topright">
  <LayersControl.BaseLayer checked name="Street (OSM)">
    <TileLayer url={OSM_URL} attribution="© OpenStreetMap contributors" />
  </LayersControl.BaseLayer>
  <LayersControl.BaseLayer name="Satellite (Esri)">
    <TileLayer url={ESRI_URL} attribution="Tiles © Esri" />
  </LayersControl.BaseLayer>
</LayersControl>
```

**Note:** With the Rust proxy, these TileLayer components must be replaced by custom GridLayer components (RustProxyLayer above). The LayersControl wrapper is still used; the child changes from `<TileLayer>` to a custom `<RustProxyLayer>` React wrapper.

### Pattern 4: fitBounds on First Load

```typescript
// Source: react-leaflet.js.org/docs/api-map/ [CITED] — useMap hook
import { useMap } from 'react-leaflet';
import { useEffect } from 'react';
import type { Find } from '@/lib/finds';

function FitBoundsControl({ finds }: { finds: Find[] }) {
  const map = useMap();
  useEffect(() => {
    const withCoords = finds.filter(f => f.lat !== null && f.lng !== null);
    if (withCoords.length === 0) return;
    // Only auto-fit if any find is outside Croatia bounding box
    const CROATIA_BOUNDS: L.LatLngBoundsLiteral = [[42.3, 13.5], [46.6, 19.5]];
    const outsideCroatia = withCoords.some(f =>
      f.lat! < 42.3 || f.lat! > 46.6 || f.lng! < 13.5 || f.lng! > 19.5
    );
    if (outsideCroatia) {
      const bounds = withCoords.map(f => [f.lat!, f.lng!] as [number, number]);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [finds, map]);
  return null;
}
```

### Pattern 5: Same-Location Grouping (Manual Cluster)

Instead of `react-leaflet-cluster`, group finds by coordinate key before rendering:

```typescript
// [ASSUMED] — standard JS grouping pattern, no library
function groupByCoords(finds: Find[]): Map<string, Find[]> {
  const groups = new Map<string, Find[]>();
  finds
    .filter(f => f.lat !== null && f.lng !== null)
    .forEach(f => {
      const key = `${f.lat!.toFixed(6)},${f.lng!.toFixed(6)}`;
      const group = groups.get(key) ?? [];
      group.push(f);
      groups.set(key, group);
    });
  return groups;
}
```

Each group with count > 1 renders a single Marker with a custom DivIcon showing the count badge. Clicking it opens a Popup with the scrollable list.

### Pattern 6: Location Picker Modal

```typescript
// [ASSUMED] — Dialog + MapContainer combination
// Key constraint: Dialog must be fully mounted before MapContainer renders,
// and MapContainer needs an explicit size or it renders invisible.
// Use a state flag to mount MapContainer only when dialog is open.

function LocationPickerModal({
  open,
  initialCoords,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  initialCoords: [number, number] | null;
  onConfirm: (lat: number, lng: number) => void;
  onCancel: () => void;
}) {
  const [pin, setPin] = useState<[number, number] | null>(initialCoords);
  // ...
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        {open && ( // mount MapContainer only when open
          <MapContainer style={{ flex: 1 }} ...>
            {/* click handler component sets pin state */}
            {/* draggable Marker at pin position */}
          </MapContainer>
        )}
        <Button onClick={() => pin && onConfirm(pin[0], pin[1])} disabled={!pin}>
          Confirm location
        </Button>
      </DialogContent>
    </Dialog>
  );
}
```

### Pattern 7: LRU Tile Cache Metadata (SQLite)

**Decision (Claude's discretion):** Use a SQLite metadata table — lighter than filesystem timestamps because it supports atomic size accounting.

```sql
-- Migration 0003_tile_cache.sql
CREATE TABLE IF NOT EXISTS tile_cache_meta (
    tile_key TEXT PRIMARY KEY,     -- e.g., sha256(url) or sanitized URL path
    file_path TEXT NOT NULL,       -- absolute path on disk
    size_bytes INTEGER NOT NULL,
    last_accessed TEXT NOT NULL    -- ISO datetime, updated on each cache hit
);
CREATE INDEX IF NOT EXISTS idx_tile_cache_accessed ON tile_cache_meta(last_accessed);
```

LRU eviction: `SELECT tile_key, file_path, size_bytes FROM tile_cache_meta ORDER BY last_accessed ASC LIMIT ?` until total bytes freed reaches the excess.

### Anti-Patterns to Avoid

- **Mounting MapContainer with zero height:** Leaflet renders invisible. Always set explicit height via `style={{ height: '...' }}` or a flex container that fills remaining space.
- **Mutating MapContainer props after first render:** Props are immutable. Use `useMap()` hook in a child component to call `map.setView()`, `map.fitBounds()`, etc.
- **Fetching tiles directly from browser:** The current CSP does not whitelist `tile.openstreetmap.org` or `server.arcgisonline.com` in `connect-src`. Tile fetch from JS will fail. All tile requests must go through the Rust proxy.
- **Using leaflet.offline (IndexedDB):** Prohibited by D-12 and confirmed unreliable with Tauri WebView2. Do not introduce this library.
- **Two MapContainer instances rendering simultaneously without isolation:** The picker modal's MapContainer must only mount when the dialog is `open=true`, otherwise Leaflet may conflict with the main map's container initialization.
- **Forgetting to import leaflet CSS globally:** Without `import 'leaflet/dist/leaflet.css'` in `main.tsx`, no tiles, controls, or popups render correctly.
- **Default marker icon broken in Vite:** Vite rewrites asset URLs in CSS, breaking Leaflet's internal icon path detection. Must call `L.Icon.Default.mergeOptions(...)` with explicit imports.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Map rendering | Custom canvas/SVG map | Leaflet + react-leaflet | 1.9.x is battle-tested; handles tile loading, zoom, pan, projection math |
| Geographic bounding / `fitBounds` | Manual lat/lng range calculation | `map.fitBounds()` via `useMap()` | Handles projection, padding, animation correctly |
| Marker popup rendering | Custom absolute-positioned divs | `<Popup>` from react-leaflet | Handles positioning relative to map viewport, z-index, overflow correctly |
| Layer switching UI | Custom radio buttons for basemap toggle | `<LayersControl>` from react-leaflet | Built-in widget with keyboard nav and proper Leaflet integration |
| Custom icon / DivIcon | Plain DOM manipulation | `L.divIcon({ html: '...', className: '' })` | Leaflet manages icon lifecycle and positioning |
| Tile URL template parsing | Regex or manual {z}/{x}/{y} replacement | `L.TileLayer.getTileUrl(coords)` | Already correct; subclass and call `super.getTileUrl(coords)` |

---

## Common Pitfalls

### Pitfall 1: Leaflet CSS / Icon Not Loaded
**What goes wrong:** Map renders as grey box or tiles appear without controls / markers show as broken-image boxes.
**Why it happens:** `leaflet/dist/leaflet.css` not imported globally; Vite rewrites CSS asset paths breaking Leaflet's `_getIconUrl` detection.
**How to avoid:** Add `import 'leaflet/dist/leaflet.css'` to `main.tsx` (before any component import). Fix icons with `L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl })` after explicit imports.
**Warning signs:** Grey map tiles area; missing zoom controls; broken marker images.

### Pitfall 2: MapContainer Invisible Due to Zero Height
**What goes wrong:** MapContainer renders but is 0px tall — no visible map.
**Why it happens:** Leaflet needs an explicit container height. If parent has no height and MapContainer has no `style={{ height: '...' }}`, container collapses to 0.
**How to avoid:** Set `style={{ height: '100%' }}` on MapContainer and ensure the parent container has a defined height (e.g., flex-1, h-full, or explicit px value).
**Warning signs:** Component renders without errors but map is invisible.

### Pitfall 3: Tiles Failing Due to CSP Violation
**What goes wrong:** Tiles never load; browser console shows CSP violation for `tile.openstreetmap.org` or `server.arcgisonline.com`.
**Why it happens:** Current `tauri.conf.json` CSP (`connect-src` only allows `ipc:` and `http://ipc.localhost`). External tile hosts are not whitelisted.
**How to avoid:** NEVER use `<TileLayer url="https://tile.openstreetmap.org/...">` directly. Use RustProxyLayer (custom GridLayer that calls `invoke('fetch_tile', ...)`) returning `data:` URIs, which are allowed in `img-src`.
**Warning signs:** Tiles show as grey squares; DevTools network tab shows blocked requests.

### Pitfall 4: Two MapContainer Instances Conflicting
**What goes wrong:** LocationPickerModal opens and React/Leaflet throws "Map container is already initialized" or map renders in wrong container.
**Why it happens:** If LocationPickerModal's MapContainer is pre-rendered (even hidden), Leaflet may bind to a DOM node that conflicts with the main MapTab's MapContainer.
**How to avoid:** Conditionally mount picker's MapContainer: `{open && <MapContainer ...>}`. This ensures it only mounts when the dialog is visible.
**Warning signs:** Console error "Map container is already initialized"; main map disappears when picker opens.

### Pitfall 5: Leaflet Tests Failing in jsdom
**What goes wrong:** Vitest tests throw `ResizeObserver is not defined` or `window.URL.createObjectURL is not a function` when importing react-leaflet.
**Why it happens:** jsdom does not implement ResizeObserver, canvas, or some WebAPIs that Leaflet expects.
**How to avoid:** Add ResizeObserver stub to `src/test/setup.ts`:
```typescript
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
```
For components that render a MapContainer, use `vi.mock('react-leaflet', ...)` to replace MapContainer with a simple div wrapper. Test business logic (grouping, popup state) without rendering the full map.
**Warning signs:** Test suite fails with `ResizeObserver is not defined` on import.

### Pitfall 6: reqwest TLS on Windows
**What goes wrong:** `reqwest` fails to compile or panics at runtime on Windows due to OpenSSL not being available.
**Why it happens:** Default reqwest uses native-tls which requires OpenSSL on non-Windows; on Windows it typically works, but the safest approach is `rustls-tls`.
**How to avoid:** Use `reqwest = { version = "0.13", features = ["rustls-tls"], default-features = false }`.
**Warning signs:** Cargo build fails with "unable to find openssl" or similar linking errors.

### Pitfall 7: Tile Cache Migration Key Regression
**What goes wrong:** Tile cache SQLite metadata table not created because migration key mismatch.
**Why it happens:** The migration key MUST remain `"sqlite:bili-mushroom.db"` (established in Phase 1, comment in `lib.rs`). If tile_cache_meta migration uses a different database or migration key, it won't apply.
**How to avoid:** Add tile_cache_meta migration as `Migration { version: 3, ... }` with `sql: include_str!("../migrations/0003_tile_cache.sql")` in the same `migrations` vec in `lib.rs`. The tile proxy Rust code opens the DB at `<storage_path>/bili-mushroom.db` via rusqlite (same pattern as `import.rs`).

---

## Code Examples

### Installing react-leaflet packages (Wave 0)
```bash
npm install leaflet react-leaflet @types/leaflet
```

### Cargo.toml additions (Wave 0)
```toml
reqwest = { version = "0.13", features = ["rustls-tls"], default-features = false }
```

### Global CSS import (`src/main.tsx`)
```typescript
// Source: react-leaflet.js.org/docs/start-installation/ [CITED]
import 'leaflet/dist/leaflet.css';
```

### Leaflet icon fix (one-time setup)
```typescript
// Source: github.com/PaulLeCam/react-leaflet/issues (community fix) [CITED: community, cross-verified across multiple sources]
import L from 'leaflet';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });
```

### Custom DivIcon for cluster badge
```typescript
// Source: leafletjs.com/reference.html — L.divIcon [CITED]
import L from 'leaflet';

function makeClusterIcon(count: number): L.DivIcon {
  return L.divIcon({
    html: `<span class="cluster-badge">${count}</span>`,
    className: '',  // clear default leaflet-div-icon class
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}
```

### useMapEvents for location picker click
```typescript
// Source: react-leaflet.js.org/docs/api-map/ [CITED]
import { useMapEvents } from 'react-leaflet';

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}
```

### Rust fetch_tile skeleton
```rust
// Source: [ASSUMED] — reqwest + rusqlite pattern, consistent with existing import.rs
use reqwest::Client;
use rusqlite::{Connection, params};
use base64::{engine::general_purpose::STANDARD, Engine};

#[tauri::command]
pub async fn fetch_tile(url: String, storage_path: String) -> Result<String, String> {
    let cache_dir = format!("{}/tile-cache", storage_path);
    std::fs::create_dir_all(&cache_dir).map_err(|e| e.to_string())?;

    let tile_key = hash_url(&url);  // e.g., sha256 hex
    let file_path = format!("{}/{}.png", cache_dir, tile_key);

    // Cache hit
    if let Ok(bytes) = std::fs::read(&file_path) {
        update_last_accessed(&storage_path, &tile_key)?;
        let b64 = STANDARD.encode(&bytes);
        return Ok(format!("data:image/png;base64,{}", b64));
    }

    // Cache miss: fetch
    let client = Client::new();
    let resp = client.get(&url)
        .header("User-Agent", "BiliMushroom/0.1")
        .send()
        .await.map_err(|e| e.to_string())?;
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(&file_path, &bytes).map_err(|e| e.to_string())?;

    insert_cache_meta(&storage_path, &tile_key, &file_path, bytes.len() as i64)?;
    evict_if_over_limit(&storage_path, 200 * 1024 * 1024)?;  // 200 MB default

    let b64 = STANDARD.encode(&bytes);
    Ok(format!("data:image/png;base64,{}", b64))
}
```

Note: `base64` crate (`base64 = "0.22"`) must be added to `Cargo.toml`. Alternatively, use `STANDARD.encode` from the `base64` crate.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| leaflet.offline (IndexedDB) for Tauri | Rust tile proxy + `register_asynchronous_uri_scheme_protocol` or invoke-based | Tauri 2.0 stable (Oct 2024) | WebView2 ServiceWorker limitations make IndexedDB unreliable; Rust IPC is the correct approach |
| `react-leaflet-cluster` v2 (React 16/17) | Manual coordinate grouping OR react-leaflet-cluster v3.1.1 + legacy-peer-deps | 2023–2025 | Cluster library peer dep matrix fragmented; manual grouping is safer at personal-collection scale |
| Direct `getTileUrl` override for custom tiles | `L.GridLayer.createTile()` override | Leaflet 1.7+ | `createTile` is the correct async extensibility point; `getTileUrl` override alone doesn't intercept fetch |

**Deprecated/outdated:**
- `leaflet.offline`: Explicitly prohibited in this project (D-12). IndexedDB unreliable in Tauri WebView2.
- `react-leaflet-markercluster` (yuzhva): Last stable release targets react-leaflet v2/v3; v5 incompatible. Do not use.
- `L.TileLayer` as base for custom tile proxy: Use `L.GridLayer.extend({ createTile })` instead for async tile creation.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Rust `invoke('fetch_tile', ...)` inside `L.GridLayer.createTile()` will work correctly in Tauri WebView2 without additional IPC configuration | Code Examples, Pattern 2 | If invoke is not accessible in a GridLayer callback, tiles never load; mitigation: test in Wave 1 with a single tile layer before full integration |
| A2 | `base64` crate encodes PNG bytes correctly for `data:image/png;base64,...` format that Leaflet `<img src>` accepts | Code Examples (Rust fetch_tile) | Wrong MIME type or encoding would produce broken tiles; risk LOW as this is a well-established pattern |
| A3 | react-leaflet-cluster v3.1.1 (--legacy-peer-deps) works at runtime with react-leaflet v5 despite peer dep listing react-leaflet ^4.0.0 | Standard Stack (alternatives) | If runtime incompatible, switch to manual grouping; recommendation is to use manual grouping which has no risk |
| A4 | Two `<MapContainer>` instances (main map + picker modal) do not conflict when picker is conditionally mounted | Pattern 6 / Pitfall 4 | Verified by community reports that conditional mounting resolves "container already initialized" — LOW risk if mount condition strictly enforced |
| A5 | reqwest `rustls-tls` feature compiles on Windows without additional system dependencies | Standard Stack (Rust) | If compilation fails, try `native-tls` feature — Windows natively has schannel support |

---

## Open Questions (RESOLVED)

1. **Tile content-type detection (PNG vs JPEG)** — RESOLVED: Read `Content-Type` header from the HTTP response and use it in the data URI. Default to `image/png` if absent. Implemented in `tile_proxy.rs` via `ext_from_mime()` helper (Plan 01, Task 2).

2. **Cache size display in Settings** — RESOLVED: One-time read on dialog open via `invoke('get_tile_cache_stats', { storagePath })`. No reactive/polling query needed. Implemented in `SettingsDialog.tsx` via `useEffect` on `open` (Plan 04, Task 3).

3. **Tile proxy invocation approach: IPC invoke vs URI scheme protocol** — RESOLVED: IPC invoke-based `L.GridLayer` subclass (`RustProxyTileLayer`). `createTile` calls `invoke('fetch_tile', { url, storagePath })` and sets `img.src` to the returned data URI. This follows the established project IPC pattern and is testable via the existing `invokeHandlers` mock in `tauri-mocks.ts`. Implemented in Plan 02, Task 2.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install, Vitest | Yes | v22.15.0 [VERIFIED: node --version] | — |
| Cargo/Rust | fetch_tile command compilation | Yes | cargo 1.94.1 [VERIFIED: ~/.cargo/bin/cargo] | — |
| Vitest | test suite | Yes | detected in package.json + vite.config.ts test block [VERIFIED: codebase] | — |
| leaflet (npm) | MapContainer, tiles | Not yet installed | — | Run `npm install leaflet react-leaflet @types/leaflet` in Wave 0 |
| react-leaflet (npm) | MapContainer, hooks | Not yet installed | — | Same install |
| reqwest (Cargo) | tile HTTP fetch | Not in Cargo.toml | — | Add to Cargo.toml in Wave 0 |
| base64 (Cargo) | encode tile bytes | Not in Cargo.toml | — | Add to Cargo.toml in Wave 0 |

**Missing dependencies with no fallback:**
- leaflet, react-leaflet, @types/leaflet — must be installed before any frontend map work.
- reqwest, base64 crates — must be added to Cargo.toml before tile proxy Rust work.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.x (detected in package.json, vite.config.ts `test` block) |
| Config file | `vite.config.ts` (test block) + `src/test/setup.ts` |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --reporter=verbose` |

Current baseline: 97 tests passing, 1 skipped (verified 2026-04-09).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MAP-01 | Finds with lat/lng appear as markers | unit | `npx vitest run src/components/map/` | No — Wave 0 |
| MAP-02 | Layer switcher renders two basemap options | unit | `npx vitest run src/components/map/LayerSwitcher.test.tsx` | No — Wave 0 |
| MAP-03 | Tile proxy: cache hit returns data URI without network call | unit (Rust) | `cargo test -p bili-mushroom-lib tile_proxy` | No — Wave 0 |
| MAP-03 | Tile proxy: cache miss writes file and returns data URI | unit (Rust) | `cargo test -p bili-mushroom-lib tile_proxy` | No — Wave 0 |
| MAP-03 | LRU eviction triggers when cache exceeds 200 MB | unit (Rust) | `cargo test -p bili-mushroom-lib tile_cache_db` | No — Wave 0 |
| MAP-04 | FindPopup shows species name + date at Level 1 | unit | `npx vitest run src/components/map/FindPopup.test.tsx` | No — Wave 0 |
| MAP-04 | FindPopup expands to mini card at Level 2 on name click | unit | same file | No — Wave 0 |
| MAP-05 | MapContainer mounts with Croatia center [45.1, 15.2] zoom 7 | smoke | `npx vitest run src/tabs/MapTab.test.tsx` | No — Wave 0 |
| MAP-05 | fitBounds called when finds outside Croatia bbox | unit | `npx vitest run src/components/map/FitBoundsControl.test.tsx` | No — Wave 0 |
| MAP-06 | LocationPickerModal mounts when "Pick on map" clicked | unit | `npx vitest run src/components/map/LocationPickerModal.test.tsx` | No — Wave 0 |
| MAP-06 | Confirming pin calls onLocationPicked with lat/lng | unit | same file | No — Wave 0 |

**Note:** React-leaflet MapContainer tests require a ResizeObserver stub in `src/test/setup.ts` (not currently present — Wave 0 gap) and `vi.mock('react-leaflet', ...)` or a wrapper that replaces MapContainer with a div. Rust tile proxy tests use `tempfile` (already in dev-dependencies) and an in-memory SQLite DB.

### Sampling Rate
- **Per task commit:** `npx vitest run`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full Vitest suite green + `cargo test` green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/test/setup.ts` — add `ResizeObserver` stub (required before any react-leaflet test)
- [ ] `src/components/map/` directory — create; all map component test files go here
- [ ] `src-tauri/src/commands/tile_proxy.rs` — new Rust command file (Wave 0 scaffold)
- [ ] `src-tauri/src/commands/tile_cache_db.rs` — LRU metadata helpers
- [ ] `src-tauri/migrations/0003_tile_cache.sql` — tile_cache_meta table
- [ ] Packages: `npm install leaflet react-leaflet @types/leaflet`
- [ ] Cargo.toml: add `reqwest` (rustls-tls) + `base64 = "0.22"`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No auth in v1 local app |
| V3 Session Management | No | No sessions |
| V4 Access Control | No | Single-user local app |
| V5 Input Validation | Yes | Tile URL: only allow http/https scheme; reject any URL that doesn't start with known tile host prefixes before Rust fetches it |
| V6 Cryptography | No | No sensitive data in tile cache |

### Known Threat Patterns for Tile Proxy

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SSRF via tile URL injection | Spoofing / Tampering | Rust `fetch_tile` command must validate `url` starts with allowed prefixes (`https://tile.openstreetmap.org/`, `https://server.arcgisonline.com/`) before fetching. Reject all others with an error. |
| Path traversal in tile cache key | Tampering | Tile key derived from URL hash (not URL path directly); file written to `<storage_path>/tile-cache/<hash>.png` — no user-controlled path components |
| Unbounded disk usage | Denial of Service | LRU eviction at 200 MB cap enforced in `evict_if_over_limit` |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: npm registry] — leaflet 1.9.4, react-leaflet 5.0.0, @types/leaflet 1.9.21, react-leaflet-cluster 4.1.3, leaflet.markercluster 1.5.3 (via `npm view`)
- [VERIFIED: cargo search] — reqwest 0.13.2, tauri 2.10.3 (via `cargo search`)
- [VERIFIED: codebase] — `src-tauri/tauri.conf.json` CSP, `package.json`, `src/test/tauri-mocks.ts`, `src-tauri/src/lib.rs`, `src/components/finds/EditFindDialog.tsx`, `src/hooks/useFinds.ts`, `src/components/ui/` list
- [CITED: react-leaflet.js.org/docs/start-installation/] — installation requirements, CSS import
- [CITED: react-leaflet.js.org/docs/api-map/] — MapContainer props, useMap, useMapEvents
- [CITED: react-leaflet.js.org/docs/api-components/] — TileLayer, LayersControl, Marker, Popup
- [CITED: leafletjs.com/examples/extending/extending-2-layers.html] — GridLayer.createTile pattern
- [CITED: leafletjs.com/reference.html] — L.divIcon API

### Secondary (MEDIUM confidence)
- [CITED: v2.tauri.app/develop/calling-rust/] — tauri::ipc::Response for binary return, async command pattern
- [CITED: github.com/akursat/react-leaflet-cluster] — compatibility matrix (React 19 peer dep requirement confirmed)
- [CITED: github.com/akursat/react-leaflet-cluster — v3.1.1 release] — React 18 compatible version confirmed via `npm view react-leaflet-cluster@3.1.1 peerDependencies`
- Multiple community sources on Leaflet default icon fix in Vite (cross-verified)

### Tertiary (LOW confidence)
- Rust `fetch_tile` command implementation skeleton — [ASSUMED] based on existing `import.rs` patterns + reqwest docs; must be verified in Wave 1 implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack (packages, versions): HIGH — all versions verified via npm/cargo
- Architecture (tile proxy pattern): HIGH — confirmed by CSP analysis + established Tauri IPC patterns
- Cluster library compatibility: MEDIUM — react-leaflet-cluster peer dep issue confirmed; manual grouping recommendation is HIGH confidence
- Pitfalls: HIGH — Leaflet CSS/icon and MapContainer height issues are well-documented; CSP tile blocking confirmed by direct config read
- Rust tile proxy code: MEDIUM — pattern is sound but exact implementation needs Wave 1 build validation

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (leaflet/react-leaflet versions stable; reqwest version stable; tauri version stable)
