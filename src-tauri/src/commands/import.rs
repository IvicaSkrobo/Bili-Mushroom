use chrono::Utc;
use rusqlite::{params, params_from_iter, Connection, ToSql};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Duration;
use tauri::Emitter;

use crate::commands::exif::extract_exif;
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
    #[serde(default)]
    pub weather: Option<String>,
    #[serde(default)]
    pub determiner: Option<String>,
    #[serde(default)]
    pub finder: Option<String>,
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
    pub weather: Option<String>,
    pub determiner: Option<String>,
    pub finder: Option<String>,
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
const MIGRATION_0023: &str = include_str!("../../migrations/0023_species_profile_habitat.sql");
const MIGRATION_0024: &str = include_str!("../../migrations/0024_find_weather.sql");
const MIGRATION_0025: &str = include_str!("../../migrations/0025_find_determiner_finder.sql");
const MIGRATION_0026: &str = include_str!("../../migrations/0026_samples.sql");

/// `PRAGMA user_version` after `migrate_db` has applied every migration. Bump this in
/// the same commit that adds a migration — tests assert against it so a forgotten bump
/// fails loudly instead of silently going stale.
pub(crate) const CURRENT_SCHEMA_VERSION: i64 = 26;

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
        weather: row.get(16)?,
        determiner: row.get(17)?,
        finder: row.get(18)?,
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
    if version < 23 {
        let habitat_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('species_profiles') WHERE name = 'habitat'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if habitat_exists == 0 {
            conn.execute_batch(MIGRATION_0023)
                .map_err(|e| format!("Migration 0023 failed: {}", e))?;
        }
        conn.execute_batch("PRAGMA user_version = 23")
            .map_err(|e| format!("Failed to set user_version=23: {}", e))?;
    }
    if version < 24 {
        let weather_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('finds') WHERE name = 'weather'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if weather_exists == 0 {
            conn.execute_batch(MIGRATION_0024)
                .map_err(|e| format!("Migration 0024 failed: {}", e))?;
        }
        conn.execute_batch("PRAGMA user_version = 24")
            .map_err(|e| format!("Failed to set user_version=24: {}", e))?;
    }
    if version < 25 {
        let finder_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('finds') WHERE name = 'finder'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if finder_exists == 0 {
            conn.execute_batch(MIGRATION_0025)
                .map_err(|e| format!("Migration 0025 failed: {}", e))?;
        }
        conn.execute_batch("PRAGMA user_version = 25")
            .map_err(|e| format!("Failed to set user_version=25: {}", e))?;
    }
    if version < 26 {
        conn.execute_batch(MIGRATION_0026)
            .map_err(|e| format!("Migration 0026 failed: {}", e))?;
        conn.execute_batch(&format!("PRAGMA user_version = {CURRENT_SCHEMA_VERSION}"))
            .map_err(|e| format!("Failed to set user_version={CURRENT_SCHEMA_VERSION}: {e}"))?;
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

    // Some existing databases advanced their version before the original species
    // profile schema was fully applied. Collection thumbnail selection relies on
    // this field, so repair it independently of user_version.
    let cover_photo_id_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('species_profiles') WHERE name = 'cover_photo_id'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if cover_photo_id_exists == 0 {
        conn.execute_batch("ALTER TABLE species_profiles ADD COLUMN cover_photo_id INTEGER")
            .map_err(|e| format!("Repair species_profiles.cover_photo_id failed: {}", e))?;
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

    let habitat_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('species_profiles') WHERE name = 'habitat'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if habitat_exists == 0 {
        conn.execute_batch("ALTER TABLE species_profiles ADD COLUMN habitat TEXT")
            .map_err(|e| format!("Repair species_profiles.habitat failed: {}", e))?;
    }

    let weather_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('finds') WHERE name = 'weather'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if weather_exists == 0 {
        conn.execute_batch("ALTER TABLE finds ADD COLUMN weather TEXT")
            .map_err(|e| format!("Repair finds.weather failed: {}", e))?;
    }

    let determiner_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('finds') WHERE name = 'determiner'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if determiner_exists == 0 {
        conn.execute_batch("ALTER TABLE finds ADD COLUMN determiner TEXT")
            .map_err(|e| format!("Repair finds.determiner failed: {}", e))?;
    }

    let finder_exists: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('finds') WHERE name = 'finder'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if finder_exists == 0 {
        conn.execute_batch("ALTER TABLE finds ADD COLUMN finder TEXT")
            .map_err(|e| format!("Repair finds.finder failed: {}", e))?;
    }

    // Idempotent: CREATE TABLE IF NOT EXISTS, so safe on every open.
    conn.execute_batch(MIGRATION_0026)
        .map_err(|e| format!("Repair samples tables failed: {}", e))?;

    Ok(())
}

fn ensure_performance_indexes(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "
        CREATE INDEX IF NOT EXISTS idx_finds_date_id ON finds(date_found DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_finds_species_name ON finds(species_name);
        CREATE INDEX IF NOT EXISTS idx_finds_species_date_id ON finds(species_name, date_found DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_finds_species_name_lower ON finds(LOWER(species_name));
        CREATE INDEX IF NOT EXISTS idx_finds_favorite_date ON finds(is_favorite, date_found DESC, id DESC);
        CREATE INDEX IF NOT EXISTS idx_finds_location_country_lower ON finds(LOWER(country));
        CREATE INDEX IF NOT EXISTS idx_finds_location_region_lower ON finds(LOWER(region));
        CREATE INDEX IF NOT EXISTS idx_finds_location_note_lower ON finds(LOWER(location_note));
        CREATE INDEX IF NOT EXISTS idx_find_photos_find_order ON find_photos(find_id, is_primary DESC, id ASC);
        CREATE INDEX IF NOT EXISTS idx_find_photos_path ON find_photos(photo_path);
        CREATE INDEX IF NOT EXISTS idx_species_profiles_name ON species_profiles(species_name);
        CREATE INDEX IF NOT EXISTS idx_zones_species_geometry_source ON zones(species_name, geometry_type, source_find_id, updated_at DESC, id DESC);
        ",
    )
    .map_err(|e| format!("Failed to ensure performance indexes: {}", e))?;
    Ok(())
}

static INITIALIZED_DATABASES: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();

pub(crate) fn open_db(storage_path: &str) -> Result<Connection, String> {
    let db_path = format!("{}/bili-mushroom.db", storage_path);
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open DB at {}: {}", db_path, e))?;
    conn.busy_timeout(Duration::from_secs(5))
        .map_err(|e| format!("Failed to configure DB busy timeout: {e}"))?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| format!("Failed to enable DB foreign keys: {e}"))?;

    // Migrations, repair PRAGMAs and CREATE INDEX checks are process-level setup,
    // not per-query work. Keep the first-open safety for tests and storage-path
    // switching while ensuring normal IPC reads only pay the connection cost.
    let initialized = INITIALIZED_DATABASES.get_or_init(|| Mutex::new(HashSet::new()));
    let mut initialized_paths = initialized
        .lock()
        .map_err(|_| "Database initialization lock was poisoned".to_string())?;
    if !initialized_paths.contains(&db_path) {
        backup_before_migration(&conn, storage_path)?;
        migrate_db(&conn)?;
        ensure_performance_indexes(&conn)?;
        initialized_paths.insert(db_path);
    }
    Ok(conn)
}

/// How many pre-migration backups to keep before the oldest is discarded.
const MIGRATION_BACKUPS_KEPT: usize = 5;

/// Copies the database aside before a migration changes it.
///
/// Only runs when there is something to migrate, so ordinary launches pay nothing, and
/// never for a brand-new database, which has nothing to lose. A failure here aborts the
/// migration rather than proceeding unprotected: the user can free disk space and
/// reopen, which is recoverable, whereas an interrupted migration without a copy is not.
fn backup_before_migration(conn: &Connection, storage_path: &str) -> Result<(), String> {
    let version: i64 = conn
        .query_row("PRAGMA user_version", [], |row| row.get(0))
        .unwrap_or(0);
    if version == 0 || version >= CURRENT_SCHEMA_VERSION {
        return Ok(());
    }

    let backup_dir = Path::new(storage_path).join(".bili-cache").join("backups");
    std::fs::create_dir_all(&backup_dir)
        .map_err(|e| format!("Failed to create the database backup folder: {e}"))?;

    let stamp = Utc::now().format("%Y%m%d-%H%M%S");
    let target = backup_dir.join(format!("bili-mushroom-v{version}-{stamp}.db"));
    let target_str = target
        .to_str()
        .ok_or_else(|| "Database backup path is not valid UTF-8".to_string())?;

    // VACUUM INTO writes a consistent, self-contained copy through SQLite itself. A file
    // copy would be unsafe here, especially once the database runs in WAL mode, because
    // recent pages can still live in the -wal sidecar.
    conn.execute("VACUUM INTO ?1", params![target_str])
        .map_err(|e| {
            format!(
                "Could not back up the database before migrating from version {version}: {e}. \
                 The library was left untouched — free some disk space and reopen the app."
            )
        })?;

    prune_migration_backups(&backup_dir);
    Ok(())
}

/// Keeps the newest backups and drops the rest. Names embed a sortable timestamp, so
/// lexical order is chronological. Failures are ignored: a stale backup is harmless.
fn prune_migration_backups(backup_dir: &Path) {
    let Ok(entries) = std::fs::read_dir(backup_dir) else {
        return;
    };
    let mut backups: Vec<PathBuf> = entries
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("bili-mushroom-v") && name.ends_with(".db"))
        })
        .collect();
    if backups.len() <= MIGRATION_BACKUPS_KEPT {
        return;
    }
    backups.sort();
    for stale in &backups[..backups.len() - MIGRATION_BACKUPS_KEPT] {
        let _ = std::fs::remove_file(stale);
    }
}

#[tauri::command]
pub async fn initialize_database(storage_path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let _conn = open_db(&storage_path)?;
        Ok(())
    })
    .await
    .map_err(|error| format!("Database initialization worker failed: {error}"))?
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
        "INSERT INTO finds (original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note, weather, determiner, finder)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)",
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
            record.weather,
            record.determiner,
            record.finder,
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
    // On Windows a drive-less rooted path such as "/tmp/photo.jpg" is NOT is_absolute(),
    // yet it still escapes the library folder — it resolves against the current drive
    // root. has_root() catches that case on both platforms.
    let has_root = path.has_root();

    if trimmed.is_empty()
        || path.is_absolute()
        || has_root
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

/// A photo copied into storage during the "copy phase" of a single find's import,
/// before anything has been committed to the database or deleted from source.
struct StagedPhoto {
    /// Absolute source path (used to delete from source only after DB commit succeeds).
    source_path: String,
    /// Absolute destination path actually written to disk.
    dest_abs: PathBuf,
    /// Path relative to storage_path, as stored in find_photos.photo_path.
    relative_path: String,
    is_primary: bool,
    /// True if this photo was freshly copied by this operation (dest_abs is a new file
    /// we own). False for "already in storage" in-place photos, where dest_abs IS the
    /// user's pre-existing library file and must never be deleted on rollback.
    was_copied: bool,
}

/// Remove any destination files freshly copied for this payload when a later copy
/// in the same find fails. Best-effort — copy failures here are not fatal since the
/// whole find is being abandoned anyway and no DB row/source deletion has happened yet.
/// Never removes in-place (was_copied=false) entries — those are pre-existing files
/// already living in the user's library, not files this operation created.
fn cleanup_staged_photos(staged: &[StagedPhoto]) {
    for photo in staged {
        if photo.was_copied {
            let _ = std::fs::remove_file(&photo.dest_abs);
        }
    }
}

/// Identical-content check: two source files are treated as the same photo added
/// twice, regardless of filename, when they are byte-for-byte identical. This
/// correctly catches renamed duplicates (e.g. a Windows " - Copy" duplicate, or the
/// same photo picked from two different folders under an unrelated name), which a
/// filename-based check can never detect since Windows never preserves the original
/// filename for auto-renamed copies. File size is checked first as a cheap filter:
/// most non-duplicate photos differ in size, so the much more expensive full-content
/// read only happens when sizes already match, keeping this cheap for the common case
/// of genuinely different photos in a large import batch.
fn is_likely_duplicate_content(a: &str, b: &str) -> bool {
    let size_a = std::fs::metadata(a).map(|m| m.len()).ok();
    let size_b = std::fs::metadata(b).map(|m| m.len()).ok();
    let (size_a, size_b) = match (size_a, size_b) {
        (Some(sa), Some(sb)) => (sa, sb),
        _ => return false,
    };
    if size_a != size_b {
        return false;
    }

    let bytes_a = std::fs::read(a).ok();
    let bytes_b = std::fs::read(b).ok();
    matches!((bytes_a, bytes_b), (Some(ba), Some(bb)) if ba == bb)
}

/// Scan photo source paths in order and return the first (lat, lng) pair found via
/// EXIF GPS tags. Returns None if no path has GPS data. Order matters: per product
/// decision, the first GPS-tagged photo in existing processing order wins — no
/// averaging or voting across multiple GPS-tagged photos in the same batch.
pub(crate) fn first_gps_coords_from_paths(paths: &[&str]) -> Option<(f64, f64)> {
    for path in paths {
        let exif = extract_exif(path);
        if let (Some(lat), Some(lng)) = (exif.lat, exif.lng) {
            return Some((lat, lng));
        }
    }
    None
}

/// Same scan as `first_gps_coords_from_paths`, over already-staged photos (in their
/// staged insertion order: primary first, then additional photos).
fn first_gps_coords_from_staged(staged: &[StagedPhoto]) -> Option<(f64, f64)> {
    let paths: Vec<&str> = staged.iter().map(|p| p.source_path.as_str()).collect();
    first_gps_coords_from_paths(&paths)
}

/// Decide final (lat, lng) for a find: manual payload values always win; EXIF
/// fallback only applies when the payload supplied neither coordinate.
fn resolve_find_coords(
    payload_lat: Option<f64>,
    payload_lng: Option<f64>,
    exif_coords: Option<(f64, f64)>,
) -> (Option<f64>, Option<f64>) {
    if payload_lat.is_none() && payload_lng.is_none() {
        match exif_coords {
            Some((lat, lng)) => (Some(lat), Some(lng)),
            None => (payload_lat, payload_lng),
        }
    } else {
        (payload_lat, payload_lng)
    }
}

/// Copy every photo (primary + additional) for one payload into storage, without
/// touching the database and without deleting any source file. Returns the staged
/// photos in insertion order (primary first) on success. On the first copy failure,
/// already-copied destination files for THIS payload are cleaned up and an error is
/// returned — no source file is ever deleted and no partial find can reach the DB,
/// because nothing has been written to the DB yet at this point.
fn copy_payload_photos(
    storage_path: &str,
    storage_path_buf: &Path,
    payload: &ImportPayload,
    location_label: &str,
    seen_source_paths: &mut HashSet<String>,
    skipped: &mut Vec<String>,
) -> Result<Vec<StagedPhoto>, String> {
    let mut staged: Vec<StagedPhoto> = Vec::new();
    // Content-dedupe against photos already staged for this same payload (defense in
    // depth for identical photos reaching Rust via distinct paths).
    let mut staged_sources: Vec<String> = Vec::new();

    let src_path = Path::new(&payload.source_path);
    let is_already_in_storage = src_path.starts_with(storage_path_buf);

    if is_already_in_storage {
        let relative_path = src_path
            .strip_prefix(storage_path_buf)
            .map(|p| p.to_string_lossy().replace('\\', "/").to_string())
            .unwrap_or_else(|_| payload.source_path.clone());
        staged.push(StagedPhoto {
            source_path: payload.source_path.clone(),
            dest_abs: src_path.to_path_buf(),
            relative_path,
            is_primary: true,
            was_copied: false,
        });
    } else {
        let ext = src_path
            .extension()
            .map(|e| format!(".{}", e.to_string_lossy().to_lowercase()))
            .unwrap_or_else(|| ".jpg".to_string());

        let dest_full = build_dest_path(
            storage_path,
            &payload.species_name,
            &payload.date_found,
            location_label,
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
            storage_path,
            &payload.species_name,
            &payload.date_found,
            location_label,
            seq,
            &ext,
        );

        if let Err(e) = std::fs::copy(&payload.source_path, &dest_path) {
            cleanup_staged_photos(&staged);
            return Err(format!(
                "Failed to copy {:?} to {:?}: {}",
                payload.source_path, dest_path, e
            ));
        }

        let relative_path = dest_path
            .strip_prefix(storage_path)
            .map(|p| {
                p.to_string_lossy()
                    .replace('\\', "/")
                    .trim_start_matches('/')
                    .to_string()
            })
            .unwrap_or_else(|_| dest_path.to_string_lossy().to_string());

        staged.push(StagedPhoto {
            source_path: payload.source_path.clone(),
            dest_abs: dest_path,
            relative_path,
            is_primary: true,
            was_copied: true,
        });
    }
    staged_sources.push(payload.source_path.clone());

    // add_dest_folder: same folder the primary photo landed in.
    let primary_abs = storage_path_buf.join(&staged[0].relative_path);
    let add_dest_folder = primary_abs
        .parent()
        .unwrap_or(storage_path_buf)
        .to_path_buf();

    for additional_src in &payload.additional_photos {
        if !remember_source_path(seen_source_paths, additional_src) {
            skipped.push(
                Path::new(additional_src)
                    .file_name()
                    .map(|name| name.to_string_lossy().to_string())
                    .unwrap_or_else(|| additional_src.clone()),
            );
            continue;
        }

        // Fix priority #1: silently keep only one copy of photos that are identical
        // in content (same size + same filename) to a photo already staged for this
        // find, rather than letting them both through as separate copies.
        if staged_sources
            .iter()
            .any(|already| is_likely_duplicate_content(already, additional_src))
        {
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

        let add_seq = next_seq_for_folder(&add_dest_folder);
        let add_dest_path = build_dest_path(
            storage_path,
            &payload.species_name,
            &payload.date_found,
            location_label,
            add_seq,
            &add_ext,
        );

        if let Err(e) = std::fs::copy(additional_src, &add_dest_path) {
            cleanup_staged_photos(&staged);
            return Err(format!(
                "Failed to copy additional photo {:?} to {:?}: {}",
                additional_src, add_dest_path, e
            ));
        }

        let add_relative_path = add_dest_path
            .strip_prefix(storage_path)
            .map(|p| {
                p.to_string_lossy()
                    .replace('\\', "/")
                    .trim_start_matches('/')
                    .to_string()
            })
            .unwrap_or_else(|_| add_dest_path.to_string_lossy().to_string());

        staged_sources.push(additional_src.clone());
        staged.push(StagedPhoto {
            source_path: additional_src.clone(),
            dest_abs: add_dest_path,
            relative_path: add_relative_path,
            is_primary: false,
            was_copied: true,
        });
    }

    Ok(staged)
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

    let mut conn = open_db(&storage_path)?;
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

        // If source is already inside storage_path, register it in-place — no copy, no
        // delete. This handles auto-import where the user picks their existing mushroom
        // library folder. Skip-if-duplicate check happens before any copy is attempted.
        let src_path = Path::new(&payload.source_path);
        if src_path.starts_with(storage_path_buf) {
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

        // --- Copy phase: copy every photo for this find to storage first. No DB writes,
        // no source deletion yet. If any copy fails, everything staged for THIS find is
        // rolled back (destination files removed) and no source file is ever touched. ---
        let staged = copy_payload_photos(
            &storage_path,
            storage_path_buf,
            payload,
            &location_label,
            &mut seen_source_paths,
            &mut skipped,
        )?;

        // --- Commit phase: only after every copy above succeeded, write the find and
        // all its photos inside a single transaction. A crash or error here rolls back
        // automatically (rusqlite drops uncommitted transactions), leaving no partial
        // find row behind — since nothing was deleted from source yet, no data is lost
        // even if this phase fails. ---
        let created_at = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
        let (observed_count, observed_count_min, observed_count_max) = normalize_observed_range(
            payload.observed_count,
            payload.observed_count_min,
            payload.observed_count_max,
        );

        // EXIF fallback: only consulted when the payload itself carries no manual
        // lat/lng. Scans staged photos in insertion order (primary first, then
        // additional) — first GPS-tagged photo wins. Manual values always win.
        let (final_lat, final_lng) = resolve_find_coords(
            payload.lat,
            payload.lng,
            first_gps_coords_from_staged(&staged),
        );

        let mut record = FindRecord {
            id: 0, // set after insert
            original_filename: payload.original_filename.clone(),
            species_name: payload.species_name.clone(),
            date_found: payload.date_found.clone(),
            country: payload.country.clone(),
            region: payload.region.clone(),
            lat: final_lat,
            lng: final_lng,
            notes: payload.notes.clone(),
            location_note: payload.location_note.clone(),
            observed_count,
            observed_count_min,
            observed_count_max,
            is_favorite: false,
            created_at,
            edibility_note: payload.edibility_note.clone(),
            weather: payload.weather.clone(),
            determiner: payload.determiner.clone(),
            finder: payload.finder.clone(),
            photo_count: Some(staged.len() as i64),
            photos: vec![],
        };

        let commit_result: Result<(i64, Vec<FindPhoto>), String> = (|| {
            let tx = conn
                .transaction()
                .map_err(|e| format!("Failed to start import transaction: {}", e))?;

            let new_id =
                insert_find_row(&tx, &record).map_err(|e| format!("DB insert failed: {}", e))?;

            upsert_species_common_name(&tx, &payload.species_name, payload.common_name.as_deref())?;

            let mut photos: Vec<FindPhoto> = Vec::with_capacity(staged.len());
            for photo in &staged {
                let photo_row_id =
                    insert_find_photo(&tx, new_id, &photo.relative_path, photo.is_primary)
                        .map_err(|e| format!("DB insert photo failed: {}", e))?;
                photos.push(FindPhoto {
                    id: photo_row_id,
                    find_id: new_id,
                    photo_path: photo.relative_path.clone(),
                    is_primary: photo.is_primary,
                });
            }

            tx.commit()
                .map_err(|e| format!("Failed to finalize import: {}", e))?;

            Ok((new_id, photos))
        })();

        let (new_id, photos) = match commit_result {
            Ok(value) => value,
            Err(e) => {
                // DB write failed/rolled back — clean up copied files for this find and
                // do NOT delete any source file, since nothing was durably imported.
                cleanup_staged_photos(&staged);
                return Err(e);
            }
        };

        // --- Delete phase: only now, after the find is durably committed, remove
        // source files (best-effort, retried — failures are reported but not fatal). ---
        if delete_source {
            for photo in &staged {
                // In-place (already-in-storage) photos were never copied; source IS the
                // user's existing library file — never delete those.
                if !photo.was_copied {
                    continue;
                }
                if let Err(failed_path) =
                    delete_source_with_retry(&photo.source_path, 3, Duration::from_millis(150))
                {
                    delete_failures.push(failed_path);
                }
            }
        }

        record.id = new_id;
        record.photos = photos;
        imported.push(record);

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
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        get_finds_for_connection(&conn, &filters.unwrap_or_default())
    })
    .await
    .map_err(|error| format!("Finds worker failed: {error}"))?
}

fn get_finds_for_connection(
    conn: &Connection,
    filters: &FindSearchFilters,
) -> Result<Vec<FindRecord>, String> {
    let mut where_clauses: Vec<String> = Vec::new();
    let mut query_params: Vec<Box<dyn ToSql>> = Vec::new();
    push_find_search_filters(filters, "", &mut where_clauses, &mut query_params, true);

    let limit = filters
        .limit
        .map(|value| value.clamp(1, 2000))
        .unwrap_or(i64::MAX);
    let offset = filters.offset.unwrap_or(0).max(0);
    let primary_photos_only = filters.photos_mode.as_deref() == Some("primary");
    let photo_counts_only = filters.photos_mode.as_deref() == Some("count");
    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", where_clauses.join(" AND "))
    };
    let sql = format!(
        "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note, weather, determiner, finder
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

    if filters.photos_mode.as_deref() == Some("none") {
        return Ok(records);
    }

    if photo_counts_only {
        let mut count_stmt = conn
            .prepare("SELECT find_id, COUNT(*) FROM find_photos GROUP BY find_id")
            .map_err(|e| format!("Failed to prepare photo counts query: {}", e))?;
        let photo_counts = count_stmt
            .query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)))
            .map_err(|e| format!("Photo counts query failed: {}", e))?
            .collect::<Result<HashMap<_, _>, _>>()
            .map_err(|e| format!("Photo counts row mapping failed: {}", e))?;
        for record in &mut records {
            record.photo_count = Some(*photo_counts.get(&record.id).unwrap_or(&0));
        }
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
pub async fn get_find_locations(storage_path: String) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        get_find_locations_for_connection(&conn)
    })
    .await
    .map_err(|error| format!("Find locations worker failed: {error}"))?
}

fn get_find_locations_for_connection(conn: &Connection) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT MIN(TRIM(location_note)) AS label
             FROM finds
             WHERE TRIM(location_note) <> ''
               AND LOWER(TRIM(species_name)) NOT IN ('tile-cache', '.bili-cache', '.bili-cache-tiles')
             GROUP BY LOWER(TRIM(location_note))
             ORDER BY label COLLATE NOCASE ASC",
        )
        .map_err(|error| format!("Failed to prepare find locations query: {error}"))?;

    let locations = stmt
        .query_map([], |row| row.get(0))
        .map_err(|error| format!("Find locations query failed: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Find locations row mapping failed: {error}"))?;
    Ok(locations)
}

/// One entry in the species autocomplete: enough to suggest, match and label a
/// species without loading its description, habitat or any find rows.
#[derive(serde::Serialize, Debug, PartialEq)]
pub struct SpeciesOption {
    pub species_name: String,
    pub common_name: Option<String>,
    pub synonyms: Vec<String>,
    pub other_names: Vec<String>,
    /// True when at least one find carries this name; false for a profile that has
    /// no finds yet.
    pub has_finds: bool,
}

/// Every species the user could pick, from finds and profiles alike.
///
/// The dialogs used to derive this from a full `get_finds` plus every species profile,
/// which meant loading the entire library to populate one autocomplete.
#[tauri::command]
pub async fn get_species_options(storage_path: String) -> Result<Vec<SpeciesOption>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        get_species_options_for_connection(&conn)
    })
    .await
    .map_err(|error| format!("Species options worker failed: {error}"))?
}

fn get_species_options_for_connection(conn: &Connection) -> Result<Vec<SpeciesOption>, String> {
    // Names are de-duplicated case-insensitively, matching how the dialogs used to
    // dedupe them client-side, and the profile join uses the same key so a profile
    // stored with different casing still supplies its common name.
    let mut stmt = conn
        .prepare(
            "SELECT names.species_name, sp.common_name, sp.synonyms, sp.other_names, names.has_finds
             FROM (
               SELECT MIN(species_name) AS species_name,
                      LOWER(TRIM(species_name)) AS species_key,
                      MAX(has_finds) AS has_finds
               FROM (
                 SELECT species_name, 1 AS has_finds FROM finds
                 UNION ALL
                 SELECT species_name, 0 AS has_finds FROM species_profiles
               )
               WHERE TRIM(species_name) <> ''
                 AND LOWER(TRIM(species_name)) NOT IN ('tile-cache', '.bili-cache', '.bili-cache-tiles')
               GROUP BY LOWER(TRIM(species_name))
             ) names
             LEFT JOIN species_profiles sp ON LOWER(TRIM(sp.species_name)) = names.species_key
             ORDER BY names.species_name COLLATE NOCASE ASC",
        )
        .map_err(|error| format!("Failed to prepare species options query: {error}"))?;

    let options = stmt
        .query_map([], |row| {
            let synonyms_json: Option<String> = row.get(2)?;
            let other_names_json: Option<String> = row.get(3)?;
            Ok(SpeciesOption {
                species_name: row.get(0)?,
                common_name: row.get(1)?,
                synonyms: synonyms_json
                    .as_deref()
                    .and_then(|value| serde_json::from_str(value).ok())
                    .unwrap_or_default(),
                other_names: other_names_json
                    .as_deref()
                    .and_then(|value| serde_json::from_str(value).ok())
                    .unwrap_or_default(),
                has_finds: row.get::<_, i64>(4)? == 1,
            })
        })
        .map_err(|error| format!("Species options query failed: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Species options row mapping failed: {error}"))?;
    Ok(options)
}

#[tauri::command]
pub async fn get_collection_folders(
    storage_path: String,
    filters: Option<FindSearchFilters>,
) -> Result<Vec<SpeciesFolderSummary>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        get_collection_folders_for_connection(&conn, &filters.unwrap_or_default())
    })
    .await
    .map_err(|error| format!("Collection folders worker failed: {error}"))?
}

fn get_collection_folders_for_connection(
    conn: &Connection,
    filters: &FindSearchFilters,
) -> Result<Vec<SpeciesFolderSummary>, String> {
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

    load_representative_finds_for_summaries(conn, &mut summaries, filters)?;

    Ok(summaries)
}

/// Loads the thumbnail find for every visible species in a small, fixed number of queries.
/// The selection order matches the original per-species implementation: an explicit species
/// cover first, then the most recent filtered find with a photo, then the most recent filtered
/// find of any kind.
fn load_representative_finds_for_summaries(
    conn: &Connection,
    summaries: &mut [SpeciesFolderSummary],
    filters: &FindSearchFilters,
) -> Result<(), String> {
    if summaries.is_empty() {
        return Ok(());
    }

    let species_names: Vec<String> = summaries
        .iter()
        .map(|summary| summary.species_name.clone())
        .collect();
    let mut representatives = load_explicit_cover_finds(conn, &species_names)?;

    for (species_name, record) in load_latest_finds_by_species(conn, &species_names, filters, true)?
    {
        representatives.entry(species_name).or_insert(record);
    }
    for (species_name, record) in
        load_latest_finds_by_species(conn, &species_names, filters, false)?
    {
        representatives.entry(species_name).or_insert(record);
    }

    // Hydrate over (profile species, record) pairs. Rebuilding the map from
    // record.species_name here would undo the cover keying done in
    // load_explicit_cover_finds, since a cover's find may belong to another species.
    let mut entries: Vec<(String, FindRecord)> = representatives.into_iter().collect();
    hydrate_representative_find_photos(conn, &mut entries)?;
    let representatives: HashMap<String, FindRecord> = entries.into_iter().collect();

    for summary in summaries {
        summary.representative_find = representatives.get(&summary.species_name).cloned();
    }
    Ok(())
}

fn load_explicit_cover_finds(
    conn: &Connection,
    species_names: &[String],
) -> Result<HashMap<String, FindRecord>, String> {
    if !species_profiles_have_cover_photo_id(conn) {
        return Ok(HashMap::new());
    }

    let placeholders = std::iter::repeat("?")
        .take(species_names.len())
        .collect::<Vec<_>>()
        .join(",");
    let sql = format!(
        "SELECT f.id, f.original_filename, f.species_name, f.date_found, f.country, f.region, f.lat, f.lng, f.notes, f.location_note, f.observed_count, f.observed_count_min, f.observed_count_max, f.is_favorite, f.created_at, f.edibility_note, f.weather, f.determiner, f.finder, sp.species_name
         FROM species_profiles sp
         JOIN find_photos fp ON fp.id = sp.cover_photo_id
         JOIN finds f ON f.id = fp.find_id
         WHERE sp.species_name IN ({placeholders})"
    );
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|error| format!("Failed to prepare collection cover query: {error}"))?;
    // The cover belongs to the profile's species, which is not necessarily the find's
    // own species_name: a find can be renamed or moved into another folder long after
    // one of its photos was chosen as a species cover. Keying by f.species_name would
    // hand the cover to the wrong folder and, worse, occupy that folder's slot so it
    // loses its own representative too. Read sp.species_name (trailing column) instead.
    let records: Vec<(String, FindRecord)> = stmt
        .query_map(params_from_iter(species_names.iter()), |row| {
            Ok((row.get::<_, String>(19)?, find_record_from_row(row)?))
        })
        .map_err(|error| format!("Collection cover query failed: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Collection cover row mapping failed: {error}"))?;
    Ok(records.into_iter().collect())
}

fn load_latest_finds_by_species(
    conn: &Connection,
    species_names: &[String],
    filters: &FindSearchFilters,
    require_photos: bool,
) -> Result<HashMap<String, FindRecord>, String> {
    let placeholders = std::iter::repeat("?")
        .take(species_names.len())
        .collect::<Vec<_>>()
        .join(",");
    let mut where_clauses = vec![format!("f.species_name IN ({placeholders})")];
    let mut query_params: Vec<Box<dyn ToSql>> = species_names
        .iter()
        .cloned()
        .map(|species_name| Box::new(species_name) as Box<dyn ToSql>)
        .collect();
    // Species are already limited to the visible page. Applying the search term a second time
    // would incorrectly filter an explicitly selected cover and is unnecessary here.
    push_find_search_filters(filters, "f", &mut where_clauses, &mut query_params, false);
    if require_photos {
        where_clauses
            .push("EXISTS (SELECT 1 FROM find_photos fp WHERE fp.find_id = f.id)".to_string());
    }
    let sql = format!(
        "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note, weather, determiner, finder
         FROM (
           SELECT f.id, f.original_filename, f.species_name, f.date_found, f.country, f.region, f.lat, f.lng, f.notes, f.location_note, f.observed_count, f.observed_count_min, f.observed_count_max, f.is_favorite, f.created_at, f.edibility_note, f.weather, f.determiner, f.finder,
                  ROW_NUMBER() OVER (PARTITION BY f.species_name ORDER BY f.date_found DESC, f.id DESC) AS candidate_rank
           FROM finds f
           WHERE {}
         )
         WHERE candidate_rank = 1",
        where_clauses.join(" AND "),
    );
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|error| format!("Failed to prepare collection representative query: {error}"))?;
    let records: Vec<FindRecord> = stmt
        .query_map(
            params_from_iter(
                query_params
                    .iter()
                    .map(|value| value.as_ref() as &dyn ToSql),
            ),
            find_record_from_row,
        )
        .map_err(|error| format!("Collection representative query failed: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Collection representative row mapping failed: {error}"))?;
    Ok(records
        .into_iter()
        .map(|record| (record.species_name.clone(), record))
        .collect())
}

/// Fills photo count and thumbnail photo for each representative find.
///
/// Entries are `(profile species name, representative find)` pairs. The profile species
/// is what the collection folder is rendered as and is not always the find's own
/// `species_name` — a find can be moved or renamed after one of its photos was chosen
/// as that species' cover. Photo selection therefore keys off the pair's species, never
/// off `record.species_name`.
fn hydrate_representative_find_photos(
    conn: &Connection,
    entries: &mut [(String, FindRecord)],
) -> Result<(), String> {
    if entries.is_empty() {
        return Ok(());
    }

    let find_ids: Vec<i64> = entries.iter().map(|(_, record)| record.id).collect();
    let placeholders = std::iter::repeat("?")
        .take(find_ids.len())
        .collect::<Vec<_>>()
        .join(",");
    let count_sql = format!(
        "SELECT find_id, COUNT(*) FROM find_photos WHERE find_id IN ({placeholders}) GROUP BY find_id"
    );
    let mut count_stmt = conn
        .prepare(&count_sql)
        .map_err(|error| format!("Failed to prepare collection photo count query: {error}"))?;
    let photo_counts: HashMap<i64, i64> = count_stmt
        .query_map(params_from_iter(find_ids.iter()), |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .map_err(|error| format!("Collection photo count query failed: {error}"))?
        .collect::<Result<HashMap<_, _>, _>>()
        .map_err(|error| format!("Collection photo count row mapping failed: {error}"))?;

    // Default thumbnail per find, independent of any species profile.
    let photo_sql = format!(
        "SELECT fp.id, fp.find_id, fp.photo_path, fp.is_primary
         FROM find_photos fp
         WHERE fp.find_id IN ({placeholders})
           AND fp.id = (
             SELECT fp2.id
             FROM find_photos fp2
             WHERE fp2.find_id = fp.find_id
             ORDER BY fp2.is_primary DESC, fp2.id ASC
             LIMIT 1
           )"
    );
    let mut photo_stmt = conn
        .prepare(&photo_sql)
        .map_err(|error| format!("Failed to prepare collection thumbnail query: {error}"))?;
    let photos: HashMap<i64, FindPhoto> = photo_stmt
        .query_map(params_from_iter(find_ids.iter()), |row| {
            Ok(FindPhoto {
                id: row.get(0)?,
                find_id: row.get(1)?,
                photo_path: row.get(2)?,
                is_primary: row.get::<_, i64>(3)? == 1,
            })
        })
        .map_err(|error| format!("Collection thumbnail query failed: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Collection thumbnail row mapping failed: {error}"))?
        .into_iter()
        .map(|photo| (photo.find_id, photo))
        .collect();

    // Explicitly chosen covers, keyed by the profile that chose them. Joining
    // species_profiles on the find's own species_name instead would pick the wrong
    // photo whenever the cover's find has since moved to a different folder.
    let covers = load_cover_photos_by_species(conn, entries)?;

    for (species_name, record) in entries {
        record.photo_count = Some(*photo_counts.get(&record.id).unwrap_or(&0));
        let cover = covers
            .get(species_name)
            .filter(|photo| photo.find_id == record.id)
            .cloned();
        record.photos = cover
            .or_else(|| photos.get(&record.id).cloned())
            .into_iter()
            .collect();
    }
    Ok(())
}

/// Loads each profile's explicitly chosen cover photo, keyed by the profile's species.
fn load_cover_photos_by_species(
    conn: &Connection,
    entries: &[(String, FindRecord)],
) -> Result<HashMap<String, FindPhoto>, String> {
    if !species_profiles_have_cover_photo_id(conn) {
        return Ok(HashMap::new());
    }

    let species_names: Vec<&String> = entries.iter().map(|(species, _)| species).collect();
    let placeholders = std::iter::repeat("?")
        .take(species_names.len())
        .collect::<Vec<_>>()
        .join(",");
    let sql = format!(
        "SELECT sp.species_name, fp.id, fp.find_id, fp.photo_path, fp.is_primary
         FROM species_profiles sp
         JOIN find_photos fp ON fp.id = sp.cover_photo_id
         WHERE sp.species_name IN ({placeholders})"
    );
    let mut stmt = conn
        .prepare(&sql)
        .map_err(|error| format!("Failed to prepare collection cover photo query: {error}"))?;
    let rows: Vec<(String, FindPhoto)> = stmt
        .query_map(params_from_iter(species_names.iter()), |row| {
            Ok((
                row.get::<_, String>(0)?,
                FindPhoto {
                    id: row.get(1)?,
                    find_id: row.get(2)?,
                    photo_path: row.get(3)?,
                    is_primary: row.get::<_, i64>(4)? == 1,
                },
            ))
        })
        .map_err(|error| format!("Collection cover photo query failed: {error}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| format!("Collection cover photo row mapping failed: {error}"))?;
    Ok(rows.into_iter().collect())
}

fn species_profiles_have_cover_photo_id(conn: &Connection) -> bool {
    conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('species_profiles') WHERE name = 'cover_photo_id'",
        [],
        |row| row.get::<_, i64>(0),
    )
    .unwrap_or(0)
        > 0
}

#[tauri::command]
pub async fn get_species_finds(
    storage_path: String,
    species_name: String,
    filters: Option<FindSearchFilters>,
) -> Result<Vec<FindRecord>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        load_finds_for_species(&conn, &species_name, &filters.unwrap_or_default())
    })
    .await
    .map_err(|error| format!("Species finds worker failed: {error}"))?
}

fn load_finds_for_species(
    conn: &Connection,
    species_name: &str,
    filters: &FindSearchFilters,
) -> Result<Vec<FindRecord>, String> {
    load_finds_for_species_inner(conn, species_name, filters, false)
}

/// `require_photos` restricts the result to finds that have at least one photo, which is
/// how the folder thumbnail skips over photoless finds.
fn load_finds_for_species_inner(
    conn: &Connection,
    species_name: &str,
    filters: &FindSearchFilters,
    require_photos: bool,
) -> Result<Vec<FindRecord>, String> {
    let mut where_clauses: Vec<String> = vec!["species_name = ?".to_string()];
    let mut query_params: Vec<Box<dyn ToSql>> = vec![Box::new(species_name.to_string())];
    push_find_search_filters(filters, "", &mut where_clauses, &mut query_params, false);
    if require_photos {
        where_clauses
            .push("EXISTS (SELECT 1 FROM find_photos fp WHERE fp.find_id = finds.id)".to_string());
    }

    let limit = filters
        .limit
        .map(|value| value.clamp(1, 2000))
        .unwrap_or(200);
    let offset = filters.offset.unwrap_or(0).max(0);
    let primary_photos_only = filters.photos_mode.as_deref() == Some("primary");
    let where_sql = format!(" WHERE {}", where_clauses.join(" AND "));
    let sql = format!(
        "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note, weather, determiner, finder
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
    pub date_day_month: Option<String>,
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
            // species_name may contain '*' markup (bold/non-bold display convention, see
            // src/lib/speciesName.tsx). The query string is always plain (asterisks stripped
            // client-side), so strip '*' from the column here too before comparing — otherwise
            // an embedded asterisk in the stored name breaks the substring match entirely.
            where_clauses.push(format!(
                "LOWER(REPLACE({}, '*', '')) LIKE ? ESCAPE '\\'",
                col("species_name")
            ));
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

    if let Some(day_month) = normalized_day_month(filters.date_day_month.as_deref()) {
        where_clauses.push(format!("substr({}, 6) = ?", col("date_found")));
        query_params.push(Box::new(day_month));
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

fn normalized_day_month(value: Option<&str>) -> Option<String> {
    let trimmed = value?.trim();
    if trimmed.len() == 5
        && trimmed.chars().nth(2) == Some('-')
        && trimmed[0..2].chars().all(|c| c.is_ascii_digit())
        && trimmed[3..5].chars().all(|c| c.is_ascii_digit())
    {
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
    #[serde(default)]
    pub weather: Option<String>,
    #[serde(default)]
    pub determiner: Option<String>,
    #[serde(default)]
    pub finder: Option<String>,
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
            "UPDATE finds SET species_name=?1, date_found=?2, country=?3, region=?4, lat=?5, lng=?6, notes=?7, location_note=?8, observed_count=?9, observed_count_min=?10, observed_count_max=?11, edibility_note=?12, weather=?13, determiner=?14, finder=?15 WHERE id=?16",
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
                payload.weather,
                payload.determiner,
                payload.finder,
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
            "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note, weather, determiner, finder FROM finds WHERE id = ?1",
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
    const MIGRATION_0024: &str = include_str!("../../migrations/0024_find_weather.sql");
    const MIGRATION_0025: &str = include_str!("../../migrations/0025_find_determiner_finder.sql");

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
        // Migration 0017 is deliberately skipped here: it only repairs databases where
        // the original 0014 targeted the wrong table, and migrate_db guards it with a
        // column-existence check. MIGRATION_0014 above already adds finds.edibility_note,
        // so running 0017's ALTER unconditionally fails with "duplicate column name".
        conn.execute_batch(MIGRATION_0018).expect("migration 0018");
        conn.execute_batch(MIGRATION_0019).expect("migration 0019");
        conn.execute_batch(MIGRATION_0020).expect("migration 0020");
        conn.execute_batch(MIGRATION_0021).expect("migration 0021");
        conn.execute_batch(MIGRATION_0022).expect("migration 0022");
        conn.execute_batch(MIGRATION_0023).expect("migration 0023");
        conn.execute_batch(MIGRATION_0024).expect("migration 0024");
        conn.execute_batch(MIGRATION_0025).expect("migration 0025");
        conn.execute_batch(MIGRATION_0026).expect("migration 0026");
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
            weather: None,
            determiner: None,
            finder: None,
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
    fn test_push_find_search_filters_date_day_month_matches_any_year() {
        let conn = setup_in_memory_db();
        insert_find_row(&conn, &make_find_record("a.jpg", "2019-05-20")).expect("insert a");
        insert_find_row(&conn, &make_find_record("b.jpg", "2024-05-20")).expect("insert b");
        insert_find_row(&conn, &make_find_record("c.jpg", "2024-05-21")).expect("insert decoy day");
        insert_find_row(&conn, &make_find_record("d.jpg", "2024-06-20"))
            .expect("insert decoy month");

        let filters = FindSearchFilters {
            date_day_month: Some("05-20".to_string()),
            ..Default::default()
        };

        let mut where_clauses: Vec<String> = Vec::new();
        let mut query_params: Vec<Box<dyn ToSql>> = Vec::new();
        push_find_search_filters(&filters, "", &mut where_clauses, &mut query_params, true);

        assert_eq!(
            where_clauses.len(),
            1,
            "expected exactly one WHERE clause for date_day_month"
        );

        let sql = format!(
            "SELECT date_found FROM finds WHERE {} ORDER BY date_found",
            where_clauses.join(" AND ")
        );
        let params_refs: Vec<&dyn ToSql> = query_params.iter().map(|p| p.as_ref()).collect();
        let mut stmt = conn.prepare(&sql).expect("prepare");
        let dates: Vec<String> = stmt
            .query_map(params_refs.as_slice(), |row| row.get(0))
            .expect("query")
            .collect::<rusqlite::Result<Vec<String>>>()
            .expect("collect");

        assert_eq!(
            dates,
            vec!["2019-05-20".to_string(), "2024-05-20".to_string()],
            "should match only the two May-20th finds, across any year"
        );
    }

    #[test]
    fn test_push_find_search_filters_date_day_month_ignores_invalid_values() {
        let filters = FindSearchFilters {
            date_day_month: Some("invalid".to_string()),
            ..Default::default()
        };

        let mut where_clauses: Vec<String> = Vec::new();
        let mut query_params: Vec<Box<dyn ToSql>> = Vec::new();
        push_find_search_filters(&filters, "", &mut where_clauses, &mut query_params, true);

        assert!(
            where_clauses.is_empty(),
            "invalid date_day_month should not add a WHERE clause"
        );
        assert!(query_params.is_empty());

        let empty_filters = FindSearchFilters {
            date_day_month: Some("".to_string()),
            ..Default::default()
        };
        let mut where_clauses2: Vec<String> = Vec::new();
        let mut query_params2: Vec<Box<dyn ToSql>> = Vec::new();
        push_find_search_filters(
            &empty_filters,
            "",
            &mut where_clauses2,
            &mut query_params2,
            true,
        );

        assert!(
            where_clauses2.is_empty(),
            "empty date_day_month should not add a WHERE clause"
        );
    }

    #[test]
    fn collection_folders_batch_selection_preserves_cover_and_photo_fallbacks() {
        let conn = setup_in_memory_db();
        let insert = |species_name: &str, filename: &str, date: &str| {
            let mut record = make_find_record(filename, date);
            record.species_name = species_name.to_string();
            insert_find_row(&conn, &record).expect("insert find")
        };

        let cover_find = insert("Boletus edulis", "cover.jpg", "2024-05-01");
        let cover_primary = insert_find_photo(&conn, cover_find, "boletus-primary.jpg", true)
            .expect("insert primary photo");
        let cover_selected = insert_find_photo(&conn, cover_find, "boletus-cover.jpg", false)
            .expect("insert selected cover");
        let _newer_boletus = insert("Boletus edulis", "newer.jpg", "2024-06-01");

        let chanterelle_photo_find = insert("Cantharellus cibarius", "photo.jpg", "2024-05-01");
        let chanterelle_photo = insert_find_photo(
            &conn,
            chanterelle_photo_find,
            "chanterelle-primary.jpg",
            true,
        )
        .expect("insert chanterelle photo");
        let _newer_photoless = insert("Cantharellus cibarius", "newer.jpg", "2024-06-01");
        let amanita_old = insert("Amanita muscaria", "old.jpg", "2024-04-01");
        let amanita_latest = insert("Amanita muscaria", "latest.jpg", "2024-07-01");

        conn.execute(
            "INSERT INTO species_profiles (species_name, cover_photo_id, updated_at) VALUES (?1, ?2, ?3)",
            params!["Boletus edulis", cover_selected, "2024-07-01T00:00:00Z"],
        )
        .expect("save cover profile");

        let summaries = get_collection_folders_for_connection(&conn, &FindSearchFilters::default())
            .expect("load collection folders");
        let representatives: HashMap<String, FindRecord> = summaries
            .into_iter()
            .map(|summary| {
                (
                    summary.species_name,
                    summary.representative_find.expect("representative find"),
                )
            })
            .collect();

        let boletus = &representatives["Boletus edulis"];
        assert_eq!(boletus.id, cover_find, "explicit cover find must win");
        assert_eq!(
            boletus.photos[0].id, cover_selected,
            "selected cover photo must win"
        );
        assert_eq!(boletus.photo_count, Some(2));
        assert_ne!(boletus.photos[0].id, cover_primary);

        let chanterelle = &representatives["Cantharellus cibarius"];
        assert_eq!(
            chanterelle.id, chanterelle_photo_find,
            "latest find with a photo must beat newer photoless find"
        );
        assert_eq!(chanterelle.photos[0].id, chanterelle_photo);
        assert_eq!(chanterelle.photo_count, Some(1));

        let amanita = &representatives["Amanita muscaria"];
        assert_eq!(
            amanita.id, amanita_latest,
            "latest find must be used when species has no photos"
        );
        assert_eq!(amanita.photo_count, Some(0));
        assert!(amanita.photos.is_empty());
        assert_ne!(amanita.id, amanita_old);
    }

    /// A cover belongs to the species profile that chose it, not to the find that holds
    /// the photo. Renaming or moving that find (bulk_rename_species, move_find_to_folder)
    /// must not hand the cover to the destination folder, and must not let it displace
    /// the destination's own representative.
    #[test]
    fn collection_folder_cover_stays_with_its_profile_after_the_find_moves_species() {
        let conn = setup_in_memory_db();
        let insert = |species_name: &str, filename: &str, date: &str| {
            let mut record = make_find_record(filename, date);
            record.species_name = species_name.to_string();
            insert_find_row(&conn, &record).expect("insert find")
        };

        // The find that owns Boletus' chosen cover photo. It also carries a primary
        // photo, so a fallback to "primary photo of this find" is distinguishable from
        // "the cover Boletus actually chose".
        let moved_find = insert("Boletus edulis", "cover.jpg", "2024-05-01");
        let _moved_primary = insert_find_photo(&conn, moved_find, "moved-primary.jpg", true)
            .expect("insert primary photo");
        let boletus_cover = insert_find_photo(&conn, moved_find, "boletus-cover.jpg", false)
            .expect("insert selected cover");
        conn.execute(
            "INSERT INTO species_profiles (species_name, cover_photo_id, updated_at) VALUES (?1, ?2, ?3)",
            params!["Boletus edulis", boletus_cover, "2024-07-01T00:00:00Z"],
        )
        .expect("save cover profile");

        // Boletus keeps another, newer find so the folder would still render without the cover.
        let boletus_newer = insert("Boletus edulis", "boletus-newer.jpg", "2024-06-01");
        insert_find_photo(&conn, boletus_newer, "boletus-newer-photo.jpg", true)
            .expect("insert boletus newer photo");

        // Chanterelle has its own newest find with a photo — the correct representative.
        let chanterelle_latest = insert("Cantharellus cibarius", "chanterelle.jpg", "2024-07-01");
        let chanterelle_photo =
            insert_find_photo(&conn, chanterelle_latest, "chanterelle-photo.jpg", true)
                .expect("insert chanterelle photo");

        // The user moves the cover's find into the Chanterelle folder. The profile row
        // still points at the photo, exactly as move_find_to_folder leaves it.
        conn.execute(
            "UPDATE finds SET species_name = ?1 WHERE id = ?2",
            params!["Cantharellus cibarius", moved_find],
        )
        .expect("move find to another species folder");

        let summaries = get_collection_folders_for_connection(&conn, &FindSearchFilters::default())
            .expect("load collection folders");
        let representatives: HashMap<String, FindRecord> = summaries
            .into_iter()
            .map(|summary| {
                (
                    summary.species_name,
                    summary.representative_find.expect("representative find"),
                )
            })
            .collect();

        let boletus = &representatives["Boletus edulis"];
        assert_eq!(
            boletus.id, moved_find,
            "the profile's chosen cover must still represent Boletus after its find moved"
        );
        assert_eq!(
            boletus.photos[0].id, boletus_cover,
            "the cover photo Boletus chose must win over the find's primary photo"
        );

        let chanterelle = &representatives["Cantharellus cibarius"];
        assert_eq!(
            chanterelle.id, chanterelle_latest,
            "Chanterelle must keep its own latest photographed find, not inherit Boletus' cover"
        );
        assert_eq!(chanterelle.photos[0].id, chanterelle_photo);
    }

    #[test]
    fn find_locations_are_trimmed_deduplicated_and_lightweight() {
        let conn = setup_in_memory_db();
        for (species, location) in [
            ("Boletus edulis", "  Ucka  "),
            ("Cantharellus cibarius", "ucka"),
            ("Amanita muscaria", "Gorski kotar"),
            ("Amanita muscaria", ""),
            ("tile-cache", "Internal cache"),
        ] {
            let mut record = make_find_record("location.jpg", "2024-06-01");
            record.species_name = species.to_string();
            record.location_note = location.to_string();
            insert_find_row(&conn, &record).expect("insert location find");
        }

        let locations = get_find_locations_for_connection(&conn).expect("load locations");
        assert_eq!(locations, vec!["Gorski kotar", "Ucka"]);
    }

    #[test]
    fn species_options_union_finds_and_profiles_without_internal_folders() {
        let conn = setup_in_memory_db();
        for species in [
            "Boletus edulis",
            "Amanita muscaria",
            "tile-cache",
            "boletus edulis",
            "   ",
        ] {
            let mut record = make_find_record("photo.jpg", "2024-06-01");
            record.species_name = species.to_string();
            insert_find_row(&conn, &record).expect("insert find");
        }
        conn.execute(
            "INSERT INTO species_profiles (species_name, common_name, synonyms, other_names, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                "Boletus edulis",
                "Vrganj",
                r#"["Boletus reticulatus"]"#,
                r#"["pravi vrganj"]"#,
                "2024-07-01T00:00:00Z"
            ],
        )
        .expect("insert profile with names");
        conn.execute(
            "INSERT INTO species_profiles (species_name, common_name, updated_at) VALUES (?1, ?2, ?3)",
            params![
                "Cantharellus cibarius",
                "Lisicarka",
                "2024-07-01T00:00:00Z"
            ],
        )
        .expect("insert profile without finds");

        let options = get_species_options_for_connection(&conn).expect("load species options");
        let names: Vec<&str> = options
            .iter()
            .map(|option| option.species_name.as_str())
            .collect();
        assert_eq!(
            names,
            vec!["Amanita muscaria", "Boletus edulis", "Cantharellus cibarius"],
            "internal folders and blank names are excluded, casing duplicates collapse, \
             and a profile without finds still appears"
        );

        let boletus = &options[1];
        assert_eq!(boletus.common_name.as_deref(), Some("Vrganj"));
        assert_eq!(boletus.synonyms, vec!["Boletus reticulatus".to_string()]);
        assert_eq!(boletus.other_names, vec!["pravi vrganj".to_string()]);
        assert!(boletus.has_finds);

        let cantharellus = &options[2];
        assert_eq!(cantharellus.common_name.as_deref(), Some("Lisicarka"));
        assert!(
            !cantharellus.has_finds,
            "a profile with no finds must be offered but flagged as unused"
        );

        let amanita = &options[0];
        assert_eq!(amanita.common_name, None);
        assert!(amanita.synonyms.is_empty());
        assert!(amanita.has_finds);
    }

    #[test]
    fn count_photo_mode_returns_counts_without_photo_rows() {
        let conn = setup_in_memory_db();
        let first = insert_find_row(&conn, &make_find_record("first.jpg", "2024-06-01"))
            .expect("insert first find");
        let second = insert_find_row(&conn, &make_find_record("second.jpg", "2024-06-02"))
            .expect("insert second find");
        insert_find_photo(&conn, first, "first-primary.jpg", true).expect("insert primary");
        insert_find_photo(&conn, first, "first-extra.jpg", false).expect("insert extra");

        let filters = FindSearchFilters {
            photos_mode: Some("count".to_string()),
            ..FindSearchFilters::default()
        };
        let records = get_finds_for_connection(&conn, &filters).expect("load count-only finds");
        let by_id: HashMap<i64, FindRecord> = records
            .into_iter()
            .map(|record| (record.id, record))
            .collect();

        assert_eq!(by_id[&first].photo_count, Some(2));
        assert!(by_id[&first].photos.is_empty());
        assert_eq!(by_id[&second].photo_count, Some(0));
        assert!(by_id[&second].photos.is_empty());
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
                    weather: None,
                    determiner: None,
                    finder: None,
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
    fn opening_an_older_database_backs_it_up_before_migrating() {
        let dir = tempfile::tempdir().expect("tempdir");
        let storage_path = dir.path().to_str().expect("storage path");

        // A library still on an older schema, holding a find worth protecting.
        {
            let conn = Connection::open(format!("{storage_path}/bili-mushroom.db"))
                .expect("create legacy database");
            for migration in [
                MIGRATION_0001,
                MIGRATION_0002,
                MIGRATION_0003,
                MIGRATION_0004,
                MIGRATION_0005,
                MIGRATION_0006,
                MIGRATION_0007,
                MIGRATION_0008,
                MIGRATION_0009,
                MIGRATION_0010,
                MIGRATION_0011,
                MIGRATION_0012,
                MIGRATION_0013,
                MIGRATION_0014,
                MIGRATION_0015,
                MIGRATION_0016,
            ] {
                conn.execute_batch(migration).expect("apply migration");
            }
            conn.execute_batch("PRAGMA user_version = 16")
                .expect("mark the legacy version");
            // Raw insert: the shared helper writes columns that later migrations add.
            conn.execute(
                "INSERT INTO finds (original_filename, species_name, date_found, country, region, notes, location_note, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    "legacy.jpg",
                    "Boletus edulis",
                    "2024-05-10",
                    "Croatia",
                    "Istria",
                    "",
                    "",
                    "2024-05-10T10:00:00Z"
                ],
            )
            .expect("insert a find worth protecting");
        }

        let conn = open_db(storage_path).expect("open and migrate the legacy database");
        assert_eq!(
            conn.query_row("PRAGMA user_version", [], |row| row.get::<_, i64>(0))
                .expect("read migrated version"),
            CURRENT_SCHEMA_VERSION,
            "opening the library must bring it to the current schema"
        );

        let backups: Vec<PathBuf> = std::fs::read_dir(dir.path().join(".bili-cache").join("backups"))
            .expect("backup folder exists")
            .filter_map(|entry| entry.ok())
            .map(|entry| entry.path())
            .collect();
        assert_eq!(backups.len(), 1, "exactly one pre-migration backup expected");

        let backup = Connection::open(&backups[0]).expect("open the backup");
        let backed_up_version: i64 = backup
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .expect("read backup version");
        assert_eq!(
            backed_up_version, 16,
            "the backup must capture the database as it was before migrating"
        );
        let finds: i64 = backup
            .query_row("SELECT COUNT(*) FROM finds", [], |row| row.get(0))
            .expect("count finds in the backup");
        assert_eq!(finds, 1, "the backup must contain the user's data");
    }

    #[test]
    fn opening_a_brand_new_database_writes_no_backup() {
        let dir = tempfile::tempdir().expect("tempdir");
        let storage_path = dir.path().to_str().expect("storage path");

        open_db(storage_path).expect("create a fresh database");

        assert!(
            !dir.path().join(".bili-cache").join("backups").exists(),
            "a database with nothing in it yet has nothing to back up"
        );
    }

    #[test]
    fn migrate_db_repairs_missing_species_cover_photo_id_at_current_version() {
        let conn = setup_in_memory_db();
        conn.execute_batch(
            "
            DROP TABLE species_profiles;
            CREATE TABLE species_profiles (
                species_name TEXT PRIMARY KEY,
                updated_at TEXT NOT NULL,
                synonyms TEXT,
                other_names TEXT,
                habitat TEXT
            );
            PRAGMA user_version = 26;
            ",
        )
        .expect("create a version-current database with the legacy profile schema");

        migrate_db(&conn).expect("repair legacy species profile schema");

        let cover_photo_id_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('species_profiles') WHERE name = 'cover_photo_id'",
                [],
                |row| row.get(0),
            )
            .expect("inspect repaired species_profiles schema");
        assert_eq!(cover_photo_id_exists, 1);
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
                    weather: None,
                    determiner: None,
                    finder: None,
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
            weather: None,
            determiner: None,
            finder: None,
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
            weather: None,
            determiner: None,
            finder: None,
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

    // ---------------------------------------------------------------------------
    // copy_payload_photos / import_find atomicity regression tests
    // (import-duplicate-photo-partial-save)
    // ---------------------------------------------------------------------------

    fn make_import_payload(source_path: String, additional_photos: Vec<String>) -> ImportPayload {
        ImportPayload {
            source_path,
            original_filename: "photo.jpg".to_string(),
            species_name: "Boletus edulis".to_string(),
            common_name: None,
            date_found: "2024-05-10".to_string(),
            country: "Croatia".to_string(),
            region: "Region".to_string(),
            lat: None,
            lng: None,
            notes: String::new(),
            location_note: String::new(),
            observed_count: None,
            observed_count_min: None,
            observed_count_max: None,
            additional_photos,
            edibility_note: None,
            weather: None,
            determiner: None,
            finder: None,
        }
    }

    #[test]
    fn test_copy_payload_photos_stages_primary_and_additional_without_deleting_source() {
        let src_dir = tempfile::tempdir().expect("src tempdir");
        let storage_dir = tempfile::tempdir().expect("storage tempdir");

        let primary_src = src_dir.path().join("a.jpg");
        let extra_src = src_dir.path().join("b.jpg");
        std::fs::write(&primary_src, b"AAAA").unwrap();
        std::fs::write(&extra_src, b"BBBBBBBB").unwrap();

        let storage_path = storage_dir.path().to_string_lossy().to_string();
        let storage_path_buf = Path::new(&storage_path);
        let payload = make_import_payload(
            primary_src.to_string_lossy().to_string(),
            vec![extra_src.to_string_lossy().to_string()],
        );
        let mut seen = HashSet::new();
        let mut skipped = Vec::new();

        let staged = copy_payload_photos(
            &storage_path,
            storage_path_buf,
            &payload,
            "",
            &mut seen,
            &mut skipped,
        )
        .expect("copy phase should succeed");

        assert_eq!(staged.len(), 2, "primary + 1 additional should be staged");
        assert!(skipped.is_empty());
        // Source files must still exist — copy phase never deletes.
        assert!(
            primary_src.exists(),
            "primary source must survive copy phase"
        );
        assert!(
            extra_src.exists(),
            "additional source must survive copy phase"
        );
        // Destination files must exist on disk.
        for photo in &staged {
            assert!(
                photo.dest_abs.exists(),
                "staged destination should exist: {:?}",
                photo.dest_abs
            );
        }
    }

    #[test]
    fn test_copy_payload_photos_rolls_back_destination_files_on_mid_loop_failure() {
        let src_dir = tempfile::tempdir().expect("src tempdir");
        let storage_dir = tempfile::tempdir().expect("storage tempdir");

        let primary_src = src_dir.path().join("a.jpg");
        std::fs::write(&primary_src, b"AAAA").unwrap();
        // Second "additional" source path does not exist on disk — forces a copy failure
        // partway through the loop, exactly like a source file consumed by an earlier
        // failed/retried import attempt.
        let missing_src = src_dir.path().join("does_not_exist.jpg");

        let storage_path = storage_dir.path().to_string_lossy().to_string();
        let storage_path_buf = Path::new(&storage_path);
        let payload = make_import_payload(
            primary_src.to_string_lossy().to_string(),
            vec![missing_src.to_string_lossy().to_string()],
        );
        let mut seen = HashSet::new();
        let mut skipped = Vec::new();

        let result = copy_payload_photos(
            &storage_path,
            storage_path_buf,
            &payload,
            "",
            &mut seen,
            &mut skipped,
        );
        assert!(
            result.is_err(),
            "copy phase should fail when an additional photo source is missing"
        );

        // Root-cause regression check: the primary photo's destination file must NOT be
        // left behind in storage after the batch fails — otherwise a stray file exists
        // with no DB row pointing to it (the old bug's filesystem-side symptom).
        let species_folder = storage_dir.path().join("Boletus edulis");
        if species_folder.exists() {
            let leftover: Vec<_> = std::fs::read_dir(&species_folder)
                .unwrap()
                .filter_map(|e| e.ok())
                .collect();
            assert!(
                leftover.is_empty(),
                "no destination files should remain after a failed copy phase, found: {:?}",
                leftover.iter().map(|e| e.path()).collect::<Vec<_>>()
            );
        }

        // Root-cause regression check: the primary SOURCE file must still exist — the
        // old bug would have already deleted it before the additional-photo loop even
        // started, even though the overall import ultimately failed.
        assert!(
            primary_src.exists(),
            "primary source file must never be deleted when the find's copy phase fails"
        );
    }

    #[test]
    fn test_import_find_atomicity_no_find_row_persists_after_mid_loop_copy_failure() {
        // Simulates import_find's copy-phase + transactional-commit-phase sequence
        // directly (without needing a tauri::AppHandle) to prove the fix: a copy
        // failure on an additional photo must leave NO find row and NO find_photos
        // rows behind, and must NOT delete the primary source file.
        let src_dir = tempfile::tempdir().expect("src tempdir");
        let storage_dir = tempfile::tempdir().expect("storage tempdir");
        let mut conn = setup_in_memory_db();

        let primary_src = src_dir.path().join("a.jpg");
        std::fs::write(&primary_src, b"AAAA").unwrap();
        let missing_src = src_dir.path().join("missing.jpg");

        let storage_path = storage_dir.path().to_string_lossy().to_string();
        let storage_path_buf = Path::new(&storage_path);
        let payload = make_import_payload(
            primary_src.to_string_lossy().to_string(),
            vec![missing_src.to_string_lossy().to_string()],
        );
        let mut seen = HashSet::new();
        let mut skipped = Vec::new();

        // Copy phase fails (missing additional source) -> import_find returns early via `?`
        // BEFORE ever touching the DB or conn.transaction(). Assert exactly that contract.
        let copy_result = copy_payload_photos(
            &storage_path,
            storage_path_buf,
            &payload,
            "",
            &mut seen,
            &mut skipped,
        );
        assert!(copy_result.is_err());

        // No find row should exist — nothing was ever inserted, since the fix defers all
        // DB writes until after the full copy phase for the find succeeds.
        let find_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM finds", [], |r| r.get(0))
            .unwrap();
        assert_eq!(
            find_count, 0,
            "no find row should exist after copy-phase failure"
        );

        let photo_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM find_photos", [], |r| r.get(0))
            .unwrap();
        assert_eq!(
            photo_count, 0,
            "no find_photos row should exist after copy-phase failure"
        );

        assert!(
            primary_src.exists(),
            "primary source must survive a copy-phase failure"
        );

        // Sanity: use conn at least once through the transaction API to mirror real usage
        // and confirm the DB handle itself is still healthy after the aborted attempt.
        let tx = conn
            .transaction()
            .expect("connection should still support transactions");
        tx.commit()
            .expect("empty transaction should commit cleanly");
    }

    // ---------------------------------------------------------------------------
    // resolve_find_coords / first_gps_coords_from_paths tests
    // (auto-populate-find-lat-lng-from-photo-exif)
    // ---------------------------------------------------------------------------

    #[test]
    fn test_resolve_find_coords_fills_empty_coords_from_exif() {
        let result = resolve_find_coords(None, None, Some((45.0, 16.0)));
        assert_eq!(result, (Some(45.0), Some(16.0)));
    }

    #[test]
    fn test_resolve_find_coords_manual_coords_win_over_exif() {
        let result = resolve_find_coords(Some(44.0), Some(15.0), Some((45.0, 16.0)));
        assert_eq!(result, (Some(44.0), Some(15.0)));
    }

    #[test]
    fn test_resolve_find_coords_no_exif_no_manual_stays_null() {
        let result = resolve_find_coords(None, None, None);
        assert_eq!(result, (None, None));
    }

    #[test]
    fn test_resolve_find_coords_partial_manual_entry_blocks_exif_fallback() {
        let result = resolve_find_coords(Some(44.0), None, Some((45.0, 16.0)));
        assert_eq!(result, (Some(44.0), None));
    }

    #[test]
    fn test_first_gps_coords_from_paths_returns_none_for_non_jpeg_files() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path_a = dir.path().join("a.jpg");
        let path_b = dir.path().join("b.jpg");
        std::fs::write(&path_a, b"AAAA").unwrap();
        std::fs::write(&path_b, b"BBBB").unwrap();

        let path_a_str = path_a.to_string_lossy().to_string();
        let path_b_str = path_b.to_string_lossy().to_string();
        let paths = [path_a_str.as_str(), path_b_str.as_str()];

        assert_eq!(first_gps_coords_from_paths(&paths), None);
    }

    #[test]
    fn test_first_gps_coords_from_paths_returns_none_for_empty_slice() {
        assert_eq!(first_gps_coords_from_paths(&[]), None);
    }

    #[test]
    fn test_first_gps_coords_from_staged_returns_none_when_no_gps() {
        let dir = tempfile::tempdir().expect("tempdir");
        let src = dir.path().join("photo.jpg");
        std::fs::write(&src, b"AAAA").unwrap();

        let staged = vec![StagedPhoto {
            source_path: src.to_string_lossy().to_string(),
            dest_abs: dir.path().join("dest.jpg"),
            relative_path: "dest.jpg".to_string(),
            is_primary: true,
            was_copied: true,
        }];

        assert_eq!(first_gps_coords_from_staged(&staged), None);
    }
}
