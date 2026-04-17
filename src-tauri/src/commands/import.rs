use rusqlite::{Connection, params};
use tauri::Emitter;
use chrono::Utc;
use std::collections::HashMap;
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
    #[serde(default)]
    pub location_note: String,
    #[serde(default)]
    pub observed_count: Option<i64>,
    #[serde(default)]
    pub additional_photos: Vec<String>, // Mode A: extra source paths for same find
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct FindPhoto {
    pub id: i64,
    pub find_id: i64,
    pub photo_path: String,
    pub is_primary: bool,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct FindRecord {
    pub id: i64,
    pub original_filename: String,
    pub species_name: String,
    pub date_found: String,
    pub country: String,
    pub region: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub notes: String,
    pub location_note: String,
    pub observed_count: Option<i64>,
    pub is_favorite: bool,
    pub created_at: String,
    pub photos: Vec<FindPhoto>,
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

const MIGRATION_0001: &str = include_str!("../../migrations/0001_initial.sql");
const MIGRATION_0002: &str = include_str!("../../migrations/0002_finds.sql");
const MIGRATION_0003: &str = include_str!("../../migrations/0003_find_photos.sql");
const MIGRATION_0004: &str = include_str!("../../migrations/0004_location_note.sql");
const MIGRATION_0005: &str = include_str!("../../migrations/0005_species_notes.sql");
const MIGRATION_0006: &str = include_str!("../../migrations/0006_tile_cache.sql");
const MIGRATION_0007: &str = include_str!("../../migrations/0007_find_favorites.sql");
const MIGRATION_0008: &str = include_str!("../../migrations/0008_observed_count.sql");
const MIGRATION_0009: &str = include_str!("../../migrations/0009_species_profiles.sql");
const MIGRATION_0010: &str = include_str!("../../migrations/0010_species_profile_tags.sql");

/// Apply all migrations to an open connection using rusqlite's user_version pragma
/// as a lightweight migration tracker. Idempotent — safe to call on every open.
fn migrate_db(conn: &Connection) -> Result<(), String> {
    let version: i64 = conn
        .query_row("PRAGMA user_version", [], |r| r.get(0))
        .map_err(|e| format!("Failed to read user_version: {}", e))?;

    if version < 1 {
        conn.execute_batch(MIGRATION_0001)
            .map_err(|e| format!("Migration 0001 failed: {}", e))?;
        conn.execute_batch("PRAGMA user_version = 1")
            .map_err(|e| format!("Failed to set user_version=1: {}", e))?;
    }
    if version < 2 {
        conn.execute_batch(MIGRATION_0002)
            .map_err(|e| format!("Migration 0002 failed: {}", e))?;
        conn.execute_batch("PRAGMA user_version = 2")
            .map_err(|e| format!("Failed to set user_version=2: {}", e))?;
    }
    if version < 3 {
        conn.execute_batch(MIGRATION_0003)
            .map_err(|e| format!("Migration 0003 failed: {}", e))?;
        conn.execute_batch("PRAGMA user_version = 3")
            .map_err(|e| format!("Failed to set user_version=3: {}", e))?;
    }
    if version < 4 {
        conn.execute_batch(MIGRATION_0004)
            .map_err(|e| format!("Migration 0004 failed: {}", e))?;
        conn.execute_batch("PRAGMA user_version = 4")
            .map_err(|e| format!("Failed to set user_version=4: {}", e))?;
    }
    if version < 5 {
        conn.execute_batch(MIGRATION_0005)
            .map_err(|e| format!("Migration 0005 failed: {}", e))?;
        conn.execute_batch("PRAGMA user_version = 5")
            .map_err(|e| format!("Failed to set user_version=5: {}", e))?;
    }
    if version < 6 {
        conn.execute_batch(MIGRATION_0006)
            .map_err(|e| format!("Migration 0006 failed: {}", e))?;
        conn.execute_batch("PRAGMA user_version = 6")
            .map_err(|e| format!("Failed to set user_version=6: {}", e))?;
    }
    if version < 7 {
        let finds_table_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='finds'",
                [],
                |r| r.get(0),
            )
            .map_err(|e| format!("Failed to inspect finds table for migration 0007: {}", e))?;
        if finds_table_exists > 0 {
            conn.execute_batch(MIGRATION_0007)
                .map_err(|e| format!("Migration 0007 failed: {}", e))?;
        }
        conn.execute_batch("PRAGMA user_version = 7")
            .map_err(|e| format!("Failed to set user_version=7: {}", e))?;
    }
    if version < 8 {
        let finds_table_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='finds'",
                [],
                |r| r.get(0),
            )
            .map_err(|e| format!("Failed to inspect finds table for migration 0008: {}", e))?;
        if finds_table_exists > 0 {
            conn.execute_batch(MIGRATION_0008)
                .map_err(|e| format!("Migration 0008 failed: {}", e))?;
        }
        conn.execute_batch("PRAGMA user_version = 8")
            .map_err(|e| format!("Failed to set user_version=8: {}", e))?;
    }
    if version < 9 {
        conn.execute_batch(MIGRATION_0009)
            .map_err(|e| format!("Migration 0009 failed: {}", e))?;
        conn.execute_batch("PRAGMA user_version = 9")
            .map_err(|e| format!("Failed to set user_version=9: {}", e))?;
    }
    if version < 10 {
        let profiles_table_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='species_profiles'",
                [],
                |r| r.get(0),
            )
            .map_err(|e| format!("Failed to inspect species_profiles table for migration 0010: {}", e))?;
        if profiles_table_exists > 0 {
            conn.execute_batch(MIGRATION_0010)
                .map_err(|e| format!("Migration 0010 failed: {}", e))?;
        }
        conn.execute_batch("PRAGMA user_version = 10")
            .map_err(|e| format!("Failed to set user_version=10: {}", e))?;
    }

    Ok(())
}

pub(crate) fn open_db(storage_path: &str) -> Result<Connection, String> {
    let db_path = format!("{}/bili-mushroom.db", storage_path);
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open DB at {}: {}", db_path, e))?;
    migrate_db(&conn)?;
    Ok(conn)
}

fn has_existing_photo_path(conn: &Connection, photo_path: &str) -> rusqlite::Result<bool> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM find_photos WHERE photo_path = ?1",
        params![photo_path],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

pub(crate) fn insert_find_row(conn: &Connection, record: &FindRecord) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO finds (original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, is_favorite, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            record.original_filename,
            record.species_name,
            record.date_found,
            record.country,
            record.region,
            record.lat,
            record.lng,
            record.notes,
            record.location_note,
            record.observed_count,
            if record.is_favorite { 1i64 } else { 0i64 },
            record.created_at,
        ],
    )?;
    Ok(conn.last_insert_rowid())
}

pub(crate) fn insert_find_photo(
    conn: &Connection,
    find_id: i64,
    photo_path: &str,
    is_primary: bool,
) -> rusqlite::Result<i64> {
    conn.execute(
        "INSERT INTO find_photos (find_id, photo_path, is_primary) VALUES (?1, ?2, ?3)",
        params![find_id, photo_path, if is_primary { 1i64 } else { 0i64 }],
    )?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub async fn import_find(
    app: tauri::AppHandle,
    storage_path: String,
    payloads: Vec<ImportPayload>,
    delete_source: bool,
) -> Result<ImportSummary, String> {
    let total = payloads.len();
    let mut imported: Vec<FindRecord> = Vec::new();
    let mut skipped: Vec<String> = Vec::new();

    let conn = open_db(&storage_path)?;
    let storage_path_buf = Path::new(&storage_path);

    for (i, payload) in payloads.iter().enumerate() {
        // If source is already inside storage_path, register it in-place — no copy, no delete.
        // This handles auto-import where the user picks their existing mushroom library folder.
        let src_path = Path::new(&payload.source_path);
        let is_already_in_storage = src_path.starts_with(storage_path_buf);

        if is_already_in_storage {
            let existing_photo_path = src_path
                .strip_prefix(storage_path_buf)
                .map(|p| p.to_string_lossy().replace('\\', "/").trim_start_matches('/').to_string())
                .unwrap_or_else(|_| payload.source_path.clone());

            match has_existing_photo_path(&conn, &existing_photo_path) {
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
        }

        let primary_photo_path = if is_already_in_storage {
            src_path
                .strip_prefix(storage_path_buf)
                .map(|p| p.to_string_lossy().replace('\\', "/").to_string())
                .unwrap_or_else(|_| payload.source_path.clone())
        } else {
            // Determine destination extension
            let ext = src_path
                .extension()
                .map(|e| format!(".{}", e.to_string_lossy().to_lowercase()))
                .unwrap_or_else(|| ".jpg".to_string());

            // Build destination folder to determine sequence
            let dest_full = build_dest_path(
                &storage_path,
                &payload.species_name,
                &payload.date_found,
                1,
                &ext,
            );
            let dest_folder = dest_full
                .parent()
                .ok_or_else(|| "Could not determine destination folder".to_string())?;

            std::fs::create_dir_all(dest_folder)
                .map_err(|e| format!("Failed to create directory {:?}: {}", dest_folder, e))?;

            let seq = next_seq_for_folder(dest_folder);
            let dest_path = build_dest_path(
                &storage_path,
                &payload.species_name,
                &payload.date_found,
                seq,
                &ext,
            );

            // Copy then optionally delete source — works across filesystems/USB drives
            std::fs::copy(&payload.source_path, &dest_path)
                .map_err(|e| format!("Failed to copy {:?} to {:?}: {}", payload.source_path, dest_path, e))?;
            if delete_source {
                let _ = std::fs::remove_file(&payload.source_path); // best-effort; ignore on read-only USB
            }

            dest_path
                .strip_prefix(&storage_path)
                .map(|p| p.to_string_lossy().replace('\\', "/").trim_start_matches('/').to_string())
                .unwrap_or_else(|_| dest_path.to_string_lossy().to_string())
        };

        // created_at ISO 8601
        let created_at = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

        let record = FindRecord {
            id: 0, // set after insert
            original_filename: payload.original_filename.clone(),
            species_name: payload.species_name.clone(),
            date_found: payload.date_found.clone(),
            country: payload.country.clone(),
            region: payload.region.clone(),
            lat: payload.lat,
            lng: payload.lng,
            notes: payload.notes.clone(),
            location_note: payload.location_note.clone(),
            observed_count: payload.observed_count,
            is_favorite: false,
            created_at,
            photos: vec![],
        };

        let new_id = insert_find_row(&conn, &record)
            .map_err(|e| format!("DB insert failed: {}", e))?;

        // Insert primary photo into find_photos
        insert_find_photo(&conn, new_id, &primary_photo_path, true)
            .map_err(|e| format!("DB insert primary photo failed: {}", e))?;

        // Compute add_dest_folder before primary_photo_path is moved
        let primary_abs = storage_path_buf.join(&primary_photo_path);
        let add_dest_folder = primary_abs.parent().unwrap_or(storage_path_buf);

        let mut photos: Vec<FindPhoto> = vec![FindPhoto {
            id: conn.last_insert_rowid(),
            find_id: new_id,
            photo_path: primary_photo_path,
            is_primary: true,
        }];

        // Mode A: handle additional_photos (always copied to storage, never in-place)
        for additional_src in &payload.additional_photos {
            let add_ext = Path::new(additional_src)
                .extension()
                .map(|e| format!(".{}", e.to_string_lossy().to_lowercase()))
                .unwrap_or_else(|| ".jpg".to_string());

            let add_seq = next_seq_for_folder(add_dest_folder);
            let add_dest_path = build_dest_path(
                &storage_path,
                &payload.species_name,
                &payload.date_found,
                add_seq,
                &add_ext,
            );

            std::fs::copy(additional_src, &add_dest_path)
                .map_err(|e| format!("Failed to copy additional photo {:?} to {:?}: {}", additional_src, add_dest_path, e))?;
            let _ = std::fs::remove_file(additional_src); // best-effort move

            let add_photo_path = add_dest_path
                .strip_prefix(&storage_path)
                .map(|p| p.to_string_lossy().replace('\\', "/").trim_start_matches('/').to_string())
                .unwrap_or_else(|_| add_dest_path.to_string_lossy().to_string());

            let photo_row_id = insert_find_photo(&conn, new_id, &add_photo_path, false)
                .map_err(|e| format!("DB insert additional photo failed: {}", e))?;

            photos.push(FindPhoto {
                id: photo_row_id,
                find_id: new_id,
                photo_path: add_photo_path,
                is_primary: false,
            });
        }

        let mut final_record = record;
        final_record.id = new_id;
        final_record.photos = photos;
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

    let mut find_stmt = conn
        .prepare(
            "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, is_favorite, created_at
             FROM finds ORDER BY date_found DESC, id DESC",
        )
        .map_err(|e| format!("Failed to prepare finds query: {}", e))?;

    let mut records: Vec<FindRecord> = find_stmt
        .query_map([], |row| {
            Ok(FindRecord {
                id: row.get(0)?,
                original_filename: row.get(1)?,
                species_name: row.get(2)?,
                date_found: row.get(3)?,
                country: row.get(4)?,
                region: row.get(5)?,
                lat: row.get(6)?,
                lng: row.get(7)?,
                notes: row.get(8)?,
                location_note: row.get(9)?,
                observed_count: row.get(10)?,
                is_favorite: row.get::<_, i64>(11)? == 1,
                created_at: row.get(12)?,
                photos: vec![],
            })
        })
        .map_err(|e| format!("Query failed: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row mapping failed: {}", e))?;

    // Fetch all photos and build a HashMap<find_id, Vec<FindPhoto>>
    let mut photo_stmt = conn
        .prepare(
            "SELECT id, find_id, photo_path, is_primary FROM find_photos ORDER BY find_id, is_primary DESC, id ASC",
        )
        .map_err(|e| format!("Failed to prepare photos query: {}", e))?;

    let photo_rows: Vec<FindPhoto> = photo_stmt
        .query_map([], |row| {
            Ok(FindPhoto {
                id: row.get(0)?,
                find_id: row.get(1)?,
                photo_path: row.get(2)?,
                is_primary: row.get::<_, i64>(3)? == 1,
            })
        })
        .map_err(|e| format!("Photos query failed: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Photos row mapping failed: {}", e))?;

    let mut photos_by_find: HashMap<i64, Vec<FindPhoto>> = HashMap::new();
    for photo in photo_rows {
        photos_by_find.entry(photo.find_id).or_default().push(photo);
    }

    for record in &mut records {
        if let Some(photos) = photos_by_find.remove(&record.id) {
            record.photos = photos;
        }
    }

    Ok(records)
}

#[derive(serde::Deserialize)]
pub struct UpdateFindPayload {
    pub id: i64,
    pub species_name: String,
    pub date_found: String,
    pub country: String,
    pub region: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub notes: String,
    pub location_note: String,
    pub observed_count: Option<i64>,
}

#[tauri::command]
pub async fn update_find(
    storage_path: String,
    payload: UpdateFindPayload,
) -> Result<FindRecord, String> {
    let conn = open_db(&storage_path)?;

    let rows_affected = conn
        .execute(
            "UPDATE finds SET species_name=?1, date_found=?2, country=?3, region=?4, lat=?5, lng=?6, notes=?7, location_note=?8, observed_count=?9 WHERE id=?10",
            params![
                payload.species_name,
                payload.date_found,
                payload.country,
                payload.region,
                payload.lat,
                payload.lng,
                payload.notes,
                payload.location_note,
                payload.observed_count,
                payload.id,
            ],
        )
        .map_err(|e| format!("Update failed: {}", e))?;

    if rows_affected == 0 {
        return Err("find not found".into());
    }

    let mut record = conn
        .query_row(
            "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, is_favorite, created_at FROM finds WHERE id = ?1",
            params![payload.id],
            |row| {
                Ok(FindRecord {
                    id: row.get(0)?,
                    original_filename: row.get(1)?,
                    species_name: row.get(2)?,
                    date_found: row.get(3)?,
                    country: row.get(4)?,
                    region: row.get(5)?,
                    lat: row.get(6)?,
                    lng: row.get(7)?,
                    notes: row.get(8)?,
                    location_note: row.get(9)?,
                    observed_count: row.get(10)?,
                    is_favorite: row.get::<_, i64>(11)? == 1,
                    created_at: row.get(12)?,
                    photos: vec![],
                })
            },
        )
        .map_err(|e| format!("Failed to read updated record: {}", e))?;

    // Fetch photos for the updated record
    let mut stmt = conn
        .prepare(
            "SELECT id, find_id, photo_path, is_primary FROM find_photos WHERE find_id = ?1 ORDER BY is_primary DESC, id ASC",
        )
        .map_err(|e| e.to_string())?;
    let photos: Vec<FindPhoto> = stmt
        .query_map(params![payload.id], |row| {
            Ok(FindPhoto {
                id: row.get(0)?,
                find_id: row.get(1)?,
                photo_path: row.get(2)?,
                is_primary: row.get::<_, i64>(3)? == 1,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    record.photos = photos;
    Ok(record)
}

/// Shared test helpers — available to other test modules in the crate.
/// This block is compiled only during `cargo test`.
#[cfg(test)]
pub(crate) mod test_helpers {
    use super::*;
    use rusqlite::Connection;

    const MIGRATION_0001: &str = include_str!("../../migrations/0001_initial.sql");
    const MIGRATION_0002: &str = include_str!("../../migrations/0002_finds.sql");
    const MIGRATION_0003: &str = include_str!("../../migrations/0003_find_photos.sql");
    const MIGRATION_0004: &str = include_str!("../../migrations/0004_location_note.sql");
    const MIGRATION_0005: &str = include_str!("../../migrations/0005_species_notes.sql");
    const MIGRATION_0007: &str = include_str!("../../migrations/0007_find_favorites.sql");
    const MIGRATION_0008: &str = include_str!("../../migrations/0008_observed_count.sql");
    const MIGRATION_0009: &str = include_str!("../../migrations/0009_species_profiles.sql");
    const MIGRATION_0010: &str = include_str!("../../migrations/0010_species_profile_tags.sql");

    pub(crate) fn setup_in_memory_db() -> Connection {
        let conn = Connection::open_in_memory().expect("in-memory DB");
        conn.execute_batch(MIGRATION_0001).expect("migration 0001");
        conn.execute_batch(MIGRATION_0002).expect("migration 0002");
        conn.execute_batch(MIGRATION_0003).expect("migration 0003");
        conn.execute_batch(MIGRATION_0004).expect("migration 0004");
        conn.execute_batch(MIGRATION_0005).expect("migration 0005");
        conn.execute_batch(MIGRATION_0007).expect("migration 0007");
        conn.execute_batch(MIGRATION_0008).expect("migration 0008");
        conn.execute_batch(MIGRATION_0009).expect("migration 0009");
        conn.execute_batch(MIGRATION_0010).expect("migration 0010");
        conn
    }

    pub(crate) fn make_find_record(filename: &str, date: &str) -> FindRecord {
        FindRecord {
            id: 0,
            original_filename: filename.to_string(),
            species_name: "Boletus edulis".to_string(),
            date_found: date.to_string(),
            country: "Croatia".to_string(),
            region: "Region".to_string(),
            lat: Some(45.5),
            lng: Some(16.0),
            notes: "Test note".to_string(),
            location_note: "".to_string(),
            observed_count: None,
            is_favorite: false,
            created_at: "2024-05-10T14:23:00Z".to_string(),
            photos: vec![],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::test_helpers::{setup_in_memory_db, make_find_record};
    use rusqlite::Connection;

    const MIGRATION_0001: &str = include_str!("../../migrations/0001_initial.sql");
    const MIGRATION_0002: &str = include_str!("../../migrations/0002_finds.sql");
    const MIGRATION_0003: &str = include_str!("../../migrations/0003_find_photos.sql");

    #[test]
    fn test_has_existing_photo_path_returns_true_when_exists() {
        let conn = setup_in_memory_db();
        let record = make_find_record("photo.jpg", "2024-05-10");
        let id = insert_find_row(&conn, &record).expect("insert");
        insert_find_photo(&conn, id, "Boletus_edulis/2024-05-10_001.jpg", true).expect("insert photo");

        let dup = has_existing_photo_path(&conn, "Boletus_edulis/2024-05-10_001.jpg").expect("check");
        assert!(dup, "should be duplicate");
    }

    #[test]
    fn test_has_existing_photo_path_returns_false_when_not_exists() {
        let conn = setup_in_memory_db();
        let dup = has_existing_photo_path(&conn, "Boletus_edulis/2024-05-10_999.jpg").expect("check");
        assert!(!dup, "should not be duplicate");
    }

    #[test]
    fn test_duplicate_detection_does_not_block_same_filename_and_date_without_matching_photo_path() {
        let conn = setup_in_memory_db();
        let record = make_find_record("photo.jpg", "2024-05-10");
        let id = insert_find_row(&conn, &record).expect("insert");
        insert_find_photo(&conn, id, "Boletus_edulis/2024-05-10_001.jpg", true).expect("insert photo");

        let dup = has_existing_photo_path(&conn, "external/burst/photo.jpg").expect("check");
        assert!(!dup, "same filename/date alone should not be treated as duplicate");
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

        // Insert a photo so we can verify the find_photos table
        insert_find_photo(&conn, id, "Croatia/Region/2024-05-10/round_trip_1.jpg", true)
            .expect("insert photo");

        let retrieved: FindRecord = conn
            .query_row(
                "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, observed_count, is_favorite, created_at FROM finds WHERE id = ?1",
                params![id],
                |row| Ok(FindRecord {
                    id: row.get(0)?,
                    original_filename: row.get(1)?,
                    species_name: row.get(2)?,
                    date_found: row.get(3)?,
                    country: row.get(4)?,
                    region: row.get(5)?,
                    lat: row.get(6)?,
                    lng: row.get(7)?,
                    notes: row.get(8)?,
                    observed_count: row.get(9)?,
                    is_favorite: row.get::<_, i64>(10)? == 1,
                    created_at: row.get(11)?,
                    location_note: String::new(),
                    photos: vec![],
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

        // Verify photo is in find_photos table
        let photo_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM find_photos WHERE find_id = ?1",
                params![id],
                |row| row.get(0),
            )
            .expect("photo count");
        assert_eq!(photo_count, 1, "primary photo should be in find_photos");
    }

    #[test]
    fn test_insert_find_photo_creates_row() {
        let conn = setup_in_memory_db();
        let record = make_find_record("photo.jpg", "2024-05-10");
        let find_id = insert_find_row(&conn, &record).expect("insert find");

        let photo_id = insert_find_photo(&conn, find_id, "Croatia/Region/2024-05-10/photo_1.jpg", true)
            .expect("insert photo");
        assert!(photo_id > 0, "photo id should be positive");

        let (path, is_primary): (String, i64) = conn
            .query_row(
                "SELECT photo_path, is_primary FROM find_photos WHERE id = ?1",
                params![photo_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("query photo");
        assert_eq!(path, "Croatia/Region/2024-05-10/photo_1.jpg");
        assert_eq!(is_primary, 1);
    }

    #[test]
    fn test_migration_0003_creates_find_photos_table() {
        let conn = setup_in_memory_db();
        let table_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='find_photos'",
                [],
                |row| row.get(0),
            )
            .expect("query sqlite_master");
        assert_eq!(table_exists, 1, "find_photos table must exist after migration 0003");
    }

    #[test]
    fn test_migration_0003_migrates_existing_photo_path() {
        // Set up DB with only migrations 0001 and 0002 (before find_photos)
        let conn = Connection::open_in_memory().expect("in-memory DB");
        conn.execute_batch(MIGRATION_0001).expect("migration 0001");
        conn.execute_batch(MIGRATION_0002).expect("migration 0002");

        // Insert a find with photo_path (pre-migration schema)
        conn.execute(
            "INSERT INTO finds (photo_path, original_filename, species_name, date_found, country, region, lat, lng, notes, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                "Croatia/Region/2024-05-10/chanterelle_1.jpg",
                "chanterelle.jpg",
                "Cantharellus cibarius",
                "2024-05-10",
                "Croatia",
                "Region",
                45.5_f64,
                16.0_f64,
                "Test",
                "2024-05-10T14:23:00Z",
            ],
        ).expect("pre-migration insert");

        let find_id: i64 = conn
            .query_row("SELECT last_insert_rowid()", [], |row| row.get(0))
            .expect("get last id");

        // Apply migration 0003
        conn.execute_batch(MIGRATION_0003).expect("migration 0003");

        // Verify photo was migrated into find_photos with is_primary = 1
        let (photo_path, is_primary): (String, i64) = conn
            .query_row(
                "SELECT photo_path, is_primary FROM find_photos WHERE find_id = ?1",
                params![find_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("query migrated photo");

        assert_eq!(photo_path, "Croatia/Region/2024-05-10/chanterelle_1.jpg");
        assert_eq!(is_primary, 1, "migrated photo should have is_primary = 1");
    }

    /// Migration key regression test (risk A5):
    /// Verifies that 0001 + 0002 + 0003 migration SQL is valid and creates all tables
    /// when applied against a real on-disk SQLite DB via absolute path.
    #[test]
    fn test_migration_key_finds_table_exists_on_disk() {
        let dir = tempfile::tempdir().expect("tempdir");
        let db_path = dir.path().join("bili-mushroom.db");
        let conn = Connection::open(&db_path).expect("open on-disk DB");
        conn.execute_batch(MIGRATION_0001).expect("migration 0001");
        conn.execute_batch(MIGRATION_0002).expect("migration 0002");
        conn.execute_batch(MIGRATION_0003).expect("migration 0003");

        let table_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='finds'",
                [],
                |row| row.get(0),
            )
            .expect("query sqlite_master");

        assert_eq!(table_exists, 1, "finds table must exist after all migrations");

        let photo_table_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='find_photos'",
                [],
                |row| row.get(0),
            )
            .expect("query sqlite_master for find_photos");
        assert_eq!(photo_table_exists, 1, "find_photos table must exist after migration 0003");

        let version_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM app_metadata WHERE key='schema_version'",
                [],
                |row| row.get(0),
            )
            .expect("schema_version count query");
        assert_eq!(version_count, 1, "schema_version row must exist in app_metadata");
    }

    fn update_find_on_conn(conn: &Connection, payload: &UpdateFindPayload) -> Result<FindRecord, String> {
        let rows_affected = conn
            .execute(
                "UPDATE finds SET species_name=?1, date_found=?2, country=?3, region=?4, lat=?5, lng=?6, notes=?7, location_note=?8, observed_count=?9 WHERE id=?10",
                params![
                    payload.species_name,
                    payload.date_found,
                    payload.country,
                    payload.region,
                    payload.lat,
                    payload.lng,
                    payload.notes,
                    payload.location_note,
                    payload.observed_count,
                    payload.id,
                ],
            )
            .map_err(|e| format!("Update failed: {}", e))?;

        if rows_affected == 0 {
            return Err("find not found".into());
        }

        let mut record = conn.query_row(
            "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, is_favorite, created_at FROM finds WHERE id = ?1",
            params![payload.id],
            |row| {
                Ok(FindRecord {
                    id: row.get(0)?,
                    original_filename: row.get(1)?,
                    species_name: row.get(2)?,
                    date_found: row.get(3)?,
                    country: row.get(4)?,
                    region: row.get(5)?,
                    lat: row.get(6)?,
                    lng: row.get(7)?,
                    notes: row.get(8)?,
                    location_note: row.get(9)?,
                    observed_count: row.get(10)?,
                    is_favorite: row.get::<_, i64>(11)? == 1,
                    created_at: row.get(12)?,
                    photos: vec![],
                })
            },
        )
        .map_err(|e| format!("Failed to read updated record: {}", e))?;

        // Fetch photos
        let mut stmt = conn
            .prepare(
                "SELECT id, find_id, photo_path, is_primary FROM find_photos WHERE find_id = ?1 ORDER BY is_primary DESC, id ASC",
            )
            .map_err(|e| e.to_string())?;
        let photos: Vec<FindPhoto> = stmt
            .query_map(params![payload.id], |row| {
                Ok(FindPhoto {
                    id: row.get(0)?,
                    find_id: row.get(1)?,
                    photo_path: row.get(2)?,
                    is_primary: row.get::<_, i64>(3)? == 1,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        record.photos = photos;

        Ok(record)
    }

    #[test]
    fn test_update_find_changes_all_editable_fields() {
        let conn = setup_in_memory_db();
        let original = make_find_record("mushroom.jpg", "2024-05-10");
        let id = insert_find_row(&conn, &original).expect("insert");
        insert_find_photo(&conn, id, "Croatia/Region/2024-05-10/mushroom_1.jpg", true)
            .expect("insert photo");

        let payload = UpdateFindPayload {
            id,
            species_name: "Cantharellus cibarius".to_string(),
            date_found: "2024-06-01".to_string(),
            country: "Slovenia".to_string(),
            region: "Triglav".to_string(),
            lat: Some(46.3),
            lng: Some(14.1),
            notes: "Updated note".to_string(),
            location_note: "Near the oak".to_string(),
            observed_count: Some(12),
        };

        let updated = update_find_on_conn(&conn, &payload).expect("update");

        assert_eq!(updated.id, id);
        assert_eq!(updated.species_name, "Cantharellus cibarius");
        assert_eq!(updated.date_found, "2024-06-01");
        assert_eq!(updated.country, "Slovenia");
        assert_eq!(updated.region, "Triglav");
        assert!((updated.lat.unwrap() - 46.3).abs() < 1e-9);
        assert!((updated.lng.unwrap() - 14.1).abs() < 1e-9);
        assert_eq!(updated.notes, "Updated note");
        assert_eq!(updated.location_note, "Near the oak");
        assert_eq!(updated.observed_count, Some(12));
        // original_filename, created_at must be unchanged
        assert_eq!(updated.original_filename, "mushroom.jpg");
        assert_eq!(updated.created_at, "2024-05-10T14:23:00Z");
        // photos should still be present
        assert_eq!(updated.photos.len(), 1);
        assert!(updated.photos[0].is_primary);
    }

    #[test]
    fn test_update_find_returns_err_for_nonexistent_id() {
        let conn = setup_in_memory_db();

        let payload = UpdateFindPayload {
            id: 9999,
            species_name: "Ghost".to_string(),
            date_found: "2024-01-01".to_string(),
            country: "Nowhere".to_string(),
            region: "Void".to_string(),
            lat: None,
            lng: None,
            notes: "".to_string(),
            location_note: "".to_string(),
            observed_count: None,
        };

        let result = update_find_on_conn(&conn, &payload);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "find not found");
    }
}
