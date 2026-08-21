use base64::Engine;
use std::collections::HashMap;

#[cfg(test)]
use rusqlite::params;

use crate::commands::import::open_db;

const INTERNAL_SPECIES_FILTER: &str =
    "LOWER(TRIM(species_name)) NOT IN ('tile-cache', '.bili-cache', '.bili-cache-tiles')";

// ---------------------------------------------------------------------------
// Structs
// ---------------------------------------------------------------------------

#[derive(serde::Serialize, Clone, Debug)]
pub struct StatsCards {
    pub total_finds: i64,
    pub unique_species: i64,
    pub locations_visited: i64,
    pub most_active_month: Option<String>, // "YYYY-MM" format
}

/// Minimal find payload required by the statistics screen.
#[derive(serde::Serialize, Clone, Debug, PartialEq)]
pub struct StatsFind {
    pub id: i64,
    pub species_name: String,
    pub date_found: String,
    pub country: String,
    pub region: String,
    pub location_note: String,
    pub notes: String,
    pub observed_count: Option<i64>,
    pub observed_count_min: Option<i64>,
    pub observed_count_max: Option<i64>,
    pub photo_count: i64,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct TopSpot {
    pub country: String,
    pub region: String,
    pub location_note: String,
    pub count: i64,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct BestMonth {
    pub month_num: u8, // 1-12
    pub count: i64,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct CalendarEntry {
    pub month: u8, // 1-12
    pub species_name: String,
    pub date_found: String,
    pub location_note: String,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct SpeciesLocation {
    pub country: String,
    pub region: String,
    pub location_note: String,
}

#[derive(serde::Serialize, Clone, Debug)]
pub struct SpeciesStatSummary {
    pub species_name: String,
    pub find_count: i64,
    pub first_find: String,
    pub best_month: Option<String>, // "YYYY-MM" format
    pub locations: Vec<SpeciesLocation>,
    pub observed_min: Option<i64>,
    pub observed_max: Option<i64>,
    pub observed_avg: Option<f64>,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_stats_finds(storage_path: String) -> Result<Vec<StatsFind>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        get_stats_finds_for_connection(&conn)
    })
    .await
    .map_err(|e| format!("Stats finds worker failed: {}", e))?
}

fn get_stats_finds_for_connection(conn: &rusqlite::Connection) -> Result<Vec<StatsFind>, String> {
    let query = format!(
        "SELECT f.id, f.species_name, f.date_found, f.country, f.region, \
                f.location_note, f.notes, f.observed_count, f.observed_count_min, \
                f.observed_count_max, \
                (SELECT COUNT(*) FROM find_photos fp WHERE fp.find_id = f.id) \
         FROM finds f WHERE {} ORDER BY f.date_found DESC, f.id DESC",
        INTERNAL_SPECIES_FILTER.replace("species_name", "f.species_name")
    );
    let mut statement = conn.prepare(&query).map_err(|e| e.to_string())?;
    let rows = statement
        .query_map([], |row| {
            Ok(StatsFind {
                id: row.get(0)?,
                species_name: row.get(1)?,
                date_found: row.get(2)?,
                country: row.get(3)?,
                region: row.get(4)?,
                location_note: row.get(5)?,
                notes: row.get(6)?,
                observed_count: row.get(7)?,
                observed_count_min: row.get(8)?,
                observed_count_max: row.get(9)?,
                photo_count: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub async fn get_stats_cards(storage_path: String) -> Result<StatsCards, String> {
    tauri::async_runtime::spawn_blocking(move || get_stats_cards_blocking(&storage_path))
        .await
        .map_err(|e| format!("Stats cards worker failed: {}", e))?
}

fn get_stats_cards_blocking(storage_path: &str) -> Result<StatsCards, String> {
    let conn = open_db(&storage_path)?;

    let total_finds: i64 = conn
        .query_row(
            &format!("SELECT COUNT(*) FROM finds WHERE {}", INTERNAL_SPECIES_FILTER),
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let unique_species: i64 = conn
        .query_row(
            &format!(
                "SELECT COUNT(DISTINCT species_name) FROM finds WHERE {}",
                INTERNAL_SPECIES_FILTER
            ),
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let locations_visited: i64 = conn
        .query_row(
            &format!(
                "SELECT COUNT(DISTINCT country || '|' || region || '|' || location_note) \
                 FROM finds WHERE {}",
                INTERNAL_SPECIES_FILTER
            ),
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let most_active_month: Option<String> = conn
        .query_row(
            &format!(
                "SELECT strftime('%Y-%m', date_found) as ym, COUNT(*) as cnt \
                 FROM finds WHERE {} AND date_found IS NOT NULL AND date_found != '' \
                 GROUP BY ym ORDER BY cnt DESC LIMIT 1",
                INTERNAL_SPECIES_FILTER
            ),
            [],
            |row| row.get(0),
        )
        .ok();

    Ok(StatsCards {
        total_finds,
        unique_species,
        locations_visited,
        most_active_month,
    })
}

#[tauri::command]
pub async fn get_top_spots(storage_path: String) -> Result<Vec<TopSpot>, String> {
    tauri::async_runtime::spawn_blocking(move || get_top_spots_blocking(&storage_path))
        .await
        .map_err(|e| format!("Top spots worker failed: {}", e))?
}

fn get_top_spots_blocking(storage_path: &str) -> Result<Vec<TopSpot>, String> {
    let conn = open_db(&storage_path)?;
    let mut stmt = conn
        .prepare(
            &format!(
                "SELECT country, region, location_note, COUNT(*) as cnt FROM finds \
                 WHERE {} GROUP BY country, region, location_note ORDER BY cnt DESC",
                INTERNAL_SPECIES_FILTER
            ),
        )
        .map_err(|e| e.to_string())?;

    let spots = stmt
        .query_map([], |row| {
            Ok(TopSpot {
                country: row.get(0)?,
                region: row.get(1)?,
                location_note: row.get(2)?,
                count: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(spots)
}

#[tauri::command]
pub async fn get_best_months(storage_path: String) -> Result<Vec<BestMonth>, String> {
    tauri::async_runtime::spawn_blocking(move || get_best_months_blocking(&storage_path))
        .await
        .map_err(|e| format!("Best months worker failed: {}", e))?
}

fn get_best_months_blocking(storage_path: &str) -> Result<Vec<BestMonth>, String> {
    let conn = open_db(&storage_path)?;
    let mut stmt = conn
        .prepare(
            &format!(
                "SELECT CAST(strftime('%m', date_found) AS INTEGER) as month_num, COUNT(*) as cnt \
                 FROM finds WHERE {} AND date_found IS NOT NULL AND date_found != '' \
                 GROUP BY month_num ORDER BY cnt DESC",
                INTERNAL_SPECIES_FILTER
            ),
        )
        .map_err(|e| e.to_string())?;

    let months = stmt
        .query_map([], |row| {
            Ok(BestMonth {
                month_num: row.get::<_, i64>(0)? as u8,
                count: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(months)
}

#[tauri::command]
pub async fn get_calendar(storage_path: String) -> Result<Vec<CalendarEntry>, String> {
    tauri::async_runtime::spawn_blocking(move || get_calendar_blocking(&storage_path))
        .await
        .map_err(|e| format!("Calendar worker failed: {}", e))?
}

fn get_calendar_blocking(storage_path: &str) -> Result<Vec<CalendarEntry>, String> {
    let conn = open_db(&storage_path)?;
    let mut stmt = conn
        .prepare(
            &format!(
                "SELECT CAST(strftime('%m', date_found) AS INTEGER) as month, species_name, date_found, location_note \
                 FROM finds WHERE {} AND date_found IS NOT NULL AND date_found != '' \
                 ORDER BY month ASC, date_found ASC",
                INTERNAL_SPECIES_FILTER
            ),
        )
        .map_err(|e| e.to_string())?;

    let entries = stmt
        .query_map([], |row| {
            Ok(CalendarEntry {
                month: row.get::<_, i64>(0)? as u8,
                species_name: row.get(1)?,
                date_found: row.get(2)?,
                location_note: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(entries)
}

#[tauri::command]
pub async fn get_species_stats(storage_path: String) -> Result<Vec<SpeciesStatSummary>, String> {
    tauri::async_runtime::spawn_blocking(move || get_species_stats_blocking(&storage_path))
        .await
        .map_err(|e| format!("Species stats worker failed: {}", e))?
}

fn get_species_stats_blocking(storage_path: &str) -> Result<Vec<SpeciesStatSummary>, String> {
    let conn = open_db(&storage_path)?;

    // Query 1: all scalar aggregates per species.
    let mut stmt = conn
        .prepare(
            &format!(
                "SELECT species_name,
                        COUNT(*) as find_count,
                        MIN(CASE WHEN date_found IS NOT NULL AND date_found != '' THEN date_found END) as first_find,
                        MIN(COALESCE(observed_count_min, observed_count)),
                        MAX(COALESCE(observed_count_max, observed_count)),
                        AVG(COALESCE(
                          CAST(observed_count AS REAL),
                          CASE WHEN observed_count_min IS NOT NULL AND observed_count_max IS NOT NULL
                            THEN (CAST(observed_count_min AS REAL) + CAST(observed_count_max AS REAL)) / 2.0
                            ELSE CAST(COALESCE(observed_count_min, observed_count_max) AS REAL)
                          END
                        ))
                 FROM finds WHERE {} GROUP BY species_name ORDER BY find_count DESC",
                INTERNAL_SPECIES_FILTER
            ),
        )
        .map_err(|e| e.to_string())?;

    #[derive(Clone)]
    struct SpeciesRow {
        species_name: String,
        find_count: i64,
        first_find: String,
        observed_min: Option<i64>,
        observed_max: Option<i64>,
        observed_avg: Option<f64>,
    }

    let species_rows: Vec<SpeciesRow> = stmt
        .query_map([], |row| {
            Ok(SpeciesRow {
                species_name: row.get(0)?,
                find_count: row.get(1)?,
                first_find: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                observed_min: row.get(3)?,
                observed_max: row.get(4)?,
                observed_avg: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Query 2: month counts for every species. The first row per species is its best month.
    let mut month_stmt = conn
        .prepare(&format!(
            "SELECT species_name, strftime('%Y-%m', date_found) AS ym, COUNT(*) AS cnt
             FROM finds
             WHERE {} AND date_found IS NOT NULL AND date_found != ''
             GROUP BY species_name, ym
             ORDER BY species_name COLLATE NOCASE, cnt DESC, ym ASC",
            INTERNAL_SPECIES_FILTER
        ))
        .map_err(|e| e.to_string())?;
    let month_rows = month_stmt
        .query_map([], |row| Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;
    let mut best_months = HashMap::<String, String>::new();
    for row in month_rows {
        let (species_name, month) = row.map_err(|e| e.to_string())?;
        best_months.entry(species_name).or_insert(month);
    }

    // Query 3: every distinct species/location pair in one pass.
    let mut location_stmt = conn
        .prepare(&format!(
            "SELECT DISTINCT species_name, country, region, location_note
             FROM finds WHERE {}
             ORDER BY species_name COLLATE NOCASE, country, region, location_note",
            INTERNAL_SPECIES_FILTER
        ))
        .map_err(|e| e.to_string())?;
    let location_rows = location_stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                SpeciesLocation {
                    country: row.get(1)?,
                    region: row.get(2)?,
                    location_note: row.get(3)?,
                },
            ))
        })
        .map_err(|e| e.to_string())?;
    let mut locations_by_species = HashMap::<String, Vec<SpeciesLocation>>::new();
    for row in location_rows {
        let (species_name, location) = row.map_err(|e| e.to_string())?;
        locations_by_species
            .entry(species_name)
            .or_default()
            .push(location);
    }

    Ok(species_rows
        .into_iter()
        .map(|row| SpeciesStatSummary {
            best_month: best_months.remove(&row.species_name),
            locations: locations_by_species
                .remove(&row.species_name)
                .unwrap_or_default(),
            species_name: row.species_name,
            find_count: row.find_count,
            first_find: row.first_find,
            observed_min: row.observed_min,
            observed_max: row.observed_max,
            observed_avg: row.observed_avg,
        })
        .collect())
}

/// Read photo files as base64-encoded strings for export.
///
/// Security: Validates that no path component contains `..` to prevent
/// path traversal outside the user's storage folder (T-04-01).
#[tauri::command]
pub async fn read_photos_as_base64(
    storage_path: String,
    photo_paths: Vec<String>,
) -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        read_photos_as_base64_blocking(&storage_path, &photo_paths)
    })
    .await
    .map_err(|e| format!("Photo export worker failed: {}", e))?
}

fn read_photos_as_base64_blocking(
    storage_path: &str,
    photo_paths: &[String],
) -> Result<Vec<String>, String> {
    let mut result: Vec<String> = Vec::with_capacity(photo_paths.len());

    for rel in photo_paths {
        // T-04-01: Reject paths containing `..` to prevent traversal outside storage_path
        if rel.contains("..") {
            return Err(format!(
                "Invalid photo path '{}': path traversal not allowed",
                rel
            ));
        }

        let abs = format!("{}/{}", storage_path, rel);
        let bytes = std::fs::read(&abs)
            .map_err(|e| format!("Failed to read photo '{}': {}", abs, e))?;
        let encoded = base64::engine::general_purpose::STANDARD.encode(&bytes);
        result.push(encoded);
    }

    Ok(result)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::import::test_helpers::setup_in_memory_db;

    fn run_sync<T>(f: impl std::future::Future<Output = T>) -> T {
        tokio::runtime::Runtime::new().unwrap().block_on(f)
    }

    /// Helper: insert a find with a specific species and date directly into the DB.
    fn insert_find_with(
        conn: &rusqlite::Connection,
        species: &str,
        date: &str,
        country: &str,
        region: &str,
        location_note: &str,
    ) -> i64 {
        conn.execute(
            "INSERT INTO finds (original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, created_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, NULL, NULL, '', ?6, '2024-01-01T00:00:00Z')",
            params![
                format!("{}-{}.jpg", species, date),
                species,
                date,
                country,
                region,
                location_note,
            ],
        )
        .expect("insert test find");
        conn.last_insert_rowid()
    }

    fn insert_find_with_range(
        conn: &rusqlite::Connection,
        species: &str,
        date: &str,
        obs_min: Option<i64>,
        obs_max: Option<i64>,
        obs_count: Option<i64>,
    ) -> i64 {
        conn.execute(
            "INSERT INTO finds (original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, created_at, observed_count_min, observed_count_max, observed_count) \
             VALUES (?1, ?2, ?3, 'Croatia', 'Region', NULL, NULL, '', '', '2024-01-01T00:00:00Z', ?4, ?5, ?6)",
            params![
                format!("{}-{}.jpg", species, date),
                species,
                date,
                obs_min,
                obs_max,
                obs_count,
            ],
        )
        .expect("insert find with range");
        conn.last_insert_rowid()
    }

    #[test]
    fn test_observed_range_two_finds_different_ranges() {
        let conn = setup_in_memory_db();
        // find 1: 3–5, find 2: 5–10 → range 3–10, avg midpoints (4+7.5)/2 = 5.75
        insert_find_with_range(&conn, "Boletus edulis", "2024-05-01", Some(3), Some(5), None);
        insert_find_with_range(&conn, "Boletus edulis", "2024-06-01", Some(5), Some(10), None);

        let (obs_min, obs_max, obs_avg): (Option<i64>, Option<i64>, Option<f64>) = conn
            .query_row(
                "SELECT \
                   MIN(COALESCE(observed_count_min, observed_count)), \
                   MAX(COALESCE(observed_count_max, observed_count)), \
                   AVG(COALESCE( \
                     CAST(observed_count AS REAL), \
                     CASE WHEN observed_count_min IS NOT NULL AND observed_count_max IS NOT NULL \
                       THEN (CAST(observed_count_min AS REAL) + CAST(observed_count_max AS REAL)) / 2.0 \
                       ELSE CAST(COALESCE(observed_count_min, observed_count_max) AS REAL) \
                     END \
                   )) \
                 FROM finds WHERE species_name = 'Boletus edulis'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();

        assert_eq!(obs_min, Some(3), "overall min should be 3");
        assert_eq!(obs_max, Some(10), "overall max should be 10");
        // midpoints: (3+5)/2=4.0 and (5+10)/2=7.5 → avg = 5.75
        let avg = obs_avg.expect("avg should be Some");
        assert!((avg - 5.75).abs() < 0.001, "avg should be 5.75, got {}", avg);
    }

    #[test]
    fn test_observed_range_no_data_returns_null() {
        let conn = setup_in_memory_db();
        insert_find_with_range(&conn, "Cantharellus cibarius", "2024-05-01", None, None, None);

        let (obs_min, obs_max, obs_avg): (Option<i64>, Option<i64>, Option<f64>) = conn
            .query_row(
                "SELECT \
                   MIN(COALESCE(observed_count_min, observed_count)), \
                   MAX(COALESCE(observed_count_max, observed_count)), \
                   AVG(COALESCE( \
                     CAST(observed_count AS REAL), \
                     CASE WHEN observed_count_min IS NOT NULL AND observed_count_max IS NOT NULL \
                       THEN (CAST(observed_count_min AS REAL) + CAST(observed_count_max AS REAL)) / 2.0 \
                       ELSE CAST(COALESCE(observed_count_min, observed_count_max) AS REAL) \
                     END \
                   )) \
                 FROM finds WHERE species_name = 'Cantharellus cibarius'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();

        assert!(obs_min.is_none(), "min should be None when no obs data");
        assert!(obs_max.is_none(), "max should be None when no obs data");
        assert!(obs_avg.is_none(), "avg should be None when no obs data");
    }

    #[test]
    fn test_observed_range_mixed_only_data_find_contributes() {
        let conn = setup_in_memory_db();
        // find 1 has range 4–8; find 2 has no obs data → only find 1 contributes
        insert_find_with_range(&conn, "Amanita muscaria", "2024-05-01", Some(4), Some(8), None);
        insert_find_with_range(&conn, "Amanita muscaria", "2024-06-01", None, None, None);

        let (obs_min, obs_max, obs_avg): (Option<i64>, Option<i64>, Option<f64>) = conn
            .query_row(
                "SELECT \
                   MIN(COALESCE(observed_count_min, observed_count)), \
                   MAX(COALESCE(observed_count_max, observed_count)), \
                   AVG(COALESCE( \
                     CAST(observed_count AS REAL), \
                     CASE WHEN observed_count_min IS NOT NULL AND observed_count_max IS NOT NULL \
                       THEN (CAST(observed_count_min AS REAL) + CAST(observed_count_max AS REAL)) / 2.0 \
                       ELSE CAST(COALESCE(observed_count_min, observed_count_max) AS REAL) \
                     END \
                   )) \
                 FROM finds WHERE species_name = 'Amanita muscaria'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();

        assert_eq!(obs_min, Some(4), "min should be 4");
        assert_eq!(obs_max, Some(8), "max should be 8");
        let avg = obs_avg.expect("avg should be Some");
        assert!((avg - 6.0).abs() < 0.001, "avg should be 6.0, got {}", avg);
    }

    #[test]
    fn species_stats_batch_query_preserves_month_locations_and_observed_values() {
        let dir = tempfile::tempdir().expect("tempdir");
        let storage_path = dir.path().to_string_lossy().to_string();
        let conn = open_db(&storage_path).expect("open db");
        insert_find_with_range(&conn, "Boletus edulis", "2024-05-01", Some(3), Some(5), None);
        insert_find_with_range(&conn, "Boletus edulis", "2024-05-20", Some(5), Some(9), None);
        insert_find_with_range(&conn, "Boletus edulis", "2024-06-01", None, None, Some(7));
        conn.execute(
            "UPDATE finds SET country = 'Croatia', region = 'Gorski Kotar', location_note = 'Oak forest'",
            [],
        )
        .expect("set location");
        drop(conn);

        let stats = get_species_stats_blocking(&storage_path).expect("batch stats");
        assert_eq!(stats.len(), 1);
        let boletus = &stats[0];
        assert_eq!(boletus.find_count, 3);
        assert_eq!(boletus.best_month.as_deref(), Some("2024-05"));
        assert_eq!(boletus.locations.len(), 1);
        assert_eq!(boletus.locations[0].location_note, "Oak forest");
        assert_eq!(boletus.observed_min, Some(3));
        assert_eq!(boletus.observed_max, Some(9));
        assert!((boletus.observed_avg.expect("avg") - 6.0).abs() < 0.001);
    }

    #[test]
    fn test_get_stats_cards_empty_db() {
        let conn = setup_in_memory_db();
        // Run queries directly (sync) against in-memory DB
        let total_finds: i64 = conn
            .query_row("SELECT COUNT(*) FROM finds", [], |row| row.get(0))
            .unwrap();
        let unique_species: i64 = conn
            .query_row("SELECT COUNT(DISTINCT species_name) FROM finds", [], |row| row.get(0))
            .unwrap();
        let locations_visited: i64 = conn
            .query_row(
                "SELECT COUNT(DISTINCT country || '|' || region || '|' || location_note) FROM finds",
                [],
                |row| row.get(0),
            )
            .unwrap();
        let most_active_month: Option<String> = conn
            .query_row(
                "SELECT strftime('%Y-%m', date_found) as ym, COUNT(*) as cnt FROM finds GROUP BY ym ORDER BY cnt DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .ok();

        assert_eq!(total_finds, 0, "empty db: total_finds should be 0");
        assert_eq!(unique_species, 0, "empty db: unique_species should be 0");
        assert_eq!(locations_visited, 0, "empty db: locations_visited should be 0");
        assert!(most_active_month.is_none(), "empty db: most_active_month should be None");
    }

    #[test]
    fn stats_finds_are_lean_ordered_and_exclude_internal_rows() {
        let conn = setup_in_memory_db();
        let older = insert_find_with(
            &conn,
            "Boletus edulis",
            "2024-05-10",
            "Croatia",
            "Gorski Kotar",
            "Forest",
        );
        let newer = insert_find_with(
            &conn,
            "Cantharellus cibarius",
            "2024-06-10",
            "Croatia",
            "Istria",
            "Meadow",
        );
        insert_find_with(&conn, "tile-cache", "2024-07-10", "", "", "");
        conn.execute(
            "INSERT INTO find_photos (find_id, photo_path, is_primary) VALUES (?1, 'a.jpg', 1), (?1, 'b.jpg', 0)",
            params![newer],
        )
        .expect("insert photos");

        let rows = get_stats_finds_for_connection(&conn).expect("stats finds");
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].id, newer);
        assert_eq!(rows[0].photo_count, 2);
        assert_eq!(rows[0].location_note, "Meadow");
        assert_eq!(rows[1].id, older);
        assert_eq!(rows[1].photo_count, 0);
    }

    #[test]
    fn test_get_stats_cards_with_data() {
        let conn = setup_in_memory_db();

        // 3 finds: 2 unique species, 2 unique months (May + June)
        insert_find_with(&conn, "Boletus edulis", "2024-05-10", "Croatia", "Gorski Kotar", "Forest");
        insert_find_with(&conn, "Cantharellus cibarius", "2024-05-15", "Croatia", "Gorski Kotar", "Forest");
        insert_find_with(&conn, "Boletus edulis", "2024-06-01", "Croatia", "Istria", "Meadow");

        let total_finds: i64 = conn
            .query_row("SELECT COUNT(*) FROM finds", [], |row| row.get(0))
            .unwrap();
        let unique_species: i64 = conn
            .query_row("SELECT COUNT(DISTINCT species_name) FROM finds", [], |row| row.get(0))
            .unwrap();

        assert_eq!(total_finds, 3, "should have 3 finds");
        assert_eq!(unique_species, 2, "should have 2 unique species");

        // Most active month should be 2024-05 (2 finds vs 1 in June)
        let most_active_month: Option<String> = conn
            .query_row(
                "SELECT strftime('%Y-%m', date_found) as ym, COUNT(*) as cnt FROM finds GROUP BY ym ORDER BY cnt DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .ok();
        assert_eq!(most_active_month, Some("2024-05".to_string()));
    }

    #[test]
    fn test_get_calendar_month_grouping() {
        let conn = setup_in_memory_db();

        // Insert finds in January, May, December — verify month field is 1, 5, 12
        insert_find_with(&conn, "Amanita muscaria", "2024-01-15", "Croatia", "Region", "");
        insert_find_with(&conn, "Boletus edulis", "2024-05-10", "Croatia", "Region", "");
        insert_find_with(&conn, "Cantharellus cibarius", "2024-12-01", "Croatia", "Region", "");

        let mut stmt = conn
            .prepare(
                "SELECT CAST(strftime('%m', date_found) AS INTEGER) as month, species_name, date_found, location_note \
                 FROM finds ORDER BY month ASC, date_found ASC",
            )
            .unwrap();

        let entries: Vec<CalendarEntry> = stmt
            .query_map([], |row| {
                Ok(CalendarEntry {
                    month: row.get::<_, i64>(0)? as u8,
                    species_name: row.get(1)?,
                    date_found: row.get(2)?,
                    location_note: row.get(3)?,
                })
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(entries.len(), 3, "should have 3 calendar entries");
        assert_eq!(entries[0].month, 1, "first entry should be month 1 (January)");
        assert_eq!(entries[1].month, 5, "second entry should be month 5 (May)");
        assert_eq!(entries[2].month, 12, "third entry should be month 12 (December)");
    }

    #[test]
    fn test_read_photos_as_base64_rejects_path_traversal() {
        // Should reject any path containing `..`
        let result = run_sync(read_photos_as_base64(
            "/tmp/storage".to_string(),
            vec!["../etc/passwd".to_string()],
        ));
        assert!(result.is_err(), "path traversal should be rejected");
        let err = result.unwrap_err();
        assert!(err.contains("path traversal not allowed"), "error should mention traversal: {}", err);
    }

    #[test]
    fn test_get_top_spots_returns_ranked_results() {
        let conn = setup_in_memory_db();

        // 3 finds in Forest, 1 in Meadow — Forest should rank first
        insert_find_with(&conn, "Boletus edulis", "2024-05-01", "Croatia", "Gorski Kotar", "Forest");
        insert_find_with(&conn, "Boletus edulis", "2024-05-10", "Croatia", "Gorski Kotar", "Forest");
        insert_find_with(&conn, "Cantharellus cibarius", "2024-05-15", "Croatia", "Gorski Kotar", "Forest");
        insert_find_with(&conn, "Amanita muscaria", "2024-06-01", "Croatia", "Istria", "Meadow");

        let mut stmt = conn
            .prepare(
                "SELECT country, region, location_note, COUNT(*) as cnt FROM finds \
                 GROUP BY country, region, location_note ORDER BY cnt DESC",
            )
            .unwrap();

        let spots: Vec<TopSpot> = stmt
            .query_map([], |row| {
                Ok(TopSpot {
                    country: row.get(0)?,
                    region: row.get(1)?,
                    location_note: row.get(2)?,
                    count: row.get(3)?,
                })
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(spots.len(), 2, "should have 2 distinct spots");
        assert_eq!(spots[0].location_note, "Forest", "Forest should rank first with 3 finds");
        assert_eq!(spots[0].count, 3);
        assert_eq!(spots[1].location_note, "Meadow", "Meadow should rank second with 1 find");
        assert_eq!(spots[1].count, 1);
    }
}
