use rusqlite::params;
use chrono::Utc;
use std::process::Command;
use std::path::{Path, PathBuf};

use crate::commands::import::{open_db, insert_find_photo, insert_find_row, find_record_from_row, FindPhoto, FindRecord};
use crate::commands::path_builder::{build_dest_path, next_seq_for_folder, resolve_location_component};

// ---------------------------------------------------------------------------
// create_find
// ---------------------------------------------------------------------------

#[derive(serde::Deserialize)]
pub struct CreateFindPayload {
    pub species_name: String,
    pub date_found: String,
    pub country: String,
    pub region: String,
    pub location_note: String,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
    pub notes: String,
    pub observed_count: Option<i64>,
    pub observed_count_min: Option<i64>,
    pub observed_count_max: Option<i64>,
}

#[tauri::command]
pub async fn create_find(
    storage_path: String,
    payload: CreateFindPayload,
) -> Result<FindRecord, String> {
    if payload.species_name.trim().is_empty() {
        return Err("species_name cannot be empty".into());
    }

    let conn = open_db(&storage_path)?;

    let (observed_count, observed_count_min, observed_count_max) =
        crate::commands::import::normalize_observed_range_pub(
            payload.observed_count,
            payload.observed_count_min,
            payload.observed_count_max,
        );

    let created_at = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let record = FindRecord {
        id: 0,
        original_filename: String::new(),
        species_name: payload.species_name,
        date_found: payload.date_found,
        country: payload.country,
        region: payload.region,
        location_note: payload.location_note,
        lat: payload.lat,
        lng: payload.lng,
        notes: payload.notes,
        observed_count,
        observed_count_min,
        observed_count_max,
        is_favorite: false,
        created_at,
        photos: vec![],
    };

    let new_id = insert_find_row(&conn, &record)
        .map_err(|e| format!("Failed to insert find: {}", e))?;

    let mut inserted = conn
        .query_row(
            "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at FROM finds WHERE id = ?1",
            params![new_id],
            |row| find_record_from_row(row),
        )
        .map_err(|e| format!("Failed to read inserted find: {}", e))?;

    // No photo rows were inserted — explicitly set to empty
    inserted.photos = vec![];

    Ok(inserted)
}

const INTERNAL_SPECIES_FILTER: &str =
    "LOWER(TRIM(species_name)) IN ('tile-cache', '.bili-cache', '.bili-cache-tiles')";

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct SpeciesNote {
    pub species_name: String,
    pub notes: String,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct SpeciesProfile {
    pub species_name: String,
    pub cover_photo_id: Option<i64>,
    pub tags: Vec<String>,
    pub edibility: Option<String>,
    pub protected_status: Option<String>,
}

#[tauri::command]
pub async fn get_species_notes(storage_path: String) -> Result<Vec<SpeciesNote>, String> {
    let conn = open_db(&storage_path)?;
    let mut stmt = conn
        .prepare("SELECT species_name, notes FROM species_notes ORDER BY species_name")
        .map_err(|e| e.to_string())?;
    let notes = stmt
        .query_map([], |row| Ok(SpeciesNote { species_name: row.get(0)?, notes: row.get(1)? }))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(notes)
}

#[tauri::command]
pub async fn get_species_profiles(storage_path: String) -> Result<Vec<SpeciesProfile>, String> {
    let conn = open_db(&storage_path)?;
    let mut stmt = conn
        .prepare("SELECT species_name, cover_photo_id, tags_json, edibility, protected_status FROM species_profiles ORDER BY species_name")
        .map_err(|e| e.to_string())?;
    let profiles = stmt
        .query_map([], |row| {
            let tags_json: String = row.get(2)?;
            Ok(SpeciesProfile {
                species_name: row.get(0)?,
                cover_photo_id: row.get(1)?,
                tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                edibility: row.get(3)?,
                protected_status: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(profiles)
}

#[tauri::command]
pub async fn upsert_species_profile(
    storage_path: String,
    species_name: String,
    cover_photo_id: Option<i64>,
    tags: Vec<String>,
    edibility: Option<String>,
    protected_status: Option<String>,
) -> Result<(), String> {
    let conn = open_db(&storage_path)?;
    let updated_at = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let tags_json = serde_json::to_string(&tags)
        .map_err(|e| format!("Failed to encode species tags: {}", e))?;
    conn.execute(
        "INSERT INTO species_profiles (species_name, cover_photo_id, tags_json, updated_at, edibility, protected_status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)
         ON CONFLICT(species_name) DO UPDATE SET
           cover_photo_id = excluded.cover_photo_id,
           tags_json = excluded.tags_json,
           updated_at = excluded.updated_at,
           edibility = excluded.edibility,
           protected_status = excluded.protected_status",
        params![species_name, cover_photo_id, tags_json, updated_at, edibility, protected_status],
    )
    .map_err(|e| format!("Upsert species profile failed: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn upsert_species_note(
    storage_path: String,
    species_name: String,
    notes: String,
) -> Result<(), String> {
    let conn = open_db(&storage_path)?;
    let updated_at = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    conn.execute(
        "INSERT INTO species_notes (species_name, notes, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(species_name) DO UPDATE SET notes=excluded.notes, updated_at=excluded.updated_at",
        params![species_name, notes, updated_at],
    )
    .map_err(|e| format!("Upsert species note failed: {}", e))?;
    Ok(())
}

/// Move all photo files for a find to a different folder, then delete the DB record.
/// Used by the "move files to another folder" option in the delete dialog.
#[tauri::command]
pub async fn move_find_files(
    storage_path: String,
    find_id: i64,
    dest_folder: String,
) -> Result<(), String> {
    let conn = open_db(&storage_path)?;

    let mut stmt = conn
        .prepare("SELECT photo_path FROM find_photos WHERE find_id = ?1")
        .map_err(|e| e.to_string())?;
    let paths: Vec<String> = stmt
        .query_map(params![find_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    for rel_path in &paths {
        let abs_src = format!("{}/{}", storage_path, rel_path);
        let filename = std::path::Path::new(rel_path.as_str())
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(rel_path.as_str());
        let abs_dest = format!("{}/{}", dest_folder, filename);
        // Try rename first; fall back to copy+delete for cross-device moves
        if std::fs::rename(&abs_src, &abs_dest).is_err() {
            std::fs::copy(&abs_src, &abs_dest)
                .map_err(|e| format!("Failed to copy '{}': {}", abs_src, e))?;
            let _ = std::fs::remove_file(&abs_src);
        }
    }

    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM finds WHERE id = ?1", params![find_id])
        .map_err(|e| format!("DB delete failed: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn open_find_folder(
    storage_path: String,
    find_id: i64,
    scope: Option<String>,
) -> Result<(), String> {
    let conn = open_db(&storage_path)?;
    let species_name: String = conn
        .query_row(
            "SELECT species_name FROM finds WHERE id = ?1",
            params![find_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Could not locate this find: {}", e))?;

    let photo_path_result: Result<String, _> = conn
        .query_row(
            "SELECT photo_path FROM find_photos WHERE find_id = ?1 ORDER BY is_primary DESC, id ASC LIMIT 1",
            params![find_id],
            |row| row.get(0),
        );

    let preferred_scope = scope.as_deref().unwrap_or("species");
    let species_folder = Path::new(&storage_path).join(resolve_location_component(&species_name, "unknown_species"));
    let folder_path = if preferred_scope == "photo" {
        // If the find has no photos, fall back to the species folder instead of erroring
        if let Ok(photo_path) = photo_path_result {
            let absolute_photo_path = Path::new(&storage_path).join(&photo_path);
            absolute_photo_path
                .parent()
                .map(PathBuf::from)
                .ok_or_else(|| "Could not determine the containing folder for this find.".to_string())?
        } else {
            // No photos — fall back to species folder (create on demand if needed)
            if !species_folder.exists() {
                let _ = std::fs::create_dir_all(&species_folder);
            }
            species_folder
        }
    } else if species_folder.exists() {
        species_folder
    } else {
        let photo_path = photo_path_result
            .map_err(|e| format!("Could not locate the species folder or a photo for this find: {}", e))?;
        let absolute_photo_path = Path::new(&storage_path).join(&photo_path);
        absolute_photo_path
            .parent()
            .map(PathBuf::from)
            .ok_or_else(|| "Could not determine the containing folder for this find.".to_string())?
    };

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut cmd = Command::new("explorer");
        cmd.arg(&folder_path);
        cmd
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut cmd = Command::new("open");
        cmd.arg(&folder_path);
        cmd
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut cmd = Command::new("xdg-open");
        cmd.arg(&folder_path);
        cmd
    };

    command
        .spawn()
        .map_err(|e| format!("Failed to open folder: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn open_species_folder(
    storage_path: String,
    species_name: String,
) -> Result<(), String> {
    let folder_path = Path::new(&storage_path).join(resolve_location_component(&species_name, "unknown_species"));

    #[cfg(target_os = "windows")]
    let mut command = {
        let mut cmd = Command::new("explorer");
        cmd.arg(&folder_path);
        cmd
    };

    #[cfg(target_os = "macos")]
    let mut command = {
        let mut cmd = Command::new("open");
        cmd.arg(&folder_path);
        cmd
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = {
        let mut cmd = Command::new("xdg-open");
        cmd.arg(&folder_path);
        cmd
    };

    command
        .spawn()
        .map_err(|e| format!("Failed to open species folder: {}", e))?;

    Ok(())
}

/// Move a file to the system Recycle Bin. Used by the import dialog's
/// "delete source" trash button to remove the original before or instead of importing.
#[tauri::command]
pub async fn trash_source_file(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| format!("Failed to trash '{}': {}", path, e))
}

/// Terminate the process immediately. Used by the DB error dialog's Quit button.
/// getCurrentWindow().close() on macOS only closes the window, leaving the process alive.
#[tauri::command]
pub async fn quit_app() {
    std::process::exit(0);
}

#[tauri::command]
pub async fn delete_find(
    storage_path: String,
    find_id: i64,
    delete_files: bool,
) -> Result<(), String> {
    let conn = open_db(&storage_path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;

    if delete_files {
        let mut stmt = conn
            .prepare("SELECT photo_path FROM find_photos WHERE find_id = ?1")
            .map_err(|e| e.to_string())?;
        let paths: Vec<String> = stmt
            .query_map(params![find_id], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        for rel_path in &paths {
            let abs_path = format!("{}/{}", storage_path, rel_path);
            if let Err(e) = trash::delete(&abs_path) {
                eprintln!("trash::delete failed for {}: {}", abs_path, e);
            }
        }
    }

    conn.execute("DELETE FROM finds WHERE id = ?1", params![find_id])
        .map_err(|e| format!("DB delete failed: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_find_photos(
    storage_path: String,
    find_id: i64,
) -> Result<Vec<FindPhoto>, String> {
    let conn = open_db(&storage_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, find_id, photo_path, is_primary FROM find_photos WHERE find_id = ?1 ORDER BY is_primary DESC, id ASC",
        )
        .map_err(|e| e.to_string())?;
    let photos = stmt
        .query_map(params![find_id], |row| {
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
    Ok(photos)
}

#[tauri::command]
pub async fn bulk_rename_species(
    storage_path: String,
    find_ids: Vec<i64>,
    new_species_name: String,
) -> Result<(), String> {
    if find_ids.is_empty() {
        return Ok(());
    }
    let new_species_name = new_species_name.trim().to_string();
    if new_species_name.is_empty() {
        return Err("new species name cannot be empty".into());
    }

    let mut conn = open_db(&storage_path)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let mut photo_rows: Vec<(i64, String)> = Vec::new();
    let mut old_species_names: Vec<String> = Vec::new();
    for find_id in &find_ids {
        let species_name: String = tx
            .query_row(
                "SELECT species_name FROM finds WHERE id = ?1",
                params![find_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Failed to read species for id {}: {}", find_id, e))?;
        old_species_names.push(species_name);

        let mut stmt = tx
            .prepare(
                "SELECT id, photo_path FROM find_photos WHERE find_id = ?1 ORDER BY is_primary DESC, id ASC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![find_id], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        photo_rows.extend(rows);
    }

    let target_folder = Path::new(&storage_path).join(resolve_location_component(&new_species_name, "unknown_species"));
    std::fs::create_dir_all(&target_folder)
        .map_err(|e| format!("Failed to create target folder '{}': {}", target_folder.display(), e))?;

    for (photo_id, photo_path) in &photo_rows {
        let source_abs = Path::new(&storage_path).join(photo_path);
        let filename = source_abs
            .file_name()
            .ok_or_else(|| format!("Photo path has no filename: {}", source_abs.display()))?;
        let mut target_abs = target_folder.join(filename);

        if source_abs != target_abs {
            target_abs = unique_destination_path(&target_abs);
            std::fs::create_dir_all(
                target_abs
                    .parent()
                    .ok_or_else(|| format!("Target path has no parent: {}", target_abs.display()))?,
            )
            .map_err(|e| format!("Failed to prepare target folder for '{}': {}", target_abs.display(), e))?;
            std::fs::rename(&source_abs, &target_abs)
                .or_else(|_| {
                    std::fs::copy(&source_abs, &target_abs)?;
                    std::fs::remove_file(&source_abs)
                })
                .map_err(|e| format!("Failed to move '{}' to '{}': {}", source_abs.display(), target_abs.display(), e))?;
        }

        let relative = target_abs
            .strip_prefix(&storage_path)
            .map(|p| p.to_string_lossy().replace('\\', "/").trim_start_matches('/').to_string())
            .unwrap_or_else(|_| target_abs.to_string_lossy().replace('\\', "/"));
        tx.execute(
            "UPDATE find_photos SET photo_path = ?1 WHERE id = ?2",
            params![relative, photo_id],
        )
        .map_err(|e| format!("Failed to update photo path for photo {}: {}", photo_id, e))?;
    }

    for find_id in &find_ids {
        tx.execute(
            "UPDATE finds SET species_name = ?1 WHERE id = ?2",
            params![new_species_name, find_id],
        )
        .map_err(|e| format!("Bulk rename failed for id {}: {}", find_id, e))?;
    }

    for old_species_name in &old_species_names {
        tx.execute(
            "UPDATE zones SET species_name = ?1 WHERE species_name = ?2",
            params![new_species_name, old_species_name],
        )
        .map_err(|e| format!("Zone rename failed for '{}': {}", old_species_name, e))?;
        tx.execute(
            "UPDATE species_notes SET species_name = ?1 WHERE species_name = ?2 AND NOT EXISTS (SELECT 1 FROM species_notes WHERE species_name = ?1)",
            params![new_species_name, old_species_name],
        )
        .map_err(|e| format!("Species note rename failed for '{}': {}", old_species_name, e))?;
        tx.execute(
            "UPDATE species_profiles SET species_name = ?1 WHERE species_name = ?2 AND NOT EXISTS (SELECT 1 FROM species_profiles WHERE species_name = ?1)",
            params![new_species_name, old_species_name],
        )
        .map_err(|e| format!("Species profile rename failed for '{}': {}", old_species_name, e))?;
    }

    tx.commit().map_err(|e| e.to_string())?;

    for old_species_name in &old_species_names {
        let old_folder = Path::new(&storage_path).join(resolve_location_component(&old_species_name, "unknown_species"));
        remove_empty_dir_if_possible(&old_folder);
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

fn remove_empty_dir_if_possible(path: &Path) {
    if !path.exists() {
        return;
    }
    if std::fs::read_dir(path).map(|mut entries| entries.next().is_none()).unwrap_or(false) {
        let _ = std::fs::remove_dir(path);
    }
}

#[tauri::command]
pub async fn set_find_favorite(
    storage_path: String,
    find_id: i64,
    is_favorite: bool,
) -> Result<FindRecord, String> {
    let conn = open_db(&storage_path)?;
    let favorite_value = if is_favorite { 1i64 } else { 0i64 };

    let rows_affected = conn
        .execute(
            "UPDATE finds SET is_favorite = ?1 WHERE id = ?2",
            params![favorite_value, find_id],
        )
        .map_err(|e| format!("Favorite update failed: {}", e))?;

    if rows_affected == 0 {
        return Err("find not found".into());
    }

    let mut record = conn
        .query_row(
            "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at FROM finds WHERE id = ?1",
            params![find_id],
            |row| crate::commands::import::find_record_from_row(row),
        )
        .map_err(|e| format!("Failed to read updated favorite record: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, find_id, photo_path, is_primary FROM find_photos WHERE find_id = ?1 ORDER BY is_primary DESC, id ASC",
        )
        .map_err(|e| e.to_string())?;
    let photos: Vec<FindPhoto> = stmt
        .query_map(params![find_id], |row| {
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

#[tauri::command]
pub async fn cleanup_internal_records(storage_path: String) -> Result<i64, String> {
    let mut conn = open_db(&storage_path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let deleted_finds = tx
        .execute(
            &format!("DELETE FROM finds WHERE {}", INTERNAL_SPECIES_FILTER),
            [],
        )
        .map_err(|e| format!("Failed to delete internal finds: {}", e))? as i64;

    tx.execute(
        &format!("DELETE FROM species_notes WHERE {}", INTERNAL_SPECIES_FILTER),
        [],
    )
    .map_err(|e| format!("Failed to delete internal species notes: {}", e))?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(deleted_finds)
}

#[tauri::command]
pub async fn add_find_photos(
    storage_path: String,
    find_id: i64,
    source_paths: Vec<String>,
) -> Result<FindRecord, String> {
    let conn = open_db(&storage_path)?;

    // Fetch the find record to get species_name, date_found, location_note
    let (species_name, date_found, location_note): (String, String, String) = conn
        .query_row(
            "SELECT species_name, date_found, location_note FROM finds WHERE id = ?1",
            params![find_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| format!("Could not locate find {}: {}", find_id, e))?;

    let location_label = location_note.trim().to_string();

    // Determine dest folder from the first existing photo's parent directory
    let first_photo_path: Option<String> = conn
        .query_row(
            "SELECT photo_path FROM find_photos WHERE find_id = ?1 ORDER BY is_primary DESC, id ASC LIMIT 1",
            params![find_id],
            |row| row.get(0),
        )
        .ok();

    let dest_folder: std::path::PathBuf = if let Some(ref rel_path) = first_photo_path {
        let abs = std::path::Path::new(&storage_path).join(rel_path);
        abs.parent()
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| std::path::Path::new(&storage_path).to_path_buf())
    } else {
        // No existing photos — derive folder the same way as import
        let probe = build_dest_path(&storage_path, &species_name, &date_found, &location_label, 1, ".jpg");
        probe.parent()
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| std::path::Path::new(&storage_path).to_path_buf())
    };

    std::fs::create_dir_all(&dest_folder)
        .map_err(|e| format!("Failed to create destination folder '{}': {}", dest_folder.display(), e))?;

    for source_path in &source_paths {
        let ext = std::path::Path::new(source_path)
            .extension()
            .map(|e| format!(".{}", e.to_string_lossy().to_lowercase()))
            .unwrap_or_else(|| ".jpg".to_string());

        let seq = next_seq_for_folder(&dest_folder);
        let dest_path = build_dest_path(
            &storage_path,
            &species_name,
            &date_found,
            &location_label,
            seq,
            &ext,
        );

        std::fs::copy(source_path, &dest_path)
            .map_err(|e| format!("Failed to copy '{}' to '{}': {}", source_path, dest_path.display(), e))?;

        let relative = dest_path
            .strip_prefix(&storage_path)
            .map(|p| p.to_string_lossy().replace('\\', "/").trim_start_matches('/').to_string())
            .unwrap_or_else(|_| dest_path.to_string_lossy().replace('\\', "/"));

        insert_find_photo(&conn, find_id, &relative, false)
            .map_err(|e| format!("DB insert photo failed: {}", e))?;
    }

    // Re-query the full find record with photos
    let mut record = conn
        .query_row(
            "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at FROM finds WHERE id = ?1",
            params![find_id],
            |row| crate::commands::import::find_record_from_row(row),
        )
        .map_err(|e| format!("Failed to read updated find record: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, find_id, photo_path, is_primary FROM find_photos WHERE find_id = ?1 ORDER BY is_primary DESC, id ASC",
        )
        .map_err(|e| e.to_string())?;
    let photos: Vec<FindPhoto> = stmt
        .query_map(params![find_id], |row| {
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

// ---------------------------------------------------------------------------
// delete_find_photo
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn delete_find_photo(
    storage_path: String,
    photo_id: i64,
    delete_file: bool,
) -> Result<FindRecord, String> {
    let conn = open_db(&storage_path)?;

    // 1. Look up the photo row
    let (find_id, photo_path, is_primary): (i64, String, bool) = conn
        .query_row(
            "SELECT find_id, photo_path, is_primary FROM find_photos WHERE id = ?1",
            params![photo_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get::<_, i64>(2)? == 1)),
        )
        .map_err(|_| "photo not found".to_string())?;

    // 2. Optionally delete the file from disk
    if delete_file {
        let abs_path = format!("{}/{}", storage_path, photo_path);
        if let Err(e) = std::fs::remove_file(&abs_path) {
            // Ignore "not found" errors — file may already be gone
            if e.kind() != std::io::ErrorKind::NotFound {
                eprintln!("remove_file failed for {}: {}", abs_path, e);
            }
        }
    }

    // 3. Delete the photo row
    conn.execute("DELETE FROM find_photos WHERE id = ?1", params![photo_id])
        .map_err(|e| format!("DB delete failed: {}", e))?;

    // 4. Primary promotion
    if is_primary {
        let remaining: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM find_photos WHERE find_id = ?1",
                params![find_id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        if remaining > 0 {
            conn.execute(
                "UPDATE find_photos SET is_primary = 1 WHERE id = (SELECT id FROM find_photos WHERE find_id = ?1 ORDER BY id ASC LIMIT 1)",
                params![find_id],
            )
            .map_err(|e| format!("Primary promotion failed: {}", e))?;
        }
    }

    // 5. Re-query full FindRecord
    let mut record = conn
        .query_row(
            "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at FROM finds WHERE id = ?1",
            params![find_id],
            |row| crate::commands::import::find_record_from_row(row),
        )
        .map_err(|e| format!("Failed to read updated find record: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, find_id, photo_path, is_primary FROM find_photos WHERE find_id = ?1 ORDER BY is_primary DESC, id ASC",
        )
        .map_err(|e| e.to_string())?;
    let photos: Vec<FindPhoto> = stmt
        .query_map(params![find_id], |row| {
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

// ---------------------------------------------------------------------------
// bulk_delete_find_photos
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn bulk_delete_find_photos(
    storage_path: String,
    photo_ids: Vec<i64>,
    delete_files: bool,
) -> Result<FindRecord, String> {
    if photo_ids.is_empty() {
        return Err("no photo_ids provided".into());
    }

    let conn = open_db(&storage_path)?;

    // Get find_id from first photo (all must belong to same find)
    let find_id: i64 = conn
        .query_row(
            "SELECT find_id FROM find_photos WHERE id = ?1",
            params![photo_ids[0]],
            |row| row.get(0),
        )
        .map_err(|_| "photo not found".to_string())?;

    let mut any_primary_deleted = false;

    for &photo_id in &photo_ids {
        let row: Option<(String, bool)> = conn
            .query_row(
                "SELECT photo_path, is_primary FROM find_photos WHERE id = ?1",
                params![photo_id],
                |row| Ok((row.get(0)?, row.get::<_, i64>(1)? == 1)),
            )
            .ok();

        if let Some((photo_path, is_primary)) = row {
            if is_primary {
                any_primary_deleted = true;
            }
            if delete_files {
                let abs_path = format!("{}/{}", storage_path, photo_path);
                if let Err(e) = std::fs::remove_file(&abs_path) {
                    if e.kind() != std::io::ErrorKind::NotFound {
                        eprintln!("remove_file failed for {}: {}", abs_path, e);
                    }
                }
            }
            conn.execute("DELETE FROM find_photos WHERE id = ?1", params![photo_id])
                .map_err(|e| format!("DB delete failed for photo {}: {}", photo_id, e))?;
        }
    }

    // Promote if needed
    if any_primary_deleted {
        let remaining: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM find_photos WHERE find_id = ?1",
                params![find_id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        if remaining > 0 {
            conn.execute(
                "UPDATE find_photos SET is_primary = 1 WHERE id = (SELECT id FROM find_photos WHERE find_id = ?1 ORDER BY id ASC LIMIT 1)",
                params![find_id],
            )
            .map_err(|e| format!("Primary promotion failed: {}", e))?;
        }
    }

    // Re-query full FindRecord
    let mut record = conn
        .query_row(
            "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at FROM finds WHERE id = ?1",
            params![find_id],
            |row| crate::commands::import::find_record_from_row(row),
        )
        .map_err(|e| format!("Failed to read updated find record: {}", e))?;

    let mut stmt = conn
        .prepare(
            "SELECT id, find_id, photo_path, is_primary FROM find_photos WHERE find_id = ?1 ORDER BY is_primary DESC, id ASC",
        )
        .map_err(|e| e.to_string())?;
    let photos: Vec<FindPhoto> = stmt
        .query_map(params![find_id], |row| {
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::import::test_helpers::{setup_in_memory_db, make_find_record};
    use crate::commands::import::{insert_find_photo, insert_find_row, find_record_from_row};

    // -----------------------------------------------------------------------
    // create_find tests
    // -----------------------------------------------------------------------

    fn make_create_payload(species_name: &str) -> CreateFindPayload {
        CreateFindPayload {
            species_name: species_name.to_string(),
            date_found: "2026-05-08".to_string(),
            country: "Croatia".to_string(),
            region: "Istria".to_string(),
            location_note: "".to_string(),
            lat: None,
            lng: None,
            notes: "".to_string(),
            observed_count: None,
            observed_count_min: None,
            observed_count_max: None,
        }
    }

    fn do_create_find(conn: &rusqlite::Connection, payload: &CreateFindPayload) -> Result<FindRecord, String> {
        if payload.species_name.trim().is_empty() {
            return Err("species_name cannot be empty".into());
        }
        let (observed_count, observed_count_min, observed_count_max) =
            crate::commands::import::normalize_observed_range_pub(
                payload.observed_count,
                payload.observed_count_min,
                payload.observed_count_max,
            );
        let created_at = "2026-05-08T10:00:00Z".to_string();
        let record = FindRecord {
            id: 0,
            original_filename: String::new(),
            species_name: payload.species_name.clone(),
            date_found: payload.date_found.clone(),
            country: payload.country.clone(),
            region: payload.region.clone(),
            location_note: payload.location_note.clone(),
            lat: payload.lat,
            lng: payload.lng,
            notes: payload.notes.clone(),
            observed_count,
            observed_count_min,
            observed_count_max,
            is_favorite: false,
            created_at,
            photos: vec![],
        };
        let new_id = insert_find_row(conn, &record).map_err(|e| e.to_string())?;
        let mut inserted = conn
            .query_row(
                "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at FROM finds WHERE id = ?1",
                rusqlite::params![new_id],
                |row| find_record_from_row(row),
            )
            .map_err(|e| e.to_string())?;
        inserted.photos = vec![];
        Ok(inserted)
    }

    #[test]
    fn test_create_find_inserts_find_row_no_photos() {
        let conn = setup_in_memory_db();
        let payload = make_create_payload("Boletus edulis");
        let record = do_create_find(&conn, &payload).expect("create_find");

        let find_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM finds WHERE id = ?1",
                rusqlite::params![record.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(find_count, 1, "exactly one finds row should exist");

        let photo_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM find_photos WHERE find_id = ?1",
                rusqlite::params![record.id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(photo_count, 0, "no find_photos rows should exist for a no-photo find");
    }

    #[test]
    fn test_create_find_returns_empty_photos_vec() {
        let conn = setup_in_memory_db();
        let payload = make_create_payload("Cantharellus cibarius");
        let record = do_create_find(&conn, &payload).expect("create_find");
        assert!(record.photos.is_empty(), "returned record.photos must be empty");
    }

    #[test]
    fn test_create_find_rejects_empty_species_name() {
        let conn = setup_in_memory_db();
        let payload = make_create_payload("   ");
        let result = do_create_find(&conn, &payload);
        assert!(result.is_err(), "empty species_name should return Err");
        assert!(
            result.unwrap_err().contains("species_name cannot be empty"),
            "error message should mention species_name"
        );
    }

    #[test]
    fn test_open_find_folder_photo_scope_no_photos_does_not_panic() {
        // Verifies that the photo-scope fallback path is taken when there are no photos.
        // We test the inner logic directly: query find_photos → Err → use species_folder.
        let conn = setup_in_memory_db();
        let record = make_find_record("nophoto.jpg", "2026-05-08");
        let find_id = insert_find_row(&conn, &record).expect("insert find");
        // Do NOT insert any find_photos row

        // Simulate the open_find_folder photo-scope branch
        let photo_path_result: Result<String, _> = conn.query_row(
            "SELECT photo_path FROM find_photos WHERE find_id = ?1 ORDER BY is_primary DESC, id ASC LIMIT 1",
            rusqlite::params![find_id],
            |row| row.get(0),
        );

        // With no photos, this must be an Err
        assert!(photo_path_result.is_err(), "no photos means query should return Err");

        // The fallback path in open_find_folder: if photo_path_result is Err, use species_folder
        // Verify this succeeds without panicking (the actual folder open is a process spawn we skip here)
        let species_name: String = conn
            .query_row(
                "SELECT species_name FROM finds WHERE id = ?1",
                rusqlite::params![find_id],
                |row| row.get(0),
            )
            .expect("find exists");

        // species_folder fallback logic — ensure it does not error
        let tmp_dir = tempfile::tempdir().expect("tempdir");
        let storage_path = tmp_dir.path().to_str().unwrap();
        let species_folder = std::path::Path::new(storage_path)
            .join(crate::commands::path_builder::resolve_location_component(&species_name, "unknown_species"));
        // Ensure folder can be created on demand
        std::fs::create_dir_all(&species_folder).expect("create species folder");
        assert!(species_folder.exists(), "species folder should exist after creation");
    }

    #[test]
    fn test_delete_find_removes_record() {
        let conn = setup_in_memory_db();
        let record = make_find_record("mushroom.jpg", "2024-05-10");
        let find_id = insert_find_row(&conn, &record).expect("insert find");
        insert_find_photo(&conn, find_id, "Croatia/Region/2024-05-10/mushroom_1.jpg", true)
            .expect("insert photo");

        // delete_files = false path: just delete the DB record
        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn.execute("DELETE FROM finds WHERE id = ?1", params![find_id])
            .expect("delete find");

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM finds WHERE id = ?1",
                params![find_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 0, "find should be deleted");
    }

    #[test]
    fn test_delete_find_cascades_to_photos() {
        let conn = setup_in_memory_db();
        let record = make_find_record("mushroom.jpg", "2024-05-10");
        let find_id = insert_find_row(&conn, &record).expect("insert find");
        insert_find_photo(&conn, find_id, "Croatia/Region/2024-05-10/mushroom_1.jpg", true)
            .expect("insert primary photo");
        insert_find_photo(&conn, find_id, "Croatia/Region/2024-05-10/mushroom_2.jpg", false)
            .expect("insert secondary photo");

        conn.execute_batch("PRAGMA foreign_keys = ON;").unwrap();
        conn.execute("DELETE FROM finds WHERE id = ?1", params![find_id])
            .expect("delete find");

        let photo_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM find_photos WHERE find_id = ?1",
                params![find_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(photo_count, 0, "find_photos should cascade-delete");
    }

    #[test]
    fn test_get_find_photos_returns_photos() {
        let conn = setup_in_memory_db();
        let record = make_find_record("mushroom.jpg", "2024-05-10");
        let find_id = insert_find_row(&conn, &record).expect("insert find");
        insert_find_photo(&conn, find_id, "Croatia/Region/2024-05-10/mushroom_1.jpg", true)
            .expect("insert primary photo");
        insert_find_photo(&conn, find_id, "Croatia/Region/2024-05-10/mushroom_2.jpg", false)
            .expect("insert secondary photo");

        let mut stmt = conn
            .prepare(
                "SELECT id, find_id, photo_path, is_primary FROM find_photos WHERE find_id = ?1 ORDER BY is_primary DESC, id ASC",
            )
            .unwrap();
        let photos: Vec<FindPhoto> = stmt
            .query_map(params![find_id], |row| {
                Ok(FindPhoto {
                    id: row.get(0)?,
                    find_id: row.get(1)?,
                    photo_path: row.get(2)?,
                    is_primary: row.get::<_, i64>(3)? == 1,
                })
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert_eq!(photos.len(), 2, "should return 2 photos");
        assert!(photos[0].is_primary, "first photo should be primary");
        assert!(!photos[1].is_primary, "second photo should not be primary");
        assert_eq!(photos[0].find_id, find_id);
    }

    #[test]
    fn test_favorite_flag_can_be_updated() {
        let conn = setup_in_memory_db();
        let record = make_find_record("favorite.jpg", "2024-05-10");
        let find_id = insert_find_row(&conn, &record).expect("insert find");

        conn.execute(
            "UPDATE finds SET is_favorite = 1 WHERE id = ?1",
            params![find_id],
        )
        .expect("set favorite");

        let is_favorite: i64 = conn
            .query_row(
                "SELECT is_favorite FROM finds WHERE id = ?1",
                params![find_id],
                |row| row.get(0),
            )
            .expect("query favorite");

        assert_eq!(is_favorite, 1, "favorite flag should persist");
    }

    // -----------------------------------------------------------------------
    // Helper: delete_find_photo logic (synchronous, for unit testing)
    // -----------------------------------------------------------------------

    fn do_delete_find_photo(
        conn: &rusqlite::Connection,
        photo_id: i64,
    ) -> Result<FindRecord, String> {
        // 1. Look up photo row
        let (find_id, _photo_path, is_primary): (i64, String, bool) = conn
            .query_row(
                "SELECT find_id, photo_path, is_primary FROM find_photos WHERE id = ?1",
                params![photo_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get::<_, i64>(2)? == 1)),
            )
            .map_err(|_| "photo not found".to_string())?;

        // 2. Delete the photo row
        conn.execute("DELETE FROM find_photos WHERE id = ?1", params![photo_id])
            .map_err(|e| format!("delete failed: {}", e))?;

        // 3. Primary promotion
        if is_primary {
            let remaining: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM find_photos WHERE find_id = ?1",
                    params![find_id],
                    |row| row.get(0),
                )
                .unwrap_or(0);
            if remaining > 0 {
                conn.execute(
                    "UPDATE find_photos SET is_primary = 1 WHERE id = (SELECT id FROM find_photos WHERE find_id = ?1 ORDER BY id ASC LIMIT 1)",
                    params![find_id],
                )
                .map_err(|e| format!("promotion failed: {}", e))?;
            }
        }

        // 4. Return full FindRecord
        let mut record = conn
            .query_row(
                "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at FROM finds WHERE id = ?1",
                params![find_id],
                |row| find_record_from_row(row),
            )
            .map_err(|e| format!("find not found: {}", e))?;

        let mut stmt = conn
            .prepare("SELECT id, find_id, photo_path, is_primary FROM find_photos WHERE find_id = ?1 ORDER BY is_primary DESC, id ASC")
            .map_err(|e| e.to_string())?;
        let photos: Vec<FindPhoto> = stmt
            .query_map(params![find_id], |row| {
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

    fn do_bulk_delete_find_photos(
        conn: &rusqlite::Connection,
        photo_ids: &[i64],
    ) -> Result<FindRecord, String> {
        if photo_ids.is_empty() {
            return Err("no photo_ids provided".into());
        }

        // Get find_id from first photo
        let find_id: i64 = conn
            .query_row(
                "SELECT find_id FROM find_photos WHERE id = ?1",
                params![photo_ids[0]],
                |row| row.get(0),
            )
            .map_err(|_| "photo not found".to_string())?;

        let mut any_primary_deleted = false;
        for &photo_id in photo_ids {
            let is_primary: bool = conn
                .query_row(
                    "SELECT is_primary FROM find_photos WHERE id = ?1",
                    params![photo_id],
                    |row| Ok(row.get::<_, i64>(0)? == 1),
                )
                .unwrap_or(false);
            if is_primary {
                any_primary_deleted = true;
            }
            conn.execute("DELETE FROM find_photos WHERE id = ?1", params![photo_id])
                .map_err(|e| format!("delete failed: {}", e))?;
        }

        if any_primary_deleted {
            let remaining: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM find_photos WHERE find_id = ?1",
                    params![find_id],
                    |row| row.get(0),
                )
                .unwrap_or(0);
            if remaining > 0 {
                conn.execute(
                    "UPDATE find_photos SET is_primary = 1 WHERE id = (SELECT id FROM find_photos WHERE find_id = ?1 ORDER BY id ASC LIMIT 1)",
                    params![find_id],
                )
                .map_err(|e| format!("promotion failed: {}", e))?;
            }
        }

        let mut record = conn
            .query_row(
                "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at FROM finds WHERE id = ?1",
                params![find_id],
                |row| find_record_from_row(row),
            )
            .map_err(|e| format!("find not found: {}", e))?;

        let mut stmt = conn
            .prepare("SELECT id, find_id, photo_path, is_primary FROM find_photos WHERE find_id = ?1 ORDER BY is_primary DESC, id ASC")
            .map_err(|e| e.to_string())?;
        let photos: Vec<FindPhoto> = stmt
            .query_map(params![find_id], |row| {
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

    // -----------------------------------------------------------------------
    // delete_find_photo tests
    // -----------------------------------------------------------------------

    #[test]
    fn test_delete_find_photo_non_primary() {
        let conn = setup_in_memory_db();
        let record = make_find_record("mushroom.jpg", "2024-05-10");
        let find_id = insert_find_row(&conn, &record).expect("insert find");
        insert_find_photo(&conn, find_id, "Croatia/Region/2024-05-10/mushroom_1.jpg", true)
            .expect("insert primary photo");
        let secondary_id = insert_find_photo(&conn, find_id, "Croatia/Region/2024-05-10/mushroom_2.jpg", false)
            .expect("insert secondary photo");

        let result = do_delete_find_photo(&conn, secondary_id).expect("delete secondary");

        assert_eq!(result.photos.len(), 1, "one photo should remain");
        assert!(result.photos[0].is_primary, "remaining photo should still be primary");
    }

    #[test]
    fn test_delete_find_photo_primary_promotes_another() {
        let conn = setup_in_memory_db();
        let record = make_find_record("mushroom.jpg", "2024-05-10");
        let find_id = insert_find_row(&conn, &record).expect("insert find");
        let primary_id = insert_find_photo(&conn, find_id, "Croatia/Region/2024-05-10/mushroom_1.jpg", true)
            .expect("insert primary photo");
        insert_find_photo(&conn, find_id, "Croatia/Region/2024-05-10/mushroom_2.jpg", false)
            .expect("insert secondary photo");

        let result = do_delete_find_photo(&conn, primary_id).expect("delete primary");

        assert_eq!(result.photos.len(), 1, "one photo should remain");
        assert!(result.photos[0].is_primary, "remaining photo should be promoted to primary");
    }

    #[test]
    fn test_delete_find_photo_last_photo() {
        let conn = setup_in_memory_db();
        let record = make_find_record("mushroom.jpg", "2024-05-10");
        let find_id = insert_find_row(&conn, &record).expect("insert find");
        let only_id = insert_find_photo(&conn, find_id, "Croatia/Region/2024-05-10/mushroom_1.jpg", true)
            .expect("insert only photo");

        let result = do_delete_find_photo(&conn, only_id).expect("delete only photo");

        // Find should still exist
        let find_count: i64 = conn
            .query_row("SELECT COUNT(*) FROM finds WHERE id = ?1", params![find_id], |row| row.get(0))
            .unwrap();
        assert_eq!(find_count, 1, "find should still exist");
        assert!(result.photos.is_empty(), "photos should be empty");
    }

    #[test]
    fn test_bulk_delete_find_photos() {
        let conn = setup_in_memory_db();
        let record = make_find_record("mushroom.jpg", "2024-05-10");
        let find_id = insert_find_row(&conn, &record).expect("insert find");
        let primary_id = insert_find_photo(&conn, find_id, "Croatia/Region/2024-05-10/mushroom_1.jpg", true)
            .expect("insert primary photo");
        let secondary_id = insert_find_photo(&conn, find_id, "Croatia/Region/2024-05-10/mushroom_2.jpg", false)
            .expect("insert secondary photo");
        insert_find_photo(&conn, find_id, "Croatia/Region/2024-05-10/mushroom_3.jpg", false)
            .expect("insert third photo");

        let result = do_bulk_delete_find_photos(&conn, &[primary_id, secondary_id]).expect("bulk delete");

        assert_eq!(result.photos.len(), 1, "one photo should remain");
        assert!(result.photos[0].is_primary, "remaining photo should be promoted to primary");
    }
}
