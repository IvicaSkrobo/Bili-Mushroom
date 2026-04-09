use rusqlite::{Connection, params};
use tauri::Emitter;
use chrono::Utc;
use std::path::Path;

use crate::commands::path_builder::{build_dest_path, next_seq_for_folder};

#[derive(serde::Deserialize)]
pub struct ImportPayload {
    pub source_path: String,
    pub original_filename: String,
    pub species_name: String,
    pub date_found: String,
    pub country: String,
    pub region: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub notes: String,
}

#[derive(serde::Serialize, Clone)]
pub struct FindRecord {
    pub id: i64,
    pub photo_path: String,
    pub original_filename: String,
    pub species_name: String,
    pub date_found: String,
    pub country: String,
    pub region: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub notes: String,
    pub created_at: String,
}

#[derive(serde::Serialize)]
pub struct ImportSummary {
    pub imported: Vec<FindRecord>,
    pub skipped: Vec<String>,
}

#[derive(serde::Serialize, Clone)]
pub struct ImportProgress {
    pub current: usize,
    pub total: usize,
    pub filename: String,
}

fn open_db(storage_path: &str) -> Result<Connection, String> {
    let db_path = format!("{}/bili-mushroom.db", storage_path);
    Connection::open(&db_path).map_err(|e| format!("Failed to open DB at {}: {}", db_path, e))
}

fn is_duplicate(conn: &Connection, filename: &str, date_found: &str) -> rusqlite::Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM finds WHERE original_filename = ?1 AND date_found = ?2",
        params![filename, date_found],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

fn insert_find_row(conn: &Connection, record: &FindRecord) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO finds (photo_path, original_filename, species_name, date_found, country, region, lat, lng, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            record.photo_path,
            record.original_filename,
            record.species_name,
            record.date_found,
            record.country,
            record.region,
            record.lat,
            record.lng,
            record.notes,
            record.created_at,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub async fn import_find(
    app: tauri::AppHandle,
    storage_path: String,
    payloads: Vec<ImportPayload>,
) -> Result<ImportSummary, String> {
    let total = payloads.len();
    let mut imported: Vec<FindRecord> = Vec::new();
    let mut skipped: Vec<String> = Vec::new();

    let conn = open_db(&storage_path)?;

    for (i, payload) in payloads.iter().enumerate() {
        // Duplicate check
        match is_duplicate(&conn, &payload.original_filename, &payload.date_found) {
            Ok(true) => {
                skipped.push(payload.original_filename.clone());
                let _ = app.emit(
                    "import-progress",
                    ImportProgress {
                        current: i + 1,
                        total,
                        filename: payload.original_filename.clone(),
                    },
                );
                continue;
            }
            Ok(false) => {}
            Err(e) => return Err(format!("Duplicate check failed: {}", e)),
        }

        // Determine destination extension
        let ext = Path::new(&payload.source_path)
            .extension()
            .map(|e| format!(".{}", e.to_string_lossy().to_lowercase()))
            .unwrap_or_else(|| ".jpg".to_string());

        // Build destination folder (without filename) to determine sequence
        let dest_full = build_dest_path(
            &storage_path,
            &payload.country,
            &payload.region,
            &payload.date_found,
            &payload.species_name,
            1, // temporary seq — we'll recompute
            &ext,
        );
        let dest_folder = dest_full
            .parent()
            .ok_or_else(|| "Could not determine destination folder".to_string())?;

        // Create directory
        std::fs::create_dir_all(dest_folder)
            .map_err(|e| format!("Failed to create directory {:?}: {}", dest_folder, e))?;

        // Compute actual sequence
        let seq = next_seq_for_folder(dest_folder);
        let dest_path = build_dest_path(
            &storage_path,
            &payload.country,
            &payload.region,
            &payload.date_found,
            &payload.species_name,
            seq,
            &ext,
        );

        // Copy file
        std::fs::copy(&payload.source_path, &dest_path)
            .map_err(|e| format!("Failed to copy {:?} to {:?}: {}", payload.source_path, dest_path, e))?;

        // Compute relative photo_path (forward-slash for cross-platform)
        let photo_path = dest_path
            .strip_prefix(&storage_path)
            .map(|p| p.to_string_lossy().replace('\\', "/").trim_start_matches('/').to_string())
            .unwrap_or_else(|_| dest_path.to_string_lossy().to_string());

        // created_at ISO 8601
        let created_at = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

        let record = FindRecord {
            id: 0, // set after insert
            photo_path,
            original_filename: payload.original_filename.clone(),
            species_name: payload.species_name.clone(),
            date_found: payload.date_found.clone(),
            country: payload.country.clone(),
            region: payload.region.clone(),
            lat: payload.lat,
            lng: payload.lng,
            notes: payload.notes.clone(),
            created_at,
        };

        let new_id = insert_find_row(&conn, &record)
            .map_err(|e| format!("DB insert failed: {}", e))?;

        let mut final_record = record;
        final_record.id = new_id;
        imported.push(final_record);

        let _ = app.emit(
            "import-progress",
            ImportProgress {
                current: i + 1,
                total,
                filename: payload.original_filename.clone(),
            },
        );
    }

    Ok(ImportSummary { imported, skipped })
}

#[tauri::command]
pub async fn get_finds(storage_path: String) -> Result<Vec<FindRecord>, String> {
    let conn = open_db(&storage_path)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, photo_path, original_filename, species_name, date_found, country, region, lat, lng, notes, created_at
             FROM finds ORDER BY date_found DESC, id DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let records = stmt
        .query_map([], |row| {
            Ok(FindRecord {
                id: row.get(0)?,
                photo_path: row.get(1)?,
                original_filename: row.get(2)?,
                species_name: row.get(3)?,
                date_found: row.get(4)?,
                country: row.get(5)?,
                region: row.get(6)?,
                lat: row.get(7)?,
                lng: row.get(8)?,
                notes: row.get(9)?,
                created_at: row.get(10)?,
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row mapping failed: {}", e))?;

    Ok(records)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    const MIGRATION_0001: &str = include_str!("../../migrations/0001_initial.sql");
    const MIGRATION_0002: &str = include_str!("../../migrations/0002_finds.sql");

    fn setup_in_memory_db() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory DB");
        conn.execute_batch(MIGRATION_0001).expect("migration 0001");
        conn.execute_batch(MIGRATION_0002).expect("migration 0002");
        conn
    }

    fn make_find_record(filename: &str, date: &str) -> FindRecord {
        FindRecord {
            id: 0,
            photo_path: format!("Croatia/Region/{}/{}_1.jpg", date, filename),
            original_filename: filename.to_string(),
            species_name: "Boletus edulis".to_string(),
            date_found: date.to_string(),
            country: "Croatia".to_string(),
            region: "Region".to_string(),
            lat: Some(45.5),
            lng: Some(16.0),
            notes: "Test note".to_string(),
            created_at: "2024-05-10T14:23:00Z".to_string(),
        }
    }

    #[test]
    fn test_is_duplicate_returns_true_when_exists() {
        let conn = setup_in_memory_db();
        let record = make_find_record("photo.jpg", "2024-05-10");
        insert_find_row(&conn, &record).expect("insert");

        let dup = is_duplicate(&conn, "photo.jpg", "2024-05-10").expect("check");
        assert!(dup, "should be duplicate");
    }

    #[test]
    fn test_is_duplicate_returns_false_when_not_exists() {
        let conn = setup_in_memory_db();
        let dup = is_duplicate(&conn, "nonexistent.jpg", "2024-05-10").expect("check");
        assert!(!dup, "should not be duplicate");
    }

    #[test]
    fn test_is_duplicate_different_date_not_duplicate() {
        let conn = setup_in_memory_db();
        let record = make_find_record("photo.jpg", "2024-05-10");
        insert_find_row(&conn, &record).expect("insert");

        // Same filename, different date — not a duplicate
        let dup = is_duplicate(&conn, "photo.jpg", "2024-06-15").expect("check");
        assert!(!dup, "different date should not be duplicate");
    }

    #[test]
    fn test_insert_find_row_returns_new_id() {
        let conn = setup_in_memory_db();
        let record = make_find_record("photo.jpg", "2024-05-10");
        let id = insert_find_row(&conn, &record).expect("insert");
        assert!(id > 0, "inserted id should be positive");
    }

    #[test]
    fn test_insert_find_row_round_trips_all_fields() {
        let conn = setup_in_memory_db();
        let record = make_find_record("round_trip.jpg", "2024-05-10");
        let id = insert_find_row(&conn, &record).expect("insert");

        let retrieved: FindRecord = conn
            .query_row(
                "SELECT id, photo_path, original_filename, species_name, date_found, country, region, lat, lng, notes, created_at FROM finds WHERE id = ?1",
                params![id],
                |row| Ok(FindRecord {
                    id: row.get(0)?,
                    photo_path: row.get(1)?,
                    original_filename: row.get(2)?,
                    species_name: row.get(3)?,
                    date_found: row.get(4)?,
                    country: row.get(5)?,
                    region: row.get(6)?,
                    lat: row.get(7)?,
                    lng: row.get(8)?,
                    notes: row.get(9)?,
                    created_at: row.get(10)?,
                }),
            )
            .expect("query");

        assert_eq!(retrieved.original_filename, "round_trip.jpg");
        assert_eq!(retrieved.date_found, "2024-05-10");
        assert_eq!(retrieved.species_name, "Boletus edulis");
        assert_eq!(retrieved.country, "Croatia");
        assert_eq!(retrieved.region, "Region");
        assert!((retrieved.lat.unwrap() - 45.5).abs() < 1e-9);
        assert!((retrieved.lng.unwrap() - 16.0).abs() < 1e-9);
        assert_eq!(retrieved.notes, "Test note");
        assert_eq!(retrieved.created_at, "2024-05-10T14:23:00Z");
    }

    /// Migration key regression test (risk A5):
    /// Verifies that 0001 + 0002 migration SQL is valid and creates the finds table
    /// when applied against a real on-disk SQLite DB via absolute path.
    #[test]
    fn test_migration_key_finds_table_exists_on_disk() {
        let dir = tempfile::tempdir().expect("tempdir");
        let db_path = dir.path().join("bili-mushroom.db");
        let conn = Connection::open(&db_path).expect("open on-disk DB");
        conn.execute_batch(MIGRATION_0001).expect("migration 0001");
        conn.execute_batch(MIGRATION_0002).expect("migration 0002");

        let table_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='finds'",
                [],
                |row| row.get(0),
            )
            .expect("query sqlite_master");

        assert_eq!(table_exists, 1, "finds table must exist after both migrations");

        // Verify schema_version row exists (INSERT OR IGNORE keeps original value '1' since 0001
        // already inserted it; the important thing is the finds table was created by 0002)
        let version_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM app_metadata WHERE key='schema_version'",
                [],
                |row| row.get(0),
            )
            .expect("schema_version count query");
        assert_eq!(version_count, 1, "schema_version row must exist in app_metadata");
    }
}
