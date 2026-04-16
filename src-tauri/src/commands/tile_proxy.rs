use crate::commands::tile_cache_db;
use base64::{engine::general_purpose::STANDARD, Engine};
use rusqlite::Connection;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use tauri::{Manager, Runtime};

const ALLOWED_PREFIXES: &[&str] = &[
    "https://tile.openstreetmap.org/",
    "https://a.tile.openstreetmap.org/",
    "https://b.tile.openstreetmap.org/",
    "https://c.tile.openstreetmap.org/",
    "https://server.arcgisonline.com/",
    "https://tile.opentopomap.org/",
    "https://a.tile.opentopomap.org/",
    "https://b.tile.opentopomap.org/",
    "https://c.tile.opentopomap.org/",
];

const DEFAULT_MAX_BYTES: i64 = 200 * 1024 * 1024;

#[derive(Serialize)]
pub struct TileCacheStats {
    pub size_bytes: i64,
    pub tile_count: i64,
}

fn validate_url(url: &str) -> Result<(), String> {
    if ALLOWED_PREFIXES.iter().any(|p| url.starts_with(p)) {
        Ok(())
    } else {
        Err(format!("invalid tile url: {}", url))
    }
}

fn hash_url(url: &str) -> String {
    let mut h = Sha256::new();
    h.update(url.as_bytes());
    let out = h.finalize();
    hex_lower(&out)[..32].to_string()
}

fn hex_lower(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn open_conn(storage_path: &str) -> Result<Connection, String> {
    crate::commands::import::open_db(storage_path).map_err(|e| e.to_string())
}

fn cache_base_dir<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    if let Some(override_dir) = std::env::var_os("BILI_APP_CACHE_DIR") {
        return Ok(PathBuf::from(override_dir));
    }
    app.path().app_cache_dir().map_err(|e| e.to_string())
}

fn cache_metadata_dir<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    cache_base_dir(app).map(|path| path.join("metadata"))
}

fn cache_dir<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    cache_base_dir(app).map(|path| path.join("tiles"))
}

fn legacy_cache_dirs(storage_path: &str) -> Vec<PathBuf> {
    vec![
        PathBuf::from(storage_path).join("tile-cache"),
        PathBuf::from(storage_path).join(".bili-cache").join("tiles"),
    ]
}

fn mime_from_ext(ext: &str) -> &'static str {
    match ext {
        "jpg" | "jpeg" => "image/jpeg",
        _ => "image/png",
    }
}

fn ext_from_mime(mime: &str) -> &'static str {
    if mime.contains("jpeg") || mime.contains("jpg") { "jpg" } else { "png" }
}

fn encode_data_uri(bytes: &[u8], mime: &str) -> String {
    let b64 = STANDARD.encode(bytes);
    format!("data:{};base64,{}", mime, b64)
}

fn try_cache_hit(conn: &Connection, tile_key: &str) -> Result<Option<String>, String> {
    let row: Option<String> = conn
        .query_row(
            "SELECT file_path FROM tile_cache_meta WHERE tile_key = ?1",
            rusqlite::params![tile_key],
            |r| r.get(0),
        )
        .ok();
    let Some(file_path) = row else { return Ok(None); };
    let bytes = match std::fs::read(&file_path) {
        Ok(b) => b,
        Err(_) => return Ok(None),
    };
    let ext = std::path::Path::new(&file_path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("png");
    let _ = tile_cache_db::update_last_accessed(conn, tile_key);
    Ok(Some(encode_data_uri(&bytes, mime_from_ext(ext))))
}

#[tauri::command]
pub async fn fetch_tile(
    app: tauri::AppHandle,
    url: String,
) -> Result<String, String> {
    fetch_tile_inner(&app, url).await
}

async fn fetch_tile_inner<R: Runtime>(
    app: &tauri::AppHandle<R>,
    url: String,
) -> Result<String, String> {
    validate_url(&url)?;
    let dir = cache_dir(app)?;
    let metadata_dir = cache_metadata_dir(app)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&metadata_dir).map_err(|e| e.to_string())?;
    let tile_key = hash_url(&url);

    {
        let conn = open_conn(&metadata_dir.to_string_lossy())?;
        if let Some(uri) = try_cache_hit(&conn, &tile_key)? {
            return Ok(uri);
        }
    }

    let client = reqwest::Client::builder()
        .user_agent("BiliMushroom/0.1")
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("tile fetch failed: HTTP {}", resp.status()));
    }
    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/png")
        .to_string();
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?.to_vec();

    let ext = ext_from_mime(&content_type);
    let file_path = dir.join(format!("{}.{}", tile_key, ext));
    std::fs::write(&file_path, &bytes).map_err(|e| e.to_string())?;

    {
        let conn = open_conn(&metadata_dir.to_string_lossy())?;
        tile_cache_db::insert_tile_meta(
            &conn,
            &tile_key,
            file_path.to_str().unwrap_or(""),
            bytes.len() as i64,
        )
        .map_err(|e| e.to_string())?;
        tile_cache_db::evict_if_over_limit(&conn, DEFAULT_MAX_BYTES).map_err(|e| e.to_string())?;
    }

    Ok(encode_data_uri(&bytes, &content_type))
}

#[tauri::command]
pub fn get_tile_cache_stats(app: tauri::AppHandle) -> Result<TileCacheStats, String> {
    get_tile_cache_stats_inner(&app)
}

fn get_tile_cache_stats_inner<R: Runtime>(app: &tauri::AppHandle<R>) -> Result<TileCacheStats, String> {
    let _dir = cache_dir(app)?;
    let metadata_dir = cache_metadata_dir(app)?;
    std::fs::create_dir_all(&metadata_dir).map_err(|e| e.to_string())?;
    let conn = open_conn(&metadata_dir.to_string_lossy())?;
    let size_bytes = tile_cache_db::total_cache_size(&conn).map_err(|e| e.to_string())?;
    let tile_count = tile_cache_db::tile_count(&conn).map_err(|e| e.to_string())?;
    Ok(TileCacheStats { size_bytes, tile_count })
}

#[tauri::command]
pub fn clear_tile_cache(app: tauri::AppHandle, storage_path: Option<String>) -> Result<(), String> {
    clear_tile_cache_inner(&app, storage_path)
}

fn clear_tile_cache_inner<R: Runtime>(
    app: &tauri::AppHandle<R>,
    storage_path: Option<String>,
) -> Result<(), String> {
    let dir = cache_dir(app)?;
    let metadata_dir = cache_metadata_dir(app)?;
    std::fs::create_dir_all(&metadata_dir).map_err(|e| e.to_string())?;
    let mut legacy_dirs = vec![];
    if let Some(storage_path) = storage_path {
        legacy_dirs.extend(legacy_cache_dirs(&storage_path));
    }

    let conn = open_conn(&metadata_dir.to_string_lossy())?;
    tile_cache_db::clear_all(&conn, &dir).map_err(|e| e.to_string())?;
    for legacy_dir in legacy_dirs {
        if legacy_dir.exists() {
            let _ = std::fs::remove_dir_all(&legacy_dir);
        }
    }
    Ok(())
}

#[tauri::command]
pub fn set_cache_max(app: tauri::AppHandle, max_bytes: i64) -> Result<(), String> {
    let metadata_dir = cache_metadata_dir(&app)?;
    std::fs::create_dir_all(&metadata_dir).map_err(|e| e.to_string())?;
    let conn = open_conn(&metadata_dir.to_string_lossy())?;
    conn.execute(
        "INSERT OR REPLACE INTO tile_cache_settings (key, value) VALUES ('max_bytes', ?1)",
        rusqlite::params![max_bytes.to_string()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_cache_max_bytes(app: tauri::AppHandle) -> Result<i64, String> {
    let metadata_dir = cache_metadata_dir(&app)?;
    std::fs::create_dir_all(&metadata_dir).map_err(|e| e.to_string())?;
    let conn = open_conn(&metadata_dir.to_string_lossy())?;
    let val: Option<String> = conn
        .query_row(
            "SELECT value FROM tile_cache_settings WHERE key = 'max_bytes'",
            [],
            |r| r.get(0),
        )
        .ok();
    match val {
        Some(v) => v.parse::<i64>().map_err(|e| e.to_string()),
        None => Ok(DEFAULT_MAX_BYTES),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    const TILE_CACHE_SQL: &str = "
        CREATE TABLE IF NOT EXISTS tile_cache_meta (
            tile_key TEXT PRIMARY KEY,
            file_path TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            last_accessed TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tile_cache_accessed ON tile_cache_meta(last_accessed);
        CREATE TABLE IF NOT EXISTS tile_cache_settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        PRAGMA user_version = 6;
    ";

    fn seed_cache_db(metadata_dir: &std::path::Path) -> rusqlite::Connection {
        std::fs::create_dir_all(metadata_dir).unwrap();
        let db_path = metadata_dir.join("bili-mushroom.db");
        let conn = rusqlite::Connection::open(db_path).unwrap();
        conn.execute_batch(TILE_CACHE_SQL).unwrap();
        conn
    }

    fn cache_env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    #[test]
    fn rejects_non_allowlisted_url() {
        assert!(validate_url("https://evil.example.com/tile.png").is_err());
        assert!(validate_url("http://tile.openstreetmap.org/1/2/3.png").is_err());
        assert!(validate_url("file:///etc/passwd").is_err());
    }

    #[test]
    fn accepts_allowlisted_osm_and_esri() {
        assert!(validate_url("https://tile.openstreetmap.org/1/2/3.png").is_ok());
        assert!(validate_url("https://a.tile.openstreetmap.org/1/2/3.png").is_ok());
        assert!(validate_url("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/1/2/3").is_ok());
    }

    #[test]
    fn accepts_allowlisted_opentopomap() {
        assert!(validate_url("https://tile.opentopomap.org/10/550/335.png").is_ok());
        assert!(validate_url("https://a.tile.opentopomap.org/10/550/335.png").is_ok());
        assert!(validate_url("https://b.tile.opentopomap.org/10/550/335.png").is_ok());
        assert!(validate_url("https://c.tile.opentopomap.org/10/550/335.png").is_ok());
    }

    #[tokio::test]
    async fn cache_hit_returns_data_uri_without_network() {
        let _guard = cache_env_lock().lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        std::env::set_var("HOME", dir.path());
        std::env::set_var("BILI_APP_CACHE_DIR", dir.path().join("app-cache"));
        let app = tauri::test::mock_app();
        let handle = app.handle().clone();
        let metadata_dir = cache_metadata_dir(&handle).unwrap();
        let _ = std::fs::remove_dir_all(&metadata_dir);
        let conn = seed_cache_db(&metadata_dir);
        let tile_dir = cache_dir(&handle).unwrap();
        let _ = std::fs::remove_dir_all(&tile_dir);
        std::fs::create_dir_all(&tile_dir).unwrap();
        let url = "https://tile.openstreetmap.org/1/2/3.png";
        let key = hash_url(url);
        let path = tile_dir.join(format!("{}.png", key));
        std::fs::write(&path, b"\x89PNG\r\n\x1a\n-fake-").unwrap();
        tile_cache_db::insert_tile_meta(&conn, &key, path.to_str().unwrap(), 12).unwrap();
        drop(conn);

        let result = fetch_tile_inner(&handle, url.to_string()).await.unwrap();
        assert!(result.starts_with("data:image/png;base64,"));
        let b64 = result.trim_start_matches("data:image/png;base64,");
        let decoded = STANDARD.decode(b64).unwrap();
        assert_eq!(decoded, b"\x89PNG\r\n\x1a\n-fake-");
    }

    #[tokio::test]
    async fn fetch_tile_rejects_invalid_url() {
        let _guard = cache_env_lock().lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        std::env::set_var("HOME", dir.path());
        std::env::set_var("BILI_APP_CACHE_DIR", dir.path().join("app-cache"));
        let app = tauri::test::mock_app();
        let handle = app.handle().clone();
        let err = fetch_tile_inner(&handle, "https://evil.example.com/x.png".into()).await.unwrap_err();
        assert!(err.contains("invalid tile url"));
    }

    #[test]
    fn stats_and_clear_roundtrip() {
        let _guard = cache_env_lock().lock().unwrap();
        let dir = tempfile::tempdir().unwrap();
        std::env::set_var("HOME", dir.path());
        std::env::set_var("BILI_APP_CACHE_DIR", dir.path().join("app-cache"));
        let storage = dir.path().join("legacy-storage");
        std::fs::create_dir_all(&storage).unwrap();
        let app = tauri::test::mock_app();
        let handle = app.handle().clone();
        let metadata_dir = cache_metadata_dir(&handle).unwrap();
        let _ = std::fs::remove_dir_all(&metadata_dir);
        let conn = seed_cache_db(&metadata_dir);
        let tile_dir = cache_dir(&handle).unwrap();
        let _ = std::fs::remove_dir_all(&tile_dir);
        std::fs::create_dir_all(&tile_dir).unwrap();
        let p1 = tile_dir.join("a.png");
        let p2 = tile_dir.join("b.png");
        std::fs::write(&p1, b"aaaa").unwrap();
        std::fs::write(&p2, b"bbbb").unwrap();
        tile_cache_db::insert_tile_meta(&conn, "a", p1.to_str().unwrap(), 4).unwrap();
        tile_cache_db::insert_tile_meta(&conn, "b", p2.to_str().unwrap(), 4).unwrap();
        drop(conn);

        let stats = get_tile_cache_stats_inner(&handle).unwrap();
        assert_eq!(stats.tile_count, 2);
        assert!(stats.size_bytes >= 8);

        let legacy_tile_dir = storage.join("tile-cache");
        std::fs::create_dir_all(&legacy_tile_dir).unwrap();
        std::fs::write(legacy_tile_dir.join("old.png"), b"old").unwrap();

        clear_tile_cache_inner(&handle, Some(storage.to_string_lossy().to_string())).unwrap();
        let stats2 = get_tile_cache_stats_inner(&handle).unwrap();
        assert_eq!(stats2.size_bytes, 0);
        assert_eq!(stats2.tile_count, 0);
        assert!(!p1.exists());
        assert!(!p2.exists());
        assert!(!legacy_tile_dir.exists());
    }
}
