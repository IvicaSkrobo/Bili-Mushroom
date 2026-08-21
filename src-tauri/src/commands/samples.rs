//! Specimen register ("Uzorci").
//!
//! A sample is a thin record pointing at a find -- the find stays the single source of
//! truth for species, date, location and photos. On disk each sample gets its own folder
//! under `Uzorci/`, with the find's photos hard-linked in so both paths are literally the
//! same file: rotating or cropping a photo in the app updates the sample folder too
//! (`edit_find_photo_image` overwrites in place with `fs::copy`, which keeps links
//! intact). Hard links fall back to plain copies when the filesystem refuses them.

use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use std::path::{Path, PathBuf};

use crate::commands::import::open_db;
use crate::commands::path_builder::{plain_species_name, resolve_location_component};

const SAMPLES_ROOT: &str = "Uzorci";

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct SampleRecord {
    pub id: i64,
    pub find_id: i64,
    pub species_name: String,
    pub sample_year: i64,
    pub sample_no: i64,
    /// Display label, e.g. "Boletus edulis 1/2026".
    pub label: String,
    pub folder_path: Option<String>,
    pub preservation: Option<String>,
    pub storage_location: Option<String>,
    pub condition: Option<String>,
    pub spore_print: bool,
    pub dna_sample: bool,
    pub dried_at: Option<String>,
    pub dry_weight: Option<String>,
    pub loaned_to: Option<String>,
    pub loaned_at: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    // Denormalised from the find so the register renders without a second round trip.
    pub date_found: String,
    pub country: String,
    pub region: String,
    pub location_note: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub determiner: Option<String>,
    pub finder: Option<String>,
    pub weather: Option<String>,
    pub find_notes: String,
    pub photo_paths: Vec<String>,
}

fn species_key(species_name: &str) -> String {
    plain_species_name(species_name).trim().to_lowercase()
}

fn sample_label(species_name: &str, sample_no: i64, sample_year: i64) -> String {
    format!(
        "{} {}/{}",
        plain_species_name(species_name).trim(),
        sample_no,
        sample_year
    )
}

fn sample_folder_rel(species_name: &str, sample_year: i64, sample_no: i64) -> String {
    let species_folder =
        resolve_location_component(&plain_species_name(species_name), "unknown_species");
    format!(
        "{}/{}/{}-{:03}",
        SAMPLES_ROOT, species_folder, sample_year, sample_no
    )
}

/// Reserves the next number for a species/year pair. The counter only ever moves forward,
/// so deleting a sample retires its number instead of handing it to the next one.
fn next_sample_no(conn: &Connection, species_name: &str, year: i64) -> Result<i64, String> {
    let key = species_key(species_name);
    let current: Option<i64> = conn
        .query_row(
            "SELECT last_no FROM sample_counters WHERE species_key = ?1 AND sample_year = ?2",
            params![key, year],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("Could not read the sample counter: {e}"))?;

    // Existing rows win if they somehow sit above the counter (hand-edited DB, restore).
    let highest_used: Option<i64> = conn
        .query_row(
            "SELECT MAX(sample_no) FROM samples WHERE LOWER(TRIM(REPLACE(species_name, '*', ''))) = ?1 AND sample_year = ?2",
            params![key, year],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| format!("Could not read the highest sample number in use: {e}"))?
        .flatten();

    let next = current.unwrap_or(0).max(highest_used.unwrap_or(0)) + 1;
    conn.execute(
        "INSERT INTO sample_counters (species_key, sample_year, last_no)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(species_key, sample_year) DO UPDATE SET last_no = excluded.last_no",
        params![key, year, next],
    )
    .map_err(|e| format!("Failed to reserve sample number: {}", e))?;
    Ok(next)
}

fn year_from_date(date_found: &str) -> i64 {
    date_found
        .get(0..4)
        .and_then(|value| value.parse::<i64>().ok())
        .unwrap_or_else(|| Utc::now().format("%Y").to_string().parse().unwrap_or(0))
}

/// Only what numbering and folder naming need -- everything else is read back through
/// the join in `SAMPLE_SELECT`.
struct FindFacts {
    species_name: String,
    date_found: String,
}

fn load_find_facts(conn: &Connection, find_id: i64) -> Result<FindFacts, String> {
    conn.query_row(
        "SELECT species_name, date_found FROM finds WHERE id = ?1",
        params![find_id],
        |row| {
            Ok(FindFacts {
                species_name: row.get(0)?,
                date_found: row.get(1)?,
            })
        },
    )
    .map_err(|e| format!("Could not locate find {}: {}", find_id, e))
}

fn photo_paths_for_find(conn: &Connection, find_id: i64) -> Result<Vec<String>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT photo_path FROM find_photos WHERE find_id = ?1 ORDER BY is_primary DESC, id ASC",
        )
        .map_err(|e| format!("Failed to prepare sample photos query: {}", e))?;
    let paths = stmt
        .query_map(params![find_id], |row| row.get::<_, String>(0))
        .map_err(|e| format!("Sample photos query failed: {}", e))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Sample photos row mapping failed: {}", e))?;
    Ok(paths)
}

/// Mirrors the find's photos into the sample folder and refreshes the data sheet.
/// Existing links are left alone; only missing ones are created.
fn sync_folder(
    storage_path: &str,
    folder_rel: &str,
    photo_paths: &[String],
    data_sheet: &str,
) -> Result<(), String> {
    let folder_abs = Path::new(storage_path).join(folder_rel.replace('/', std::path::MAIN_SEPARATOR_STR));
    std::fs::create_dir_all(&folder_abs)
        .map_err(|e| format!("Failed to create sample folder '{}': {}", folder_abs.display(), e))?;

    for (index, rel) in photo_paths.iter().enumerate() {
        let source = Path::new(storage_path).join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        if !source.exists() {
            continue;
        }
        let extension = source
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("jpg");
        let dest: PathBuf = folder_abs.join(format!("{:02}.{}", index + 1, extension));
        if dest.exists() {
            continue;
        }
        // Hard link keeps one file on disk: edits made through the app land in both
        // places. Copy is the fallback for filesystems that refuse links.
        if std::fs::hard_link(&source, &dest).is_err() {
            std::fs::copy(&source, &dest).map_err(|e| {
                format!("Failed to place photo in sample folder '{}': {}", dest.display(), e)
            })?;
        }
    }

    std::fs::write(folder_abs.join("uzorak.json"), data_sheet)
        .map_err(|e| format!("Failed to write sample data sheet: {}", e))?;
    Ok(())
}

fn row_to_sample(row: &rusqlite::Row<'_>) -> rusqlite::Result<SampleRecord> {
    let species_name: String = row.get(2)?;
    let sample_year: i64 = row.get(3)?;
    let sample_no: i64 = row.get(4)?;
    Ok(SampleRecord {
        id: row.get(0)?,
        find_id: row.get(1)?,
        label: sample_label(&species_name, sample_no, sample_year),
        species_name,
        sample_year,
        sample_no,
        folder_path: row.get(5)?,
        preservation: row.get(6)?,
        storage_location: row.get(7)?,
        condition: row.get(8)?,
        spore_print: row.get::<_, i64>(9)? == 1,
        dna_sample: row.get::<_, i64>(10)? == 1,
        dried_at: row.get(11)?,
        dry_weight: row.get(12)?,
        loaned_to: row.get(13)?,
        loaned_at: row.get(14)?,
        notes: row.get(15)?,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
        date_found: row.get(18)?,
        country: row.get(19)?,
        region: row.get(20)?,
        location_note: row.get(21)?,
        lat: row.get(22)?,
        lng: row.get(23)?,
        determiner: row.get(24)?,
        finder: row.get(25)?,
        weather: row.get(26)?,
        find_notes: row.get(27)?,
        photo_paths: vec![],
    })
}

const SAMPLE_SELECT: &str = "SELECT s.id, s.find_id, s.species_name, s.sample_year, s.sample_no, s.folder_path,
        s.preservation, s.storage_location, s.condition, s.spore_print, s.dna_sample,
        s.dried_at, s.dry_weight, s.loaned_to, s.loaned_at, s.notes, s.created_at, s.updated_at,
        f.date_found, f.country, f.region, f.location_note, f.lat, f.lng, f.determiner, f.finder, f.weather, f.notes
 FROM samples s JOIN finds f ON f.id = s.find_id";

fn load_sample(conn: &Connection, sample_id: i64) -> Result<SampleRecord, String> {
    let sql = format!("{} WHERE s.id = ?1", SAMPLE_SELECT);
    let mut record = conn
        .query_row(&sql, params![sample_id], |row| row_to_sample(row))
        .map_err(|e| format!("Failed to read sample {}: {}", sample_id, e))?;
    record.photo_paths = photo_paths_for_find(conn, record.find_id)?;
    Ok(record)
}

fn build_data_sheet(record: &SampleRecord) -> String {
    serde_json::to_string_pretty(record).unwrap_or_else(|_| "{}".to_string())
}


/// Raises the counter so a number already in use is never handed out again.
fn ensure_counter_at_least(
    conn: &Connection,
    key: &str,
    year: i64,
    no: i64,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO sample_counters (species_key, sample_year, last_no)
         VALUES (?1, ?2, ?3)
         ON CONFLICT(species_key, sample_year) DO UPDATE SET
           last_no = MAX(sample_counters.last_no, excluded.last_no)",
        params![key, year, no],
    )
    .map_err(|e| format!("Failed to advance sample counter: {}", e))?;
    Ok(())
}

/// Follows a species rename. Each affected sample keeps its number when that number is
/// still free under the new name, and is renumbered when it would collide -- possible
/// because numbering is per species, so merging two species can bring two 1/2026 together.
/// The folder is moved to match; if the move fails the record still points at the new
/// path and the next sync recreates it.
pub(crate) fn relocate_samples_for_finds(
    conn: &Connection,
    storage_path: &str,
    find_ids: &[i64],
    new_species_name: &str,
) -> Result<(), String> {
    let new_key = species_key(new_species_name);

    for find_id in find_ids {
        let existing: Option<(i64, i64, i64, Option<String>)> = conn
            .query_row(
                "SELECT id, sample_year, sample_no, folder_path FROM samples WHERE find_id = ?1",
                params![find_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .optional()
            .map_err(|e| format!("Could not read the sample for find {find_id}: {e}"))?;
        let Some((sample_id, year, current_no, old_folder)) = existing else {
            continue;
        };

        let collides: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM samples
                 WHERE LOWER(TRIM(REPLACE(species_name, '*', ''))) = ?1
                   AND sample_year = ?2 AND sample_no = ?3 AND id <> ?4",
                params![new_key, year, current_no, sample_id],
                |row| row.get(0),
            )
            .unwrap_or(0);

        let final_no = if collides > 0 {
            next_sample_no(conn, new_species_name, year)?
        } else {
            ensure_counter_at_least(conn, &new_key, year, current_no)?;
            current_no
        };

        let new_folder = sample_folder_rel(new_species_name, year, final_no);
        if let Some(old_rel) = old_folder.as_deref() {
            if old_rel != new_folder {
                let old_abs = Path::new(storage_path)
                    .join(old_rel.replace('/', std::path::MAIN_SEPARATOR_STR));
                let new_abs = Path::new(storage_path)
                    .join(new_folder.replace('/', std::path::MAIN_SEPARATOR_STR));
                if old_abs.exists() {
                    if let Some(parent) = new_abs.parent() {
                        let _ = std::fs::create_dir_all(parent);
                    }
                    let _ = std::fs::rename(&old_abs, &new_abs);
                }
            }
        }

        conn.execute(
            "UPDATE samples SET species_name = ?1, sample_no = ?2, folder_path = ?3, updated_at = ?4 WHERE id = ?5",
            params![
                new_species_name,
                final_no,
                new_folder,
                Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string(),
                sample_id
            ],
        )
        .map_err(|e| format!("Failed to move sample to renamed species: {}", e))?;

        // Refresh the data sheet so it carries the new name and number.
        let _ = sync_sample_folder_inner(conn, storage_path, sample_id);
    }
    Ok(())
}

/// Drops the register entry belonging to a deleted find. The folder is only removed when
/// the caller asked for it -- a record-only delete leaves the material intact.
///
/// Only "there is no such row" counts as a normal absence: a corrupt or unreadable
/// database surfaces as an error so the delete transaction rolls back instead of
/// quietly deciding the find had no sample.
pub(crate) fn remove_sample_for_find(
    conn: &Connection,
    storage_path: &str,
    find_id: i64,
    delete_folder: bool,
) -> Result<(), String> {
    let existing: Option<(i64, Option<String>)> = conn
        .query_row(
            "SELECT id, folder_path FROM samples WHERE find_id = ?1",
            params![find_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .optional()
        .map_err(|e| format!("Could not read the sample for find {find_id}: {e}"))?;
    let Some((sample_id, folder)) = existing else {
        return Ok(());
    };

    conn.execute("DELETE FROM samples WHERE id = ?1", params![sample_id])
        .map_err(|e| format!("Failed to remove sample for deleted find: {}", e))?;

    if delete_folder {
        if let Some(folder_rel) = folder {
            let folder_abs =
                Path::new(storage_path).join(folder_rel.replace('/', std::path::MAIN_SEPARATOR_STR));
            let _ = std::fs::remove_dir_all(folder_abs);
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn get_samples(storage_path: String) -> Result<Vec<SampleRecord>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        let sql = format!(
            "{} ORDER BY s.sample_year DESC, s.species_name COLLATE NOCASE ASC, s.sample_no DESC",
            SAMPLE_SELECT
        );
        let mut stmt = conn
            .prepare(&sql)
            .map_err(|e| format!("Failed to prepare samples query: {}", e))?;
        let mut records: Vec<SampleRecord> = stmt
            .query_map([], |row| row_to_sample(row))
            .map_err(|e| format!("Samples query failed: {}", e))?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| format!("Samples row mapping failed: {}", e))?;

        for record in &mut records {
            record.photo_paths = photo_paths_for_find(&conn, record.find_id)?;
        }
        Ok(records)
    })
    .await
    .map_err(|e| format!("Samples worker failed: {e}"))?
}

/// Registers a find as a specimen. Idempotent: a find that is already registered keeps
/// its number and simply gets its folder refreshed.
#[tauri::command]
pub async fn create_sample_for_find(
    storage_path: String,
    find_id: i64,
) -> Result<SampleRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;

        let existing: Option<i64> = conn
            .query_row(
                "SELECT id FROM samples WHERE find_id = ?1",
                params![find_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| format!("Could not look up the sample for find {find_id}: {e}"))?;
        if let Some(sample_id) = existing {
            return sync_sample_folder_inner(&conn, &storage_path, sample_id);
        }

        let facts = load_find_facts(&conn, find_id)?;
        let year = year_from_date(&facts.date_found);
        let sample_no = next_sample_no(&conn, &facts.species_name, year)?;
        let folder_rel = sample_folder_rel(&facts.species_name, year, sample_no);
        let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

        conn.execute(
            "INSERT INTO samples (find_id, species_name, sample_year, sample_no, folder_path, spore_print, dna_sample, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, 0, ?6, ?6)",
            params![find_id, facts.species_name, year, sample_no, folder_rel, now],
        )
        .map_err(|e| format!("Failed to create sample: {}", e))?;

        let sample_id = conn.last_insert_rowid();
        sync_sample_folder_inner(&conn, &storage_path, sample_id)
    })
    .await
    .map_err(|e| format!("Sample registration worker failed: {e}"))?
}

fn sync_sample_folder_inner(
    conn: &Connection,
    storage_path: &str,
    sample_id: i64,
) -> Result<SampleRecord, String> {
    let record = load_sample(conn, sample_id)?;
    if let Some(folder_rel) = record.folder_path.as_deref() {
        let sheet = build_data_sheet(&record);
        sync_folder(storage_path, folder_rel, &record.photo_paths, &sheet)?;
    }
    Ok(record)
}

#[tauri::command]
pub async fn sync_sample_folder(
    storage_path: String,
    sample_id: i64,
) -> Result<SampleRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        sync_sample_folder_inner(&conn, &storage_path, sample_id)
    })
    .await
    .map_err(|e| format!("Sample folder sync worker failed: {e}"))?
}

#[derive(serde::Deserialize)]
pub struct SampleUpdatePayload {
    pub id: i64,
    pub preservation: Option<String>,
    pub storage_location: Option<String>,
    pub condition: Option<String>,
    pub spore_print: bool,
    pub dna_sample: bool,
    pub dried_at: Option<String>,
    pub dry_weight: Option<String>,
    pub loaned_to: Option<String>,
    pub loaned_at: Option<String>,
    pub notes: Option<String>,
}

#[tauri::command]
pub async fn update_sample(
    storage_path: String,
    payload: SampleUpdatePayload,
) -> Result<SampleRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
        conn.execute(
            "UPDATE samples SET preservation=?1, storage_location=?2, condition=?3, spore_print=?4,
               dna_sample=?5, dried_at=?6, dry_weight=?7, loaned_to=?8, loaned_at=?9, notes=?10, updated_at=?11
             WHERE id=?12",
            params![
                payload.preservation,
                payload.storage_location,
                payload.condition,
                if payload.spore_print { 1i64 } else { 0i64 },
                if payload.dna_sample { 1i64 } else { 0i64 },
                payload.dried_at,
                payload.dry_weight,
                payload.loaned_to,
                payload.loaned_at,
                payload.notes,
                now,
                payload.id,
            ],
        )
        .map_err(|e| format!("Failed to update sample: {}", e))?;

        sync_sample_folder_inner(&conn, &storage_path, payload.id)
    })
    .await
    .map_err(|e| format!("Sample update worker failed: {e}"))?
}

/// Removes the register entry. The number stays retired; the folder is only touched when
/// `delete_folder` is set, and the find itself is never modified.
#[tauri::command]
pub async fn delete_sample(
    storage_path: String,
    sample_id: i64,
    delete_folder: bool,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        let folder: Option<String> = conn
            .query_row(
                "SELECT folder_path FROM samples WHERE id = ?1",
                params![sample_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to read sample {}: {}", sample_id, e))?;

        conn.execute("DELETE FROM samples WHERE id = ?1", params![sample_id])
            .map_err(|e| format!("Failed to delete sample: {}", e))?;

        if delete_folder {
            if let Some(folder_rel) = folder {
                let folder_abs = Path::new(&storage_path)
                    .join(folder_rel.replace('/', std::path::MAIN_SEPARATOR_STR));
                let _ = std::fs::remove_dir_all(folder_abs);
            }
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("Sample delete worker failed: {e}"))?
}

#[tauri::command]
pub async fn get_sample_for_find(
    storage_path: String,
    find_id: i64,
) -> Result<Option<SampleRecord>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        let sample_id: Option<i64> = conn
            .query_row(
                "SELECT id FROM samples WHERE find_id = ?1",
                params![find_id],
                |row| row.get(0),
            )
            .optional()
            .map_err(|e| format!("Could not look up the sample for find {find_id}: {e}"))?;
        match sample_id {
            Some(id) => Ok(Some(load_sample(&conn, id)?)),
            None => Ok(None),
        }
    })
    .await
    .map_err(|e| format!("Sample lookup worker failed: {e}"))?
}

#[tauri::command]
pub async fn open_sample_folder(storage_path: String, sample_id: i64) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        let folder: Option<String> = conn
            .query_row(
                "SELECT folder_path FROM samples WHERE id = ?1",
                params![sample_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to read sample {}: {}", sample_id, e))?;
        let folder_rel = folder.ok_or_else(|| "Sample has no folder yet".to_string())?;
        let folder_abs =
            Path::new(&storage_path).join(folder_rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        if !folder_abs.exists() {
            return Err(format!("Sample folder not found: {}", folder_abs.display()));
        }
        std::process::Command::new("explorer")
            .arg(folder_abs)
            .spawn()
            .map_err(|e| format!("Failed to open sample folder: {}", e))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Sample folder worker failed: {e}"))?
}
