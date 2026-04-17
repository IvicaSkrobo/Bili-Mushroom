use rusqlite::{Connection, params};
use std::path::Path;

pub fn insert_tile_meta(conn: &Connection, tile_key: &str, file_path: &str, size_bytes: i64) -> rusqlite::Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT OR REPLACE INTO tile_cache_meta (tile_key, file_path, size_bytes, last_accessed) VALUES (?1, ?2, ?3, ?4)",
        params![tile_key, file_path, size_bytes, now],
    )?;
    Ok(())
}

pub fn update_last_accessed(conn: &Connection, tile_key: &str) -> rusqlite::Result<()> {
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE tile_cache_meta SET last_accessed = ?1 WHERE tile_key = ?2",
        params![now, tile_key],
    )?;
    Ok(())
}

pub fn total_cache_size(conn: &Connection) -> rusqlite::Result<i64> {
    conn.query_row(
        "SELECT COALESCE(SUM(size_bytes), 0) FROM tile_cache_meta",
        [],
        |r| r.get(0),
    )
}

pub fn tile_count(conn: &Connection) -> rusqlite::Result<i64> {
    conn.query_row("SELECT COUNT(*) FROM tile_cache_meta", [], |r| r.get(0))
}

pub fn evict_if_over_limit(conn: &Connection, max_bytes: i64) -> rusqlite::Result<usize> {
    let mut total = total_cache_size(conn)?;
    if total <= max_bytes {
        return Ok(0);
    }
    let mut stmt = conn.prepare(
        "SELECT tile_key, file_path, size_bytes FROM tile_cache_meta ORDER BY last_accessed ASC",
    )?;
    let rows: Vec<(String, String, i64)> = stmt
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
        .collect::<Result<_, _>>()?;
    drop(stmt);
    let mut evicted = 0usize;
    for (key, path, size) in rows {
        if total <= max_bytes {
            break;
        }
        let _ = std::fs::remove_file(&path);
        conn.execute("DELETE FROM tile_cache_meta WHERE tile_key = ?1", params![key])?;
        total -= size;
        evicted += 1;
    }
    Ok(evicted)
}

pub fn clear_all(conn: &Connection, cache_dir: &Path) -> rusqlite::Result<()> {
    let mut stmt = conn.prepare("SELECT file_path FROM tile_cache_meta")?;
    let paths: Vec<String> = stmt.query_map([], |r| r.get(0))?.collect::<Result<_, _>>()?;
    drop(stmt);
    for p in paths {
        let _ = std::fs::remove_file(&p);
    }
    conn.execute("DELETE FROM tile_cache_meta", [])?;
    if cache_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(cache_dir) {
            for e in entries.flatten() {
                let _ = std::fs::remove_file(e.path());
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    const TILE_CACHE_SQL: &str = "
        CREATE TABLE IF NOT EXISTS tile_cache_meta (
            tile_key TEXT PRIMARY KEY,
            file_path TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            last_accessed TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_tile_cache_accessed ON tile_cache_meta(last_accessed);
    ";

    fn setup_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(TILE_CACHE_SQL).unwrap();
        conn
    }

    #[test]
    fn test_insert_and_total() {
        let conn = setup_conn();
        insert_tile_meta(&conn, "key1", "/tmp/a.png", 100).unwrap();
        insert_tile_meta(&conn, "key2", "/tmp/b.png", 200).unwrap();
        assert_eq!(total_cache_size(&conn).unwrap(), 300);
        assert_eq!(tile_count(&conn).unwrap(), 2);
    }

    #[test]
    fn test_evict_noop_under_limit() {
        let conn = setup_conn();
        insert_tile_meta(&conn, "key1", "/tmp/a.png", 100).unwrap();
        let evicted = evict_if_over_limit(&conn, 1000).unwrap();
        assert_eq!(evicted, 0);
        assert_eq!(tile_count(&conn).unwrap(), 1);
    }

    #[test]
    fn test_evict_over_limit_removes_oldest() {
        let dir = tempfile::tempdir().unwrap();
        let conn = setup_conn();

        let f1 = dir.path().join("old.png");
        let f2 = dir.path().join("mid.png");
        let f3 = dir.path().join("new.png");
        std::fs::write(&f1, b"old").unwrap();
        std::fs::write(&f2, b"mid").unwrap();
        std::fs::write(&f3, b"new").unwrap();

        // Insert with explicit old→new timestamps
        conn.execute(
            "INSERT INTO tile_cache_meta (tile_key, file_path, size_bytes, last_accessed) VALUES (?1, ?2, ?3, ?4)",
            params!["k1", f1.to_str().unwrap(), 100i64, "2024-01-01T00:00:00+00:00"],
        ).unwrap();
        conn.execute(
            "INSERT INTO tile_cache_meta (tile_key, file_path, size_bytes, last_accessed) VALUES (?1, ?2, ?3, ?4)",
            params!["k2", f2.to_str().unwrap(), 100i64, "2024-06-01T00:00:00+00:00"],
        ).unwrap();
        conn.execute(
            "INSERT INTO tile_cache_meta (tile_key, file_path, size_bytes, last_accessed) VALUES (?1, ?2, ?3, ?4)",
            params!["k3", f3.to_str().unwrap(), 100i64, "2024-12-01T00:00:00+00:00"],
        ).unwrap();

        // Evict so only 200 bytes remain (should remove oldest: k1)
        let evicted = evict_if_over_limit(&conn, 200).unwrap();
        assert_eq!(evicted, 1);
        assert!(!f1.exists(), "oldest file should be deleted");
        assert!(f2.exists(), "mid file should remain");
        assert!(f3.exists(), "newest file should remain");
        assert_eq!(tile_count(&conn).unwrap(), 2);
    }

    #[test]
    fn test_clear_all_empties_table_and_disk() {
        let dir = tempfile::tempdir().unwrap();
        let conn = setup_conn();

        let f1 = dir.path().join("a.png");
        let f2 = dir.path().join("b.png");
        std::fs::write(&f1, b"aaa").unwrap();
        std::fs::write(&f2, b"bbb").unwrap();
        insert_tile_meta(&conn, "k1", f1.to_str().unwrap(), 3).unwrap();
        insert_tile_meta(&conn, "k2", f2.to_str().unwrap(), 3).unwrap();

        clear_all(&conn, dir.path()).unwrap();

        assert_eq!(total_cache_size(&conn).unwrap(), 0);
        assert!(!f1.exists());
        assert!(!f2.exists());
    }

    #[test]
    fn test_update_last_accessed_changes_row() {
        let conn = setup_conn();
        insert_tile_meta(&conn, "k1", "/tmp/a.png", 10).unwrap();

        let before: String = conn
            .query_row("SELECT last_accessed FROM tile_cache_meta WHERE tile_key = 'k1'", [], |r| r.get(0))
            .unwrap();

        std::thread::sleep(std::time::Duration::from_millis(10));
        update_last_accessed(&conn, "k1").unwrap();

        let after: String = conn
            .query_row("SELECT last_accessed FROM tile_cache_meta WHERE tile_key = 'k1'", [], |r| r.get(0))
            .unwrap();

        assert_ne!(before, after, "last_accessed should change after update");
    }

    #[test]
    fn test_migration_v10_creates_table() {
        let dir = tempfile::tempdir().unwrap();
        let storage = dir.path().to_str().unwrap();
        let conn = crate::commands::import::open_db(storage).unwrap();

        let exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE name='tile_cache_meta'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(exists, 1, "tile_cache_meta must exist after open_db");

        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, 10, "user_version must be 10 after all migrations");
    }
}
