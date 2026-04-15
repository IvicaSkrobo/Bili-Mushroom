use crate::commands::tile_cache_db;
use base64::{engine::general_purpose::STANDARD, Engine};
use rusqlite::Connection;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::path::PathBuf;

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

fn cache_dir(storage_path: &str) -> PathBuf {
    PathBuf::from(storage_path).join("tile-cache")
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
    tile_cache_db::update_last_accessed(conn, tile_key).map_err(|e| e.to_string())?;
    Ok(Some(encode_data_uri(&bytes, mime_from_ext(ext))))
}

#[tauri::command]
pub async fn fetch_tile(url: String, storage_path: String) -> Result<String, String> {
    validate_url(&url)?;
    let dir = cache_dir(&storage_path);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let tile_key = hash_url(&url);

    {
        let conn = open_conn(&storage_path)?;
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
        let conn = open_conn(&storage_path)?;
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
pub fn get_tile_cache_stats(storage_path: String) -> Result<TileCacheStats, String> {
    let conn = open_conn(&storage_path)?;
    let size_bytes = tile_cache_db::total_cache_size(&conn).map_err(|e| e.to_string())?;
    let tile_count = tile_cache_db::tile_count(&conn).map_err(|e| e.to_string())?;
    Ok(TileCacheStats { size_bytes, tile_count })
}

#[tauri::command]
pub fn clear_tile_cache(storage_path: String) -> Result<(), String> {
    let dir = cache_dir(&storage_path);
    let conn = open_conn(&storage_path)?;
    tile_cache_db::clear_all(&conn, &dir).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_cache_max(storage_path: String, max_bytes: i64) -> Result<(), String> {
    let conn = open_conn(&storage_path)?;
    conn.execute(
        "INSERT OR REPLACE INTO tile_cache_settings (key, value) VALUES ('max_bytes', ?1)",
        rusqlite::params![max_bytes.to_string()],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_cache_max_bytes(storage_path: String) -> Result<i64, String> {
    let conn = open_conn(&storage_path)?;
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
        let dir = tempfile::tempdir().unwrap();
        let storage = dir.path().to_str().unwrap().to_string();
        let conn = crate::commands::import::open_db(&storage).unwrap();
        let tile_dir = cache_dir(&storage);
        std::fs::create_dir_all(&tile_dir).unwrap();
        let url = "https://tile.openstreetmap.org/1/2/3.png";
        let key = hash_url(url);
        let path = tile_dir.join(format!("{}.png", key));
        std::fs::write(&path, b"\x89PNG\r\n\x1a\n-fake-").unwrap();
        tile_cache_db::insert_tile_meta(&conn, &key, path.to_str().unwrap(), 12).unwrap();
        drop(conn);

        let result = fetch_tile(url.to_string(), storage).await.unwrap();
        assert!(result.starts_with("data:image/png;base64,"));
        let b64 = result.trim_start_matches("data:image/png;base64,");
        let decoded = STANDARD.decode(b64).unwrap();
        assert_eq!(decoded, b"\x89PNG\r\n\x1a\n-fake-");
    }

    #[tokio::test]
    async fn fetch_tile_rejects_invalid_url() {
        let dir = tempfile::tempdir().unwrap();
        let storage = dir.path().to_str().unwrap().to_string();
        let err = fetch_tile("https://evil.example.com/x.png".into(), storage).await.unwrap_err();
        assert!(err.contains("invalid tile url"));
    }

    #[test]
    fn stats_and_clear_roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let storage = dir.path().to_str().unwrap().to_string();
        let conn = crate::commands::import::open_db(&storage).unwrap();
        let tile_dir = cache_dir(&storage);
        std::fs::create_dir_all(&tile_dir).unwrap();
        let p1 = tile_dir.join("a.png");
        let p2 = tile_dir.join("b.png");
        std::fs::write(&p1, b"aaaa").unwrap();
        std::fs::write(&p2, b"bbbb").unwrap();
        tile_cache_db::insert_tile_meta(&conn, "a", p1.to_str().unwrap(), 4).unwrap();
        tile_cache_db::insert_tile_meta(&conn, "b", p2.to_str().unwrap(), 4).unwrap();
        drop(conn);

        let stats = get_tile_cache_stats(storage.clone()).unwrap();
        assert_eq!(stats.size_bytes, 8);
        assert_eq!(stats.tile_count, 2);

        clear_tile_cache(storage.clone()).unwrap();
        let stats2 = get_tile_cache_stats(storage).unwrap();
        assert_eq!(stats2.size_bytes, 0);
        assert_eq!(stats2.tile_count, 0);
        assert!(!p1.exists());
        assert!(!p2.exists());
    }
}
