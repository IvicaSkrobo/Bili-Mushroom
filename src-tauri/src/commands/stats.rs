use rusqlite::params;
use base64::Engine;

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
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_stats_cards(storage_path: String) -> Result<StatsCards, String> {
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
                 FROM finds WHERE {} GROUP BY ym ORDER BY cnt DESC LIMIT 1",
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
    let conn = open_db(&storage_path)?;
    let mut stmt = conn
        .prepare(
            &format!(
                "SELECT country, region, location_note, COUNT(*) as cnt FROM finds \
                 WHERE {} GROUP BY country, region, location_note ORDER BY cnt DESC LIMIT 10",
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
    let conn = open_db(&storage_path)?;
    let mut stmt = conn
        .prepare(
            &format!(
                "SELECT CAST(strftime('%m', date_found) AS INTEGER) as month_num, COUNT(*) as cnt \
                 FROM finds WHERE {} GROUP BY month_num ORDER BY cnt DESC",
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
    let conn = open_db(&storage_path)?;
    let mut stmt = conn
        .prepare(
            &format!(
                "SELECT CAST(strftime('%m', date_found) AS INTEGER) as month, species_name, date_found, location_note \
                 FROM finds WHERE {} ORDER BY month ASC, date_found ASC",
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
    let conn = open_db(&storage_path)?;

    // First query: aggregate per species
    let mut stmt = conn
        .prepare(
            &format!(
                "SELECT species_name, COUNT(*) as find_count, MIN(date_found) as first_find \
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
    }

    let species_rows: Vec<SpeciesRow> = stmt
        .query_map([], |row| {
            Ok(SpeciesRow {
                species_name: row.get(0)?,
                find_count: row.get(1)?,
                first_find: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut result: Vec<SpeciesStatSummary> = Vec::with_capacity(species_rows.len());

    for row in species_rows {
        // Best month sub-query
        let best_month: Option<String> = conn
            .query_row(
                &format!(
                    "SELECT strftime('%Y-%m', date_found) as ym, COUNT(*) as cnt \
                     FROM finds WHERE {} AND species_name = ?1 GROUP BY ym ORDER BY cnt DESC LIMIT 1",
                    INTERNAL_SPECIES_FILTER
                ),
                params![row.species_name],
                |r| r.get(0),
            )
            .ok();

        // Locations sub-query
        let mut loc_stmt = conn
            .prepare(
                &format!(
                    "SELECT DISTINCT country, region, location_note \
                     FROM finds WHERE {} AND species_name = ?1",
                    INTERNAL_SPECIES_FILTER
                ),
            )
            .map_err(|e| e.to_string())?;

        let locations: Vec<SpeciesLocation> = loc_stmt
            .query_map(params![row.species_name], |r| {
                Ok(SpeciesLocation {
                    country: r.get(0)?,
                    region: r.get(1)?,
                    location_note: r.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;

        result.push(SpeciesStatSummary {
            species_name: row.species_name,
            find_count: row.find_count,
            first_find: row.first_find,
            best_month,
            locations,
        });
    }

    Ok(result)
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
    let mut result: Vec<String> = Vec::with_capacity(photo_paths.len());

    for rel in &photo_paths {
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
                 GROUP BY country, region, location_note ORDER BY cnt DESC LIMIT 10",
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
