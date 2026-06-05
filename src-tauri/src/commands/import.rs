use chrono::Utc;
use rusqlite::{params, params_from_iter, Connection, ToSql};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;
use tauri::Emitter;

use crate::commands::path_builder::{
    build_dest_path, next_seq_for_folder, resolve_location_component,
};

#[derive(serde::Deserialize)]
pub struct ImportPayload {
    pub source_path: String,
    pub original_filename: String,
    pub species_name: String,
    #[serde(default)]
    pub common_name: Option<String>,
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
    pub observed_count_min: Option<i64>,
    #[serde(default)]
    pub observed_count_max: Option<i64>,
    #[serde(default)]
    pub additional_photos: Vec<String>, // Mode A: extra source paths for same find
    #[serde(default)]
    pub edibility_note: Option<String>,
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
    pub observed_count_min: Option<i64>,
    pub observed_count_max: Option<i64>,
    pub is_favorite: bool,
    pub created_at: String,
    pub edibility_note: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub photo_count: Option<i64>,
    pub photos: Vec<FindPhoto>,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct SpeciesFolderSummary {
    pub species_name: String,
    pub find_count: i64,
    pub photo_count: i64,
    pub favorite_count: i64,
    pub latest_date: Option<String>,
    pub representative_find: Option<FindRecord>,
}

#[derive(serde::Serialize)]
pub struct ImportSummary {
    pub imported: Vec<FindRecord>,
    pub skipped: Vec<String>,
    /// Paths that could not be deleted from source after import (e.g. file locked by WebView2).
    /// The import itself succeeded — these files can be deleted manually.
    pub delete_failures: Vec<String>,
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
const MIGRATION_0011: &str = include_str!("../../migrations/0011_zones.sql");
const MIGRATION_0012: &str = include_str!("../../migrations/0012_observed_count_range.sql");
const MIGRATION_0013: &str = include_str!("../../migrations/0013_species_profile_edibility.sql");
const MIGRATION_0014: &str = include_str!("../../migrations/0014_find_edibility_note.sql");
const MIGRATION_0015: &str =
    include_str!("../../migrations/0015_species_profile_edibility_note.sql");
const MIGRATION_0016: &str =
    include_str!("../../migrations/0016_species_profile_threat_distribution.sql");
const _MIGRATION_0017: &str = include_str!("../../migrations/0017_repair_finds_edibility_note.sql");
const MIGRATION_0018: &str = include_str!("../../migrations/0018_species_profile_synonyms.sql");
const MIGRATION_0019: &str =
    include_str!("../../migrations/0019_species_profile_fruiting_body_override.sql");
const MIGRATION_0020: &str = include_str!("../../migrations/0020_species_profile_description.sql");
const MIGRATION_0021: &str = include_str!("../../migrations/0021_species_recipes.sql");
const MIGRATION_0022: &str = include_str!("../../migrations/0022_species_profile_common_name.sql");

fn normalize_observed_range(
    observed_count: Option<i64>,
    observed_count_min: Option<i64>,
    observed_count_max: Option<i64>,
) -> (Option<i64>, Option<i64>, Option<i64>) {
    let min = observed_count_min.or(observed_count);
    let max = observed_count_max.or(observed_count_min).or(observed_count);

    match (min, max) {
        (Some(a), Some(b)) => {
            let low = a.min(b);
            let high = a.max(b);
            (Some((low + high) / 2), Some(low), Some(high))
        }
        (Some(value), None) | (None, Some(value)) => (Some(value), Some(value), Some(value)),
        (None, None) => (None, None, None),
    }
}

/// Public(crate) alias so sibling modules (finds.rs) can call the range normalizer.
pub(crate) fn normalize_observed_range_pub(
    observed_count: Option<i64>,
    observed_count_min: Option<i64>,
    observed_count_max: Option<i64>,
) -> (Option<i64>, Option<i64>, Option<i64>) {
    normalize_observed_range(observed_count, observed_count_min, observed_count_max)
}

pub(crate) fn find_record_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FindRecord> {
    let observed_count: Option<i64> = row.get(10)?;
    let observed_count_min: Option<i64> = row.get(11)?;
    let observed_count_max: Option<i64> = row.get(12)?;
    let (observed_count, observed_count_min, observed_count_max) =
        normalize_observed_range(observed_count, observed_count_min, observed_count_max);

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
        observed_count,
        observed_count_min,
        observed_count_max,
        is_favorite: row.get::<_, i64>(13)? == 1,
        created_at: row.get(14)?,
        edibility_note: row.get(15)?,
        photo_count: None,
        photos: vec![],
    })
}

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
            .map_err(|e| {
                format!(
                    "Failed to inspect species_profiles table for migration 0010: {}",
                    e
                )
            })?;
        if profiles_table_exists > 0 {
            conn.execute_batch(MIGRATION_0010)
                .map_err(|e| format!("Migration 0010 failed: {}", e))?;
        }
        conn.execute_batch("PRAGMA user_version = 10")
            .map_err(|e| format!("Failed to set user_version=10: {}", e))?;
    }
    if version < 11 {
        conn.execute_batch(MIGRATION_0011)
            .map_err(|e| format!("Migration 0011 failed: {}", e))?;
        conn.execute_batch("PRAGMA user_version = 11")
            .map_err(|e| format!("Failed to set user_version=11: {}", e))?;
    }
    if version < 12 {
        let finds_table_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='finds'",
                [],
                |r| r.get(0),
            )
            .map_err(|e| format!("Failed to inspect finds table for migration 0012: {}", e))?;
        if finds_table_exists > 0 {
            conn.execute_batch(MIGRATION_0012)
                .map_err(|e| format!("Migration 0012 failed: {}", e))?;
        }
        conn.execute_batch("PRAGMA user_version = 12")
            .map_err(|e| format!("Failed to set user_version=12: {}", e))?;
    }
    if version < 13 {
        let profiles_table_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='species_profiles'",
                [],
                |r| r.get(0),
            )
            .map_err(|e| {
                format!(
                    "Failed to inspect species_profiles table for migration 0013: {}",
                    e
                )
            })?;
        if profiles_table_exists > 0 {
            conn.execute_batch(MIGRATION_0013)
                .map_err(|e| format!("Migration 0013 failed: {}", e))?;
        }
        conn.execute_batch("PRAGMA user_version = 13")
            .map_err(|e| format!("Failed to set user_version=13: {}", e))?;
    }
    if version < 14 {
        let finds_table_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='finds'",
                [],
                |r| r.get(0),
            )
            .map_err(|e| format!("Failed to inspect finds table for migration 0014: {}", e))?;
        if finds_table_exists > 0 {
            conn.execute_batch(MIGRATION_0014)
                .map_err(|e| format!("Migration 0014 failed: {}", e))?;
        }
        conn.execute_batch("PRAGMA user_version = 14")
            .map_err(|e| format!("Failed to set user_version=14: {}", e))?;
    }
    if version < 15 {
        // Guard: only run if species_profiles exists but edibility_note column doesn't yet.
        // This covers DBs that already ran migration 0014 (which added edibility_note to
        // finds, not species_profiles) before the per-species pivot.
        let col_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('species_profiles') WHERE name='edibility_note'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if col_exists == 0 {
            conn.execute_batch(MIGRATION_0015)
                .map_err(|e| format!("Migration 0015 failed: {}", e))?;
        }
        conn.execute_batch("PRAGMA user_version = 15")
            .map_err(|e| format!("Failed to set user_version=15: {}", e))?;
    }
    if version < 16 {
        // Guard: add threat_status + distribution only if columns don't exist yet.
        let threat_col_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('species_profiles') WHERE name='threat_status'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if threat_col_exists == 0 {
            conn.execute_batch(MIGRATION_0016)
                .map_err(|e| format!("Migration 0016 failed: {}", e))?;
        }
        conn.execute_batch("PRAGMA user_version = 16")
            .map_err(|e| format!("Failed to set user_version=16: {}", e))?;
    }
    if version < 17 {
        // Recovery for Case B users: 0014 originally targeted species_profiles instead of
        // finds, so finds.edibility_note may be missing. Add it only if absent.
        let finds_edibility_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('finds') WHERE name='edibility_note'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if finds_edibility_exists == 0 {
            conn.execute_batch("ALTER TABLE finds ADD COLUMN edibility_note TEXT")
                .map_err(|e| {
                    format!("Migration 0017 (repair finds.edibility_note) failed: {}", e)
                })?;
        }
        conn.execute_batch("PRAGMA user_version = 17")
            .map_err(|e| format!("Failed to set user_version=17: {}", e))?;
    }
    if version < 18 {
        let synonyms_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('species_profiles') WHERE name = 'synonyms'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if synonyms_exists == 0 {
            conn.execute_batch(MIGRATION_0018)
                .map_err(|e| format!("Migration 0018 failed: {}", e))?;
        }
        conn.execute_batch("PRAGMA user_version = 18")
            .map_err(|e| format!("Failed to set user_version=18: {}", e))?;
    }
    if version < 19 {
        let fruiting_override_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('species_profiles') WHERE name = 'fruiting_body_count_override'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if fruiting_override_exists == 0 {
            conn.execute_batch(MIGRATION_0019)
                .map_err(|e| format!("Migration 0019 failed: {}", e))?;
        }
        conn.execute_batch("PRAGMA user_version = 19")
            .map_err(|e| format!("Failed to set user_version=19: {}", e))?;
    }
    if version < 20 {
        let description_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('species_profiles') WHERE name = 'description'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if description_exists == 0 {
            conn.execute_batch(MIGRATION_0020)
                .map_err(|e| format!("Migration 0020 failed: {}", e))?;
        }
        conn.execute_batch("PRAGMA user_version = 20")
            .map_err(|e| format!("Failed to set user_version=20: {}", e))?;
    }
    if version < 21 {
        let recipes_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='species_recipes'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if recipes_exists == 0 {
            conn.execute_batch(MIGRATION_0021)
                .map_err(|e| format!("Migration 0021 failed: {}", e))?;
        }
        conn.execute_batch("PRAGMA user_version = 21")
            .map_err(|e| format!("Failed to set user_version=21: {}", e))?;
    }
    if version < 22 {
        let common_name_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('species_profiles') WHERE name = 'common_name'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if common_name_exists == 0 {
            conn.execute_batch(MIGRATION_0022)
                .map_err(|e| format!("Migration 0022 failed: {}", e))?;
        }
        conn.execute_batch("PRAGMA user_version = 22")
            .map_err(|e| format!("Failed to set user_version=22: {}", e))?;
    }
    // Repair development/local databases whose user_version advanced before
    // these metadata columns were present. This is idempotent and keeps
    // synonyms/local names saveable without touching stored values.
    let synonyms_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('species_profiles') WHERE name = 'synonyms'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if synonyms_exists == 0 {
        conn.execute_batch("ALTER TABLE species_profiles ADD COLUMN synonyms TEXT")
            .map_err(|e| format!("Repair species_profiles.synonyms failed: {}", e))?;
    }

    let other_names_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('species_profiles') WHERE name = 'other_names'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if other_names_exists == 0 {
        conn.execute_batch("ALTER TABLE species_profiles ADD COLUMN other_names TEXT")
            .map_err(|e| format!("Repair species_profiles.other_names failed: {}", e))?;
    }

    Ok(())
}

fn ensure_performance_indexes(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE INDEX IF NOT EXISTS idx_finds_date_id ON finds(date_found DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_finds_species_name ON finds(species_name);
        CREATE INDEX IF NOT EXISTS idx_finds_species_name_lower ON finds(LOWER(species_name));
        CREATE INDEX IF NOT EXISTS idx_finds_favorite_date ON finds(is_favorite, date_found DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_finds_location_country_lower ON finds(LOWER(country));
        CREATE INDEX IF NOT EXISTS idx_finds_location_region_lower ON finds(LOWER(region));
        CREATE INDEX IF NOT EXISTS idx_finds_location_note_lower ON finds(LOWER(location_note));
        CREATE INDEX IF NOT EXISTS idx_find_photos_find_order ON find_photos(find_id, is_primary DESC, id ASC);
        CREATE INDEX IF NOT EXISTS idx_find_photos_path ON find_photos(photo_path);
        CREATE INDEX IF NOT EXISTS idx_species_profiles_name ON species_profiles(species_name);
        ",
    )
    .map_err(|e| format!("Failed to ensure performance indexes: {}", e))?;
    Ok(())
}

pub(crate) fn open_db(storage_path: &str) -> Result<Connection, String> {
    let db_path = format!("{}/bili-mushroom.db", storage_path);
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open DB at {}: {}", db_path, e))?;
    migrate_db(&conn)?;
    ensure_performance_indexes(&conn)?;
    Ok(conn)
}

#[tauri::command]
pub async fn initialize_database(storage_path: String) -> Result<(), String> {
    let _conn = open_db(&storage_path)?;
    Ok(())
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
        "INSERT INTO finds (original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
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
            record.observed_count_min,
            record.observed_count_max,
            if record.is_favorite { 1i64 } else { 0i64 },
            record.created_at,
            record.edibility_note,
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
    validate_library_relative_photo_path(photo_path)?;
    conn.execute(
        "INSERT INTO find_photos (find_id, photo_path, is_primary) VALUES (?1, ?2, ?3)",
        params![find_id, photo_path, if is_primary { 1i64 } else { 0i64 }],
    )?;
    Ok(conn.last_insert_rowid())
}

pub(crate) fn source_path_key(path: &str) -> String {
    let normalized = path.trim().replace('\\', "/");
    if cfg!(windows) {
        normalized.to_lowercase()
    } else {
        normalized
    }
}

pub(crate) fn remember_source_path(seen: &mut HashSet<String>, path: &str) -> bool {
    seen.insert(source_path_key(path))
}

pub(crate) fn upsert_species_common_name(
    conn: &Connection,
    species_name: &str,
    common_name: Option<&str>,
) -> Result<(), String> {
    let Some(common_name) = common_name.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(());
    };

    let updated_at = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    conn.execute(
        "INSERT INTO species_profiles (species_name, cover_photo_id, tags_json, updated_at, common_name)
         VALUES (?1, NULL, '[]', ?2, ?3)
         ON CONFLICT(species_name) DO UPDATE SET
           common_name = excluded.common_name,
           updated_at = excluded.updated_at",
        params![species_name.trim(), updated_at, common_name],
    )
    .map_err(|e| format!("Upsert species common name failed: {}", e))?;
    Ok(())
}

fn validate_library_relative_photo_path(photo_path: &str) -> rusqlite::Result<()> {
    let trimmed = photo_path.trim();
    let path = Path::new(trimmed);
    let has_windows_drive = trimmed.len() >= 3
        && trimmed.as_bytes()[1] == b':'
        && (trimmed.as_bytes()[2] == b'\\' || trimmed.as_bytes()[2] == b'/');
    let has_unc_prefix = trimmed.starts_with("\\\\") || trimmed.starts_with("//");
    let has_parent_component = path
        .components()
        .any(|component| matches!(component, std::path::Component::ParentDir));

    if trimmed.is_empty()
        || path.is_absolute()
        || has_windows_drive
        || has_unc_prefix
        || has_parent_component
    {
        return Err(rusqlite::Error::InvalidParameterName(format!(
            "photo_path must be relative to the Gljivobook library folder: {}",
            photo_path
        )));
    }

    Ok(())
}

/// Attempt to delete a source file after a successful copy, with retries.
///
/// On Windows, WebView2 may hold a file handle on the primary photo (which is
/// rendered as a thumbnail via convertFileSrc). remove_file will return
/// ERROR_SHARING_VIOLATION (os error 32) if the handle is still open. We retry
/// up to `max_attempts` times with a short sleep so that the WebView2 handle has
/// time to close before we give up and report the failure.
///
/// Returns `Ok(())` if deletion succeeded, or `Err(path)` if all attempts failed.
fn delete_source_with_retry(
    path: &str,
    max_attempts: u32,
    retry_delay: Duration,
) -> Result<(), String> {
    for attempt in 0..max_attempts {
        match std::fs::remove_file(path) {
            Ok(()) => return Ok(()),
            Err(_) if attempt + 1 < max_attempts => {
                thread::sleep(retry_delay);
            }
            Err(_) => {
                return Err(path.to_string());
            }
        }
    }
    Err(path.to_string())
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
    let mut delete_failures: Vec<String> = Vec::new();

    let conn = open_db(&storage_path)?;
    let storage_path_buf = Path::new(&storage_path);
    let mut seen_source_paths: HashSet<String> = HashSet::new();

    for (i, payload) in payloads.iter().enumerate() {
        if !remember_source_path(&mut seen_source_paths, &payload.source_path) {
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

        // Location label for filename: only location_note (user-entered "oznaka").
        // Region is NOT used — user wants the manual label, not the auto-geocoded region.
        let location_label = payload.location_note.trim().to_string();

        // If source is already inside storage_path, register it in-place — no copy, no delete.
        // This handles auto-import where the user picks their existing mushroom library folder.
        let src_path = Path::new(&payload.source_path);
        let is_already_in_storage = src_path.starts_with(storage_path_buf);

        if is_already_in_storage {
            let existing_photo_path = src_path
                .strip_prefix(storage_path_buf)
                .map(|p| {
                    p.to_string_lossy()
                        .replace('\\', "/")
                        .trim_start_matches('/')
                        .to_string()
                })
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
                &location_label,
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
                &location_label,
                seq,
                &ext,
            );

            // Copy then optionally delete source — works across filesystems/USB drives.
            // The primary photo (photos[0]) may be held open by WebView2 on Windows while
            // the thumbnail is displayed. We retry deletion to give the handle time to release.
            std::fs::copy(&payload.source_path, &dest_path).map_err(|e| {
                format!(
                    "Failed to copy {:?} to {:?}: {}",
                    payload.source_path, dest_path, e
                )
            })?;
            if delete_source {
                if let Err(failed_path) =
                    delete_source_with_retry(&payload.source_path, 3, Duration::from_millis(150))
                {
                    delete_failures.push(failed_path);
                }
            }

            dest_path
                .strip_prefix(&storage_path)
                .map(|p| {
                    p.to_string_lossy()
                        .replace('\\', "/")
                        .trim_start_matches('/')
                        .to_string()
                })
                .unwrap_or_else(|_| dest_path.to_string_lossy().to_string())
        };

        // created_at ISO 8601
        let created_at = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
        let (observed_count, observed_count_min, observed_count_max) = normalize_observed_range(
            payload.observed_count,
            payload.observed_count_min,
            payload.observed_count_max,
        );

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
            observed_count,
            observed_count_min,
            observed_count_max,
            is_favorite: false,
            created_at,
            edibility_note: payload.edibility_note.clone(),
            photo_count: Some(1 + payload.additional_photos.len() as i64),
            photos: vec![],
        };

        let new_id =
            insert_find_row(&conn, &record).map_err(|e| format!("DB insert failed: {}", e))?;

        upsert_species_common_name(&conn, &payload.species_name, payload.common_name.as_deref())?;

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
            if !remember_source_path(&mut seen_source_paths, additional_src) {
                skipped.push(
                    Path::new(additional_src)
                        .file_name()
                        .map(|name| name.to_string_lossy().to_string())
                        .unwrap_or_else(|| additional_src.clone()),
                );
                continue;
            }

            let add_ext = Path::new(additional_src)
                .extension()
                .map(|e| format!(".{}", e.to_string_lossy().to_lowercase()))
                .unwrap_or_else(|| ".jpg".to_string());

            let add_seq = next_seq_for_folder(add_dest_folder);
            let add_dest_path = build_dest_path(
                &storage_path,
                &payload.species_name,
                &payload.date_found,
                &location_label,
                add_seq,
                &add_ext,
            );

            std::fs::copy(additional_src, &add_dest_path).map_err(|e| {
                format!(
                    "Failed to copy additional photo {:?} to {:?}: {}",
                    additional_src, add_dest_path, e
                )
            })?;
            if delete_source {
                if let Err(failed_path) =
                    delete_source_with_retry(additional_src, 3, Duration::from_millis(150))
                {
                    delete_failures.push(failed_path);
                }
            }

            let add_photo_path = add_dest_path
                .strip_prefix(&storage_path)
                .map(|p| {
                    p.to_string_lossy()
                        .replace('\\', "/")
                        .trim_start_matches('/')
                        .to_string()
                })
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

    Ok(ImportSummary {
        imported,
        skipped,
        delete_failures,
    })
}

#[tauri::command]
pub async fn get_finds(
    storage_path: String,
    filters: Option<FindSearchFilters>,
) -> Result<Vec<FindRecord>, String> {
    let conn = open_db(&storage_path)?;
    let filters = filters.unwrap_or_default();
    let mut where_clauses: Vec<String> = Vec::new();
    let mut query_params: Vec<Box<dyn ToSql>> = Vec::new();
    push_find_search_filters(&filters, "", &mut where_clauses, &mut query_params, true);

    let limit = filters
        .limit
        .map(|value| value.clamp(1, 2000))
        .unwrap_or(i64::MAX);
    let offset = filters.offset.unwrap_or(0).max(0);
    let primary_photos_only = filters.photos_mode.as_deref() == Some("primary");
    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", where_clauses.join(" AND "))
    };
    let sql = format!(
        "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note
         FROM finds{} ORDER BY date_found DESC, id DESC LIMIT ? OFFSET ?",
        where_sql,
    );
    query_params.push(Box::new(limit));
    query_params.push(Box::new(offset));

    let mut find_stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare finds query: {}", e))?;

    let mut records: Vec<FindRecord> = find_stmt
        .query_map(
            params_from_iter(
                query_params
                    .iter()
                    .map(|value| value.as_ref() as &dyn ToSql),
            ),
            |row| find_record_from_row(row),
        )
        .map_err(|e| format!("Query failed: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row mapping failed: {}", e))?;

    if records.is_empty() {
        return Ok(records);
    }

    let find_ids: Vec<i64> = records.iter().map(|record| record.id).collect();
    let photo_placeholders = std::iter::repeat("?")
        .take(records.len())
        .collect::<Vec<_>>()
        .join(",");
    if primary_photos_only {
        let count_sql = format!(
            "SELECT find_id, COUNT(*) FROM find_photos WHERE find_id IN ({}) GROUP BY find_id",
            photo_placeholders,
        );
        let mut count_stmt = conn
            .prepare(&count_sql)
            .map_err(|e| format!("Failed to prepare photo counts query: {}", e))?;
        let photo_counts: Vec<(i64, i64)> = count_stmt
            .query_map(params_from_iter(find_ids.iter()), |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
            })
            .map_err(|e| format!("Photo counts query failed: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Photo counts row mapping failed: {}", e))?;
        let count_by_find: HashMap<i64, i64> = photo_counts.into_iter().collect();
        for record in &mut records {
            record.photo_count = Some(*count_by_find.get(&record.id).unwrap_or(&0));
        }
    }

    // Fetch photos and build a HashMap<find_id, Vec<FindPhoto>>. Collection can ask
    // for only the representative photo; detail screens keep the full photo list.
    let photo_sql = format!(
        "{} ORDER BY find_id, is_primary DESC, id ASC",
        if primary_photos_only {
            format!(
                "SELECT fp.id, fp.find_id, fp.photo_path, fp.is_primary
                 FROM find_photos fp
                 WHERE fp.find_id IN ({}) AND fp.id = (
                   SELECT fp2.id
                   FROM find_photos fp2
                   WHERE fp2.find_id = fp.find_id
                   ORDER BY fp2.is_primary DESC, fp2.id ASC
                   LIMIT 1
                 )",
                photo_placeholders,
            )
        } else {
            format!(
                "SELECT id, find_id, photo_path, is_primary FROM find_photos WHERE find_id IN ({})",
                photo_placeholders,
            )
        },
    );
    let mut photo_stmt = conn
        .prepare(&photo_sql)
        .map_err(|e| format!("Failed to prepare photos query: {}", e))?;

    let photo_rows: Vec<FindPhoto> = photo_stmt
        .query_map(params_from_iter(find_ids.iter()), |row| {
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
            if record.photo_count.is_none() {
                record.photo_count = Some(photos.len() as i64);
            }
            record.photos = photos;
        } else if record.photo_count.is_none() {
            record.photo_count = Some(0);
        }
    }

    Ok(records)
}

#[tauri::command]
pub async fn get_collection_folders(
    storage_path: String,
    filters: Option<FindSearchFilters>,
) -> Result<Vec<SpeciesFolderSummary>, String> {
    let conn = open_db(&storage_path)?;
    let filters = filters.unwrap_or_default();
    let mut where_clauses: Vec<String> = vec![
        "LOWER(TRIM(f.species_name)) NOT IN ('tile-cache', '.bili-cache', '.bili-cache-tiles')"
            .to_string(),
    ];
    let mut query_params: Vec<Box<dyn ToSql>> = Vec::new();
    push_find_search_filters(&filters, "f", &mut where_clauses, &mut query_params, true);

    let limit = filters
        .limit
        .map(|value| value.clamp(1, 2000))
        .unwrap_or(200);
    let offset = filters.offset.unwrap_or(0).max(0);
    let where_sql = format!(" WHERE {}", where_clauses.join(" AND "));
    let sql = format!(
        "SELECT
           f.species_name,
           COUNT(*) AS find_count,
           COALESCE(SUM((SELECT COUNT(*) FROM find_photos fp WHERE fp.find_id = f.id)), 0) AS photo_count,
           COALESCE(SUM(CASE WHEN f.is_favorite = 1 THEN 1 ELSE 0 END), 0) AS favorite_count,
           MAX(f.date_found) AS latest_date
         FROM finds f{}
         GROUP BY f.species_name
         ORDER BY latest_date DESC, f.species_name COLLATE NOCASE ASC
         LIMIT ? OFFSET ?",
        where_sql,
    );
    query_params.push(Box::new(limit));
    query_params.push(Box::new(offset));

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare collection folders query: {}", e))?;
    let mut summaries: Vec<SpeciesFolderSummary> = stmt
        .query_map(
            params_from_iter(
                query_params
                    .iter()
                    .map(|value| value.as_ref() as &dyn ToSql),
            ),
            |row| {
                Ok(SpeciesFolderSummary {
                    species_name: row.get(0)?,
                    find_count: row.get(1)?,
                    photo_count: row.get(2)?,
                    favorite_count: row.get(3)?,
                    latest_date: row.get(4)?,
                    representative_find: None,
                })
            },
        )
        .map_err(|e| format!("Collection folders query failed: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Collection folders row mapping failed: {}", e))?;

    for summary in &mut summaries {
        summary.representative_find =
            load_representative_find_for_species(&conn, &summary.species_name, &filters)?;
    }

    Ok(summaries)
}

#[tauri::command]
pub async fn get_species_finds(
    storage_path: String,
    species_name: String,
    filters: Option<FindSearchFilters>,
) -> Result<Vec<FindRecord>, String> {
    let conn = open_db(&storage_path)?;
    let filters = filters.unwrap_or_default();
    load_finds_for_species(&conn, &species_name, &filters)
}

fn load_representative_find_for_species(
    conn: &Connection,
    species_name: &str,
    filters: &FindSearchFilters,
) -> Result<Option<FindRecord>, String> {
    let mut filters = FindSearchFilters {
        limit: Some(1),
        offset: Some(0),
        photos_mode: Some("primary".to_string()),
        ..filters.clone()
    };
    filters.species_query = None;
    let mut finds = load_finds_for_species(conn, species_name, &filters)?;
    Ok(finds.pop())
}

fn load_finds_for_species(
    conn: &Connection,
    species_name: &str,
    filters: &FindSearchFilters,
) -> Result<Vec<FindRecord>, String> {
    let mut where_clauses: Vec<String> = vec!["species_name = ?".to_string()];
    let mut query_params: Vec<Box<dyn ToSql>> = vec![Box::new(species_name.to_string())];
    push_find_search_filters(filters, "", &mut where_clauses, &mut query_params, false);

    let limit = filters
        .limit
        .map(|value| value.clamp(1, 2000))
        .unwrap_or(200);
    let offset = filters.offset.unwrap_or(0).max(0);
    let primary_photos_only = filters.photos_mode.as_deref() == Some("primary");
    let where_sql = format!(" WHERE {}", where_clauses.join(" AND "));
    let sql = format!(
        "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note
         FROM finds{} ORDER BY date_found DESC, id DESC LIMIT ? OFFSET ?",
        where_sql,
    );
    query_params.push(Box::new(limit));
    query_params.push(Box::new(offset));

    let mut find_stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("Failed to prepare species finds query: {}", e))?;
    let mut records: Vec<FindRecord> = find_stmt
        .query_map(
            params_from_iter(
                query_params
                    .iter()
                    .map(|value| value.as_ref() as &dyn ToSql),
            ),
            |row| find_record_from_row(row),
        )
        .map_err(|e| format!("Species finds query failed: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Species finds row mapping failed: {}", e))?;

    hydrate_find_photos(conn, &mut records, primary_photos_only, Some(species_name))?;
    Ok(records)
}

fn hydrate_find_photos(
    conn: &Connection,
    records: &mut Vec<FindRecord>,
    primary_photos_only: bool,
    cover_species_name: Option<&str>,
) -> Result<(), String> {
    if records.is_empty() {
        return Ok(());
    }

    let find_ids: Vec<i64> = records.iter().map(|record| record.id).collect();
    let photo_placeholders = std::iter::repeat("?")
        .take(records.len())
        .collect::<Vec<_>>()
        .join(",");

    if primary_photos_only {
        let count_sql = format!(
            "SELECT find_id, COUNT(*) FROM find_photos WHERE find_id IN ({}) GROUP BY find_id",
            photo_placeholders,
        );
        let mut count_stmt = conn
            .prepare(&count_sql)
            .map_err(|e| format!("Failed to prepare photo counts query: {}", e))?;
        let photo_counts: Vec<(i64, i64)> = count_stmt
            .query_map(params_from_iter(find_ids.iter()), |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?))
            })
            .map_err(|e| format!("Photo counts query failed: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Photo counts row mapping failed: {}", e))?;
        let count_by_find: HashMap<i64, i64> = photo_counts.into_iter().collect();
        for record in records.iter_mut() {
            record.photo_count = Some(*count_by_find.get(&record.id).unwrap_or(&0));
        }
    }

    let photo_sql = format!(
        "{} ORDER BY find_id, is_primary DESC, id ASC",
        if primary_photos_only {
            if cover_species_name.is_some() {
                format!(
                    "SELECT fp.id, fp.find_id, fp.photo_path, fp.is_primary
                     FROM find_photos fp
                     WHERE fp.find_id IN ({}) AND fp.id = (
                       SELECT fp2.id
                       FROM find_photos fp2
                       WHERE fp2.find_id = fp.find_id
                       ORDER BY CASE WHEN fp2.id = (SELECT cover_photo_id FROM species_profiles WHERE species_name = ?) THEN 0 ELSE 1 END,
                                fp2.is_primary DESC,
                                fp2.id ASC
                       LIMIT 1
                     )",
                    photo_placeholders,
                )
            } else {
                format!(
                    "SELECT fp.id, fp.find_id, fp.photo_path, fp.is_primary
                     FROM find_photos fp
                     WHERE fp.find_id IN ({}) AND fp.id = (
                       SELECT fp2.id
                       FROM find_photos fp2
                       WHERE fp2.find_id = fp.find_id
                       ORDER BY fp2.is_primary DESC, fp2.id ASC
                       LIMIT 1
                     )",
                    photo_placeholders,
                )
            }
        } else {
            format!(
                "SELECT id, find_id, photo_path, is_primary FROM find_photos WHERE find_id IN ({})",
                photo_placeholders,
            )
        },
    );
    let mut photo_params: Vec<&dyn ToSql> =
        find_ids.iter().map(|value| value as &dyn ToSql).collect();
    if let Some(species_name) = cover_species_name.as_ref() {
        photo_params.push(species_name as &dyn ToSql);
    }
    let mut photo_stmt = conn
        .prepare(&photo_sql)
        .map_err(|e| format!("Failed to prepare photos query: {}", e))?;
    let photo_rows: Vec<FindPhoto> = photo_stmt
        .query_map(params_from_iter(photo_params), |row| {
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

    for record in records {
        if let Some(photos) = photos_by_find.remove(&record.id) {
            if record.photo_count.is_none() {
                record.photo_count = Some(photos.len() as i64);
            }
            record.photos = photos;
        } else if record.photo_count.is_none() {
            record.photo_count = Some(0);
        }
    }

    Ok(())
}

#[derive(serde::Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FindSearchFilters {
    pub species_query: Option<String>,
    pub location_query: Option<String>,
    pub favorites_only: Option<bool>,
    pub date_start: Option<String>,
    pub date_end: Option<String>,
    pub date_prefix: Option<String>,
    pub photos_mode: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

fn push_find_search_filters(
    filters: &FindSearchFilters,
    table_alias: &str,
    where_clauses: &mut Vec<String>,
    query_params: &mut Vec<Box<dyn ToSql>>,
    include_species_query: bool,
) {
    let col = |name: &str| {
        if table_alias.is_empty() {
            name.to_string()
        } else {
            format!("{}.{}", table_alias, name)
        }
    };

    if include_species_query {
        if let Some(species_query) = normalized_like_query(filters.species_query.as_deref()) {
            where_clauses.push(format!("LOWER({}) LIKE ? ESCAPE '\\'", col("species_name")));
            query_params.push(Box::new(species_query));
        }
    }

    if let Some(location_query) = normalized_like_query(filters.location_query.as_deref()) {
        where_clauses.push(format!(
            "(LOWER({}) LIKE ? ESCAPE '\\' OR LOWER({}) LIKE ? ESCAPE '\\' OR LOWER({}) LIKE ? ESCAPE '\\')",
            col("country"),
            col("region"),
            col("location_note"),
        ));
        query_params.push(Box::new(location_query.clone()));
        query_params.push(Box::new(location_query.clone()));
        query_params.push(Box::new(location_query));
    }

    if filters.favorites_only.unwrap_or(false) {
        where_clauses.push(format!("{} = 1", col("is_favorite")));
    }

    if let Some(date_start) = normalized_date_bound(filters.date_start.as_deref()) {
        where_clauses.push(format!("{} >= ?", col("date_found")));
        query_params.push(Box::new(date_start));
    }

    if let Some(date_end) = normalized_date_bound(filters.date_end.as_deref()) {
        where_clauses.push(format!("{} <= ?", col("date_found")));
        query_params.push(Box::new(date_end));
    }

    if let Some(date_prefix) = normalized_date_prefix(filters.date_prefix.as_deref()) {
        where_clauses.push(format!("{} LIKE ?", col("date_found")));
        query_params.push(Box::new(format!("{}%", date_prefix)));
    }
}

fn normalized_like_query(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim().to_lowercase();
    if trimmed.is_empty() {
        None
    } else {
        Some(format!(
            "%{}%",
            trimmed.replace('%', "\\%").replace('_', "\\_")
        ))
    }
}

fn normalized_date_bound(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    if trimmed.len() == 10
        && trimmed.chars().nth(4) == Some('-')
        && trimmed.chars().nth(7) == Some('-')
    {
        Some(trimmed.to_string())
    } else {
        None
    }
}

fn normalized_date_prefix(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    if trimmed.is_empty() {
        return None;
    }
    if trimmed.len() <= 10 && trimmed.chars().all(|ch| ch.is_ascii_digit() || ch == '-') {
        Some(trimmed.to_string())
    } else {
        None
    }
}

#[derive(serde::Deserialize)]
pub struct UpdateFindPayload {
    pub id: i64,
    pub species_name: String,
    #[serde(default)]
    pub common_name: Option<String>,
    pub date_found: String,
    pub country: String,
    pub region: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub notes: String,
    pub location_note: String,
    pub observed_count: Option<i64>,
    pub observed_count_min: Option<i64>,
    pub observed_count_max: Option<i64>,
    pub edibility_note: Option<String>,
}

#[tauri::command]
pub async fn update_find(
    storage_path: String,
    payload: UpdateFindPayload,
) -> Result<FindRecord, String> {
    let mut conn = open_db(&storage_path)?;
    let (observed_count, observed_count_min, observed_count_max) = normalize_observed_range(
        payload.observed_count,
        payload.observed_count_min,
        payload.observed_count_max,
    );
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to start update transaction: {}", e))?;

    let old_species_name: String = tx
        .query_row(
            "SELECT species_name FROM finds WHERE id = ?1",
            params![payload.id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to read current species name: {}", e))?;

    if old_species_name != payload.species_name {
        move_find_photos_to_species_folder(&tx, &storage_path, payload.id, &payload.species_name)?;
    }

    let rows_affected = tx
        .execute(
            "UPDATE finds SET species_name=?1, date_found=?2, country=?3, region=?4, lat=?5, lng=?6, notes=?7, location_note=?8, observed_count=?9, observed_count_min=?10, observed_count_max=?11, edibility_note=?12 WHERE id=?13",
            params![
                payload.species_name,
                payload.date_found,
                payload.country,
                payload.region,
                payload.lat,
                payload.lng,
                payload.notes,
                payload.location_note,
                observed_count,
                observed_count_min,
                observed_count_max,
                payload.edibility_note,
                payload.id,
            ],
        )
        .map_err(|e| format!("Update failed: {}", e))?;

    if rows_affected == 0 {
        return Err("find not found".into());
    }

    upsert_species_common_name(&tx, &payload.species_name, payload.common_name.as_deref())?;

    let mut record = tx
        .query_row(
            "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note FROM finds WHERE id = ?1",
            params![payload.id],
            |row| find_record_from_row(row),
        )
        .map_err(|e| format!("Failed to read updated record: {}", e))?;

    // Fetch photos for the updated record
    let photos: Vec<FindPhoto> = {
        let mut stmt = tx
            .prepare(
                "SELECT id, find_id, photo_path, is_primary FROM find_photos WHERE find_id = ?1 ORDER BY is_primary DESC, id ASC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![payload.id], |row| {
                Ok(FindPhoto {
                    id: row.get(0)?,
                    find_id: row.get(1)?,
                    photo_path: row.get(2)?,
                    is_primary: row.get::<_, i64>(3)? == 1,
                })
            })
            .map_err(|e| e.to_string())?;
        let collected = rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        collected
    };

    tx.commit()
        .map_err(|e| format!("Failed to finalize update: {}", e))?;
    record.photos = photos;
    Ok(record)
}

fn move_find_photos_to_species_folder(
    conn: &Connection,
    storage_path: &str,
    find_id: i64,
    new_species_name: &str,
) -> Result<(), String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, photo_path FROM find_photos WHERE find_id = ?1 ORDER BY is_primary DESC, id ASC",
        )
        .map_err(|e| e.to_string())?;
    let photo_rows = stmt
        .query_map(params![find_id], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    if photo_rows.is_empty() {
        return Ok(());
    }

    let target_folder = Path::new(storage_path).join(resolve_location_component(
        new_species_name,
        "unknown_species",
    ));
    std::fs::create_dir_all(&target_folder).map_err(|e| {
        format!(
            "Failed to create target folder '{}': {}",
            target_folder.display(),
            e
        )
    })?;

    for (photo_id, photo_path) in &photo_rows {
        let source_abs = Path::new(storage_path).join(photo_path);
        let filename = source_abs
            .file_name()
            .ok_or_else(|| format!("Photo path has no filename: {}", source_abs.display()))?;
        let mut target_abs = target_folder.join(filename);

        if source_abs != target_abs {
            target_abs = unique_destination_path(&target_abs);
            std::fs::create_dir_all(
                target_abs.parent().ok_or_else(|| {
                    format!("Target path has no parent: {}", target_abs.display())
                })?,
            )
            .map_err(|e| {
                format!(
                    "Failed to prepare target folder for '{}': {}",
                    target_abs.display(),
                    e
                )
            })?;
            std::fs::rename(&source_abs, &target_abs)
                .or_else(|_| {
                    std::fs::copy(&source_abs, &target_abs)?;
                    std::fs::remove_file(&source_abs)
                })
                .map_err(|e| {
                    format!(
                        "Failed to move '{}' to '{}': {}",
                        source_abs.display(),
                        target_abs.display(),
                        e
                    )
                })?;
        }

        let relative = target_abs
            .strip_prefix(storage_path)
            .map(|p| {
                p.to_string_lossy()
                    .replace('\\', "/")
                    .trim_start_matches('/')
                    .to_string()
            })
            .unwrap_or_else(|_| target_abs.to_string_lossy().replace('\\', "/"));
        conn.execute(
            "UPDATE find_photos SET photo_path = ?1 WHERE id = ?2",
            params![relative, photo_id],
        )
        .map_err(|e| format!("Failed to update photo path for photo {}: {}", photo_id, e))?;
    }

    Ok(())
}

fn unique_destination_path(initial: &Path) -> PathBuf {
    if !initial.exists() {
        return initial.to_path_buf();
    }

    let stem = initial
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "photo".to_string());
    let ext = initial
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let parent = initial.parent().map(Path::to_path_buf).unwrap_or_default();

    for index in 2..10_000 {
        let candidate = parent.join(format!("{stem} ({index}){ext}"));
        if !candidate.exists() {
            return candidate;
        }
    }

    initial.to_path_buf()
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
    const MIGRATION_0011: &str = include_str!("../../migrations/0011_zones.sql");
    const MIGRATION_0012: &str = include_str!("../../migrations/0012_observed_count_range.sql");
    const MIGRATION_0013: &str =
        include_str!("../../migrations/0013_species_profile_edibility.sql");
    const MIGRATION_0014: &str = include_str!("../../migrations/0014_find_edibility_note.sql");
    const MIGRATION_0015: &str =
        include_str!("../../migrations/0015_species_profile_edibility_note.sql");
    const MIGRATION_0016: &str =
        include_str!("../../migrations/0016_species_profile_threat_distribution.sql");

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
        conn.execute_batch(MIGRATION_0011).expect("migration 0011");
        conn.execute_batch(MIGRATION_0012).expect("migration 0012");
        conn.execute_batch(MIGRATION_0013).expect("migration 0013");
        conn.execute_batch(MIGRATION_0014).expect("migration 0014");
        conn.execute_batch(MIGRATION_0015).expect("migration 0015");
        conn.execute_batch(MIGRATION_0016).expect("migration 0016");
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
            observed_count_min: None,
            observed_count_max: None,
            is_favorite: false,
            created_at: "2024-05-10T14:23:00Z".to_string(),
            edibility_note: None,
            photo_count: Some(0),
            photos: vec![],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::test_helpers::{make_find_record, setup_in_memory_db};
    use super::*;
    use rusqlite::Connection;

    const MIGRATION_0001: &str = include_str!("../../migrations/0001_initial.sql");
    const MIGRATION_0002: &str = include_str!("../../migrations/0002_finds.sql");
    const MIGRATION_0003: &str = include_str!("../../migrations/0003_find_photos.sql");

    #[test]
    fn test_has_existing_photo_path_returns_true_when_exists() {
        let conn = setup_in_memory_db();
        let record = make_find_record("photo.jpg", "2024-05-10");
        let id = insert_find_row(&conn, &record).expect("insert");
        insert_find_photo(&conn, id, "Boletus_edulis/2024-05-10_001.jpg", true)
            .expect("insert photo");

        let dup =
            has_existing_photo_path(&conn, "Boletus_edulis/2024-05-10_001.jpg").expect("check");
        assert!(dup, "should be duplicate");
    }

    #[test]
    fn test_has_existing_photo_path_returns_false_when_not_exists() {
        let conn = setup_in_memory_db();
        let dup =
            has_existing_photo_path(&conn, "Boletus_edulis/2024-05-10_999.jpg").expect("check");
        assert!(!dup, "should not be duplicate");
    }

    #[test]
    fn test_duplicate_detection_does_not_block_same_filename_and_date_without_matching_photo_path()
    {
        let conn = setup_in_memory_db();
        let record = make_find_record("photo.jpg", "2024-05-10");
        let id = insert_find_row(&conn, &record).expect("insert");
        insert_find_photo(&conn, id, "Boletus_edulis/2024-05-10_001.jpg", true)
            .expect("insert photo");

        let dup = has_existing_photo_path(&conn, "external/burst/photo.jpg").expect("check");
        assert!(
            !dup,
            "same filename/date alone should not be treated as duplicate"
        );
    }

    #[test]
    fn test_remember_source_path_deduplicates_normalized_paths() {
        let mut seen = HashSet::new();

        assert!(remember_source_path(&mut seen, r"C:\photos\same.JPG"));
        assert!(
            !remember_source_path(&mut seen, "C:/photos/same.JPG"),
            "same path with different separators should be duplicate"
        );
        if cfg!(windows) {
            assert!(
                !remember_source_path(&mut seen, "c:/photos/same.jpg"),
                "same Windows path with different case should be duplicate"
            );
        }
        assert!(remember_source_path(&mut seen, r"C:\photos\other.JPG"));
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
        insert_find_photo(
            &conn,
            id,
            "Croatia/Region/2024-05-10/round_trip_1.jpg",
            true,
        )
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
                    observed_count_min: None,
                    observed_count_max: None,
                    edibility_note: None,
                    photo_count: None,
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

        let photo_id = insert_find_photo(
            &conn,
            find_id,
            "Croatia/Region/2024-05-10/photo_1.jpg",
            true,
        )
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
    fn test_insert_find_photo_rejects_absolute_and_parent_paths() {
        let conn = setup_in_memory_db();
        let record = make_find_record("photo.jpg", "2024-05-10");
        let find_id = insert_find_row(&conn, &record).expect("insert find");

        for bad_path in [
            "/tmp/photo.jpg",
            "C:\\Users\\Ivan\\photo.jpg",
            "C:/Users/Ivan/photo.jpg",
            "\\\\server\\share\\photo.jpg",
            "../outside/photo.jpg",
            "species/../../outside/photo.jpg",
        ] {
            let result = insert_find_photo(&conn, find_id, bad_path, true);
            assert!(
                result.is_err(),
                "photo_path should stay library-relative: {bad_path}"
            );
        }

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM find_photos", [], |row| row.get(0))
            .expect("count photos");
        assert_eq!(count, 0);
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
        assert_eq!(
            table_exists, 1,
            "find_photos table must exist after migration 0003"
        );
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

        assert_eq!(
            table_exists, 1,
            "finds table must exist after all migrations"
        );

        let photo_table_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='find_photos'",
                [],
                |row| row.get(0),
            )
            .expect("query sqlite_master for find_photos");
        assert_eq!(
            photo_table_exists, 1,
            "find_photos table must exist after migration 0003"
        );

        let version_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM app_metadata WHERE key='schema_version'",
                [],
                |row| row.get(0),
            )
            .expect("schema_version count query");
        assert_eq!(
            version_count, 1,
            "schema_version row must exist in app_metadata"
        );
    }

    fn update_find_on_conn(
        conn: &Connection,
        payload: &UpdateFindPayload,
    ) -> Result<FindRecord, String> {
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
                    observed_count_min: None,
                    observed_count_max: None,
                    is_favorite: row.get::<_, i64>(11)? == 1,
                    created_at: row.get(12)?,
                    edibility_note: None,
                    photo_count: None,
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
            common_name: None,
            date_found: "2024-06-01".to_string(),
            country: "Slovenia".to_string(),
            region: "Triglav".to_string(),
            lat: Some(46.3),
            lng: Some(14.1),
            notes: "Updated note".to_string(),
            location_note: "Near the oak".to_string(),
            observed_count: Some(12),
            observed_count_min: None,
            observed_count_max: None,
            edibility_note: None,
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
            common_name: None,
            date_found: "2024-01-01".to_string(),
            country: "Nowhere".to_string(),
            region: "Void".to_string(),
            lat: None,
            lng: None,
            notes: "".to_string(),
            location_note: "".to_string(),
            observed_count: None,
            observed_count_min: None,
            observed_count_max: None,
            edibility_note: None,
        };

        let result = update_find_on_conn(&conn, &payload);
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "find not found");
    }

    // ---------------------------------------------------------------------------
    // delete_source_with_retry tests
    // ---------------------------------------------------------------------------

    #[test]
    fn test_delete_source_with_retry_succeeds_on_existing_file() {
        let dir = tempfile::tempdir().expect("tempdir");
        let file_path = dir.path().join("source.jpg");
        std::fs::write(&file_path, b"fake image data").expect("write temp file");

        let path_str = file_path.to_string_lossy().to_string();
        let result = delete_source_with_retry(&path_str, 3, Duration::from_millis(10));
        assert!(result.is_ok(), "should succeed on existing file");
        assert!(!file_path.exists(), "file should be deleted");
    }

    #[test]
    fn test_delete_source_with_retry_returns_err_on_missing_file() {
        let path_str = "/tmp/nonexistent_bili_test_file_xyz.jpg".to_string();
        let result = delete_source_with_retry(&path_str, 3, Duration::from_millis(1));
        assert!(result.is_err(), "should fail on nonexistent file");
        assert_eq!(
            result.unwrap_err(),
            path_str,
            "error should contain the failed path"
        );
    }
}
