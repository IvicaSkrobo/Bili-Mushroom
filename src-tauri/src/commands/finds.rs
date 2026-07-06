use chrono::Utc;
use rusqlite::params;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::process::Command;

use crate::commands::import::{
    find_record_from_row, first_gps_coords_from_paths, insert_find_photo, insert_find_row,
    open_db, remember_source_path, upsert_species_common_name, FindPhoto, FindRecord,
};
use crate::commands::path_builder::{
    build_dest_path, next_seq_for_folder, plain_species_name, resolve_location_component,
};

// ---------------------------------------------------------------------------
// create_find
// ---------------------------------------------------------------------------

#[derive(serde::Deserialize)]
pub struct CreateFindPayload {
    pub species_name: String,
    #[serde(default)]
    pub common_name: Option<String>,
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
    pub edibility_note: Option<String>,
}

#[tauri::command]
pub async fn create_find(
    storage_path: String,
    payload: CreateFindPayload,
) -> Result<FindRecord, String> {
    if payload.species_name.trim().is_empty() {
        return Err("species_name cannot be empty".into());
    }
    let inserted_species_name = payload.species_name.trim().to_string();

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
        species_name: inserted_species_name.clone(),
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
        edibility_note: payload.edibility_note,
        photo_count: Some(0),
        photos: vec![],
    };

    let new_id =
        insert_find_row(&conn, &record).map_err(|e| format!("Failed to insert find: {}", e))?;

    upsert_species_common_name(
        &conn,
        &inserted_species_name,
        payload.common_name.as_deref(),
    )?;

    let mut inserted = conn
        .query_row(
            "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note FROM finds WHERE id = ?1",
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
    pub common_name: Option<String>,
    pub cover_photo_id: Option<i64>,
    pub tags: Vec<String>,
    pub edibility: Option<String>,
    pub threat_status: Option<String>,
    pub distribution: Option<String>,
    pub edibility_note: Option<String>,
    pub description: Option<String>,
    pub synonyms: Vec<String>,
    pub other_names: Vec<String>,
    pub fruiting_body_count_override: Option<String>,
}

#[derive(serde::Deserialize)]
pub struct CropRect {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

fn read_exif_orientation(path: &Path) -> Option<u32> {
    let file = File::open(path).ok()?;
    let mut reader = BufReader::new(file);
    let exif = exif::Reader::new().read_from_container(&mut reader).ok()?;
    let field = exif.get_field(exif::Tag::Orientation, exif::In::PRIMARY)?;
    field.value.get_uint(0)
}

fn apply_exif_orientation(
    image: image::DynamicImage,
    orientation: Option<u32>,
) -> image::DynamicImage {
    match orientation.unwrap_or(1) {
        2 => image.fliph(),
        3 => image.rotate180(),
        4 => image.flipv(),
        5 => image.fliph().rotate90(),
        6 => image.rotate90(),
        7 => image.fliph().rotate270(),
        8 => image.rotate270(),
        _ => image,
    }
}

fn is_safe_relative_photo_path(photo_path: &str) -> bool {
    let path = Path::new(photo_path);
    !path.is_absolute()
        && path.components().all(|component| {
            !matches!(
                component,
                std::path::Component::ParentDir | std::path::Component::Prefix(_)
            )
        })
}

fn thumbnail_relative_path(photo_path: &str, size: u32) -> String {
    let mut hasher = Sha256::new();
    hasher.update(photo_path.replace('\\', "/").as_bytes());
    let hash = format!("{:x}", hasher.finalize());
    format!(".bili-cache/thumbnails/{}_{}.jpg", &hash[..20], size)
}

fn generate_photo_thumbnail_blocking(
    storage_path: &str,
    photo_path: &str,
    size: u32,
) -> Result<String, String> {
    if !is_safe_relative_photo_path(photo_path) {
        return Err("photo_path must be relative to the library folder".into());
    }

    let size = size.clamp(64, 768);
    let normalized_photo_path = photo_path.replace('/', std::path::MAIN_SEPARATOR_STR);
    let source_path = Path::new(storage_path).join(normalized_photo_path);
    if !source_path.exists() {
        return Err(format!("Photo file does not exist: {}", photo_path));
    }

    let relative_thumb = thumbnail_relative_path(photo_path, size);
    let thumb_path =
        Path::new(storage_path).join(relative_thumb.replace('/', std::path::MAIN_SEPARATOR_STR));

    let source_modified = std::fs::metadata(&source_path)
        .and_then(|meta| meta.modified())
        .ok();
    let thumb_is_current = thumb_path.exists()
        && match (
            source_modified,
            std::fs::metadata(&thumb_path)
                .and_then(|meta| meta.modified())
                .ok(),
        ) {
            (Some(source_time), Some(thumb_time)) => thumb_time >= source_time,
            _ => true,
        };
    if thumb_is_current {
        return Ok(relative_thumb);
    }

    if let Some(parent) = thumb_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create thumbnail cache folder: {}", e))?;
    }

    let orientation = read_exif_orientation(&source_path);
    let image = image::open(&source_path)
        .map_err(|e| format!("Failed to decode thumbnail source: {}", e))?;
    let thumb = apply_exif_orientation(image, orientation).thumbnail(size, size);
    thumb
        .save_with_format(&thumb_path, image::ImageFormat::Jpeg)
        .map_err(|e| format!("Failed to write thumbnail: {}", e))?;

    Ok(relative_thumb)
}

#[tauri::command]
pub async fn get_photo_thumbnail(
    storage_path: String,
    photo_path: String,
    size: Option<u32>,
) -> Result<String, String> {
    let size = size.unwrap_or(256);
    tauri::async_runtime::spawn_blocking(move || {
        generate_photo_thumbnail_blocking(&storage_path, &photo_path, size)
    })
    .await
    .map_err(|e| format!("Thumbnail worker failed: {}", e))?
}

#[derive(serde::Serialize)]
pub struct ThumbnailWarmupSummary {
    pub processed: u32,
    pub failed: u32,
}

#[tauri::command]
pub async fn warm_photo_thumbnail_cache(
    storage_path: String,
    size: Option<u32>,
    limit: Option<u32>,
) -> Result<ThumbnailWarmupSummary, String> {
    let size = size.unwrap_or(256).clamp(64, 768);
    let limit = limit.unwrap_or(40).clamp(1, 500);
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        let mut stmt = conn
            .prepare(
                "SELECT photo_path
                 FROM find_photos
                 GROUP BY photo_path
                 ORDER BY MIN(id) ASC
                 LIMIT ?1",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![limit], |row| row.get::<_, String>(0))
            .map_err(|e| e.to_string())?;

        let mut processed = 0u32;
        let mut failed = 0u32;
        for row in rows {
            match row {
                Ok(photo_path) => match generate_photo_thumbnail_blocking(&storage_path, &photo_path, size) {
                    Ok(_) => processed += 1,
                    Err(_) => failed += 1,
                },
                Err(_) => failed += 1,
            }
        }

        Ok(ThumbnailWarmupSummary { processed, failed })
    })
    .await
    .map_err(|e| format!("Thumbnail warmup worker failed: {}", e))?
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct SpeciesRecipe {
    pub id: i64,
    pub species_name: String,
    pub title: String,
    pub notes: String,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub async fn get_species_notes(storage_path: String) -> Result<Vec<SpeciesNote>, String> {
    let conn = open_db(&storage_path)?;
    let mut stmt = conn
        .prepare("SELECT species_name, notes FROM species_notes ORDER BY species_name")
        .map_err(|e| e.to_string())?;
    let notes = stmt
        .query_map([], |row| {
            Ok(SpeciesNote {
                species_name: row.get(0)?,
                notes: row.get(1)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(notes)
}

#[tauri::command]
pub async fn get_species_profiles(storage_path: String) -> Result<Vec<SpeciesProfile>, String> {
    let conn = open_db(&storage_path)?;
    let mut stmt = conn
        .prepare("SELECT species_name, common_name, cover_photo_id, tags_json, edibility, threat_status, distribution, edibility_note, description, synonyms, other_names, fruiting_body_count_override FROM species_profiles ORDER BY species_name")
        .map_err(|e| e.to_string())?;
    let profiles = stmt
        .query_map([], |row| {
            let tags_json: String = row.get(3)?;
            let synonyms_json: Option<String> = row.get(9)?;
            let other_names_json: Option<String> = row.get(10)?;
            Ok(SpeciesProfile {
                species_name: row.get(0)?,
                common_name: row.get(1)?,
                cover_photo_id: row.get(2)?,
                tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                edibility: row.get(4)?,
                threat_status: row.get(5)?,
                distribution: row.get(6)?,
                edibility_note: row.get(7)?,
                description: row.get(8)?,
                synonyms: synonyms_json
                    .as_deref()
                    .and_then(|s| serde_json::from_str(s).ok())
                    .unwrap_or_default(),
                other_names: other_names_json
                    .as_deref()
                    .and_then(|s| serde_json::from_str(s).ok())
                    .unwrap_or_default(),
                fruiting_body_count_override: row.get(11)?,
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
    common_name: Option<String>,
    cover_photo_id: Option<i64>,
    tags: Vec<String>,
    edibility: Option<String>,
    threat_status: Option<String>,
    distribution: Option<String>,
    edibility_note: Option<String>,
    synonyms: Vec<String>,
    other_names: Vec<String>,
    fruiting_body_count_override: Option<String>,
    description: Option<String>,
) -> Result<(), String> {
    let conn = open_db(&storage_path)?;
    let updated_at = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let tags_json = serde_json::to_string(&tags)
        .map_err(|e| format!("Failed to encode species tags: {}", e))?;
    let synonyms_json = serde_json::to_string(&synonyms)
        .map_err(|e| format!("Failed to encode synonyms: {}", e))?;
    let other_names_json = serde_json::to_string(&other_names)
        .map_err(|e| format!("Failed to encode other_names: {}", e))?;
    conn.execute(
        "INSERT INTO species_profiles (species_name, common_name, cover_photo_id, tags_json, updated_at, edibility, threat_status, distribution, edibility_note, synonyms, other_names, fruiting_body_count_override, description)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
         ON CONFLICT(species_name) DO UPDATE SET
           common_name = COALESCE(excluded.common_name, species_profiles.common_name),
           cover_photo_id = excluded.cover_photo_id,
           tags_json = excluded.tags_json,
           updated_at = excluded.updated_at,
           edibility = excluded.edibility,
           threat_status = excluded.threat_status,
           distribution = excluded.distribution,
           edibility_note = excluded.edibility_note,
           synonyms = excluded.synonyms,
           other_names = excluded.other_names,
           fruiting_body_count_override = excluded.fruiting_body_count_override,
           description = excluded.description",
        params![species_name, common_name, cover_photo_id, tags_json, updated_at, edibility, threat_status, distribution, edibility_note, synonyms_json, other_names_json, fruiting_body_count_override, description],
    )
    .map_err(|e| format!("Upsert species profile failed: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_species_recipes(storage_path: String) -> Result<Vec<SpeciesRecipe>, String> {
    let conn = open_db(&storage_path)?;
    let mut stmt = conn
        .prepare("SELECT id, species_name, title, notes, created_at, updated_at FROM species_recipes ORDER BY species_name, id")
        .map_err(|e| e.to_string())?;
    let recipes = stmt
        .query_map([], |row| {
            Ok(SpeciesRecipe {
                id: row.get(0)?,
                species_name: row.get(1)?,
                title: row.get(2)?,
                notes: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(recipes)
}

#[tauri::command]
pub async fn upsert_species_recipe(
    storage_path: String,
    id: Option<i64>,
    species_name: String,
    title: String,
    notes: String,
) -> Result<SpeciesRecipe, String> {
    let conn = open_db(&storage_path)?;
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let recipe_id = match id {
        Some(existing_id) => {
            conn.execute(
                "UPDATE species_recipes SET species_name = ?1, title = ?2, notes = ?3, updated_at = ?4 WHERE id = ?5",
                params![species_name, title, notes, now, existing_id],
            )
            .map_err(|e| format!("Update species recipe failed: {}", e))?;
            existing_id
        }
        None => {
            conn.execute(
                "INSERT INTO species_recipes (species_name, title, notes, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?4)",
                params![species_name, title, notes, now],
            )
            .map_err(|e| format!("Insert species recipe failed: {}", e))?;
            conn.last_insert_rowid()
        }
    };

    conn.query_row(
        "SELECT id, species_name, title, notes, created_at, updated_at FROM species_recipes WHERE id = ?1",
        params![recipe_id],
        |row| {
            Ok(SpeciesRecipe {
                id: row.get(0)?,
                species_name: row.get(1)?,
                title: row.get(2)?,
                notes: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        },
    )
    .map_err(|e| format!("Read species recipe failed: {}", e))
}

#[tauri::command]
pub async fn delete_species_recipe(storage_path: String, id: i64) -> Result<(), String> {
    let conn = open_db(&storage_path)?;
    conn.execute("DELETE FROM species_recipes WHERE id = ?1", params![id])
        .map_err(|e| format!("Delete species recipe failed: {}", e))?;
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
            std::fs::remove_file(&abs_src)
                .map_err(|e| format!("Copied '{}' but could not remove source: {}", abs_src, e))?;
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
    let species_folder = Path::new(&storage_path).join(resolve_location_component(
        &plain_species_name(&species_name),
        "unknown_species",
    ));
    let folder_path = if preferred_scope == "photo" {
        // If the find has no photos, fall back to the species folder instead of erroring
        if let Ok(photo_path) = photo_path_result {
            let absolute_photo_path = Path::new(&storage_path).join(&photo_path);
            absolute_photo_path
                .parent()
                .map(PathBuf::from)
                .ok_or_else(|| {
                    "Could not determine the containing folder for this find.".to_string()
                })?
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
        let photo_path = photo_path_result.map_err(|e| {
            format!(
                "Could not locate the species folder or a photo for this find: {}",
                e
            )
        })?;
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
pub async fn open_species_folder(storage_path: String, species_name: String) -> Result<(), String> {
    let species_folder = Path::new(&storage_path).join(resolve_location_component(
        &plain_species_name(&species_name),
        "unknown_species",
    ));

    let folder_path = if species_folder.exists() {
        species_folder
    } else {
        let conn = open_db(&storage_path)?;
        let photo_path_result: Result<String, _> = conn.query_row(
            "SELECT fp.photo_path
             FROM finds f
             JOIN find_photos fp ON fp.find_id = f.id
             WHERE f.species_name = ?1
             ORDER BY fp.is_primary DESC, fp.id ASC
             LIMIT 1",
            params![species_name],
            |row| row.get(0),
        );

        if let Ok(photo_path) = photo_path_result {
            let absolute_photo_path = Path::new(&storage_path).join(&photo_path);
            absolute_photo_path
                .parent()
                .map(PathBuf::from)
                .ok_or_else(|| {
                    "Could not determine the species folder from its photos.".to_string()
                })?
        } else {
            std::fs::create_dir_all(&species_folder)
                .map_err(|e| format!("Could not create species folder: {}", e))?;
            species_folder
        }
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
pub async fn get_find_photos(storage_path: String, find_id: i64) -> Result<Vec<FindPhoto>, String> {
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
            .query_map(params![find_id], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        photo_rows.extend(rows);
    }

    let target_folder = Path::new(&storage_path).join(resolve_location_component(
        &plain_species_name(&new_species_name),
        "unknown_species",
    ));
    let mut old_folders: Vec<PathBuf> = old_species_names
        .iter()
        .map(|name| {
            Path::new(&storage_path).join(resolve_location_component(
                &plain_species_name(name),
                "unknown_species",
            ))
        })
        .collect();
    old_folders.sort();
    old_folders.dedup();

    let renamed_whole_folder =
        if old_folders.len() == 1 && old_folders[0].exists() && !target_folder.exists() {
            std::fs::rename(&old_folders[0], &target_folder).is_ok()
        } else {
            false
        };

    if !renamed_whole_folder {
        std::fs::create_dir_all(&target_folder).map_err(|e| {
            format!(
                "Failed to create target folder '{}': {}",
                target_folder.display(),
                e
            )
        })?;
    }

    for (photo_id, photo_path) in &photo_rows {
        // Normalize DB-stored forward slashes to the OS separator so the
        // path comparison below works correctly on Windows (mixed separators
        // would make source_abs != target_abs even for the same file).
        let normalized_photo_path = photo_path.replace('/', std::path::MAIN_SEPARATOR_STR);
        let source_abs = Path::new(&storage_path).join(&normalized_photo_path);
        let filename = source_abs
            .file_name()
            .ok_or_else(|| format!("Photo path has no filename: {}", source_abs.display()))?;
        let mut target_abs = target_folder.join(filename);

        if source_abs != target_abs && !renamed_whole_folder {
            if source_abs.exists() {
                target_abs = unique_destination_path(&target_abs);
                std::fs::create_dir_all(target_abs.parent().ok_or_else(|| {
                    format!("Target path has no parent: {}", target_abs.display())
                })?)
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
            // Update DB path regardless — heals stale paths from partial earlier renames
        }

        let relative = target_abs
            .strip_prefix(&storage_path)
            .map(|p| {
                p.to_string_lossy()
                    .replace('\\', "/")
                    .trim_start_matches('/')
                    .to_string()
            })
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
        let old_folder = Path::new(&storage_path).join(resolve_location_component(
            &plain_species_name(&old_species_name),
            "unknown_species",
        ));
        remove_empty_dir_if_possible(&old_folder);
    }

    Ok(())
}

#[tauri::command]
pub async fn rename_species_folder(
    storage_path: String,
    old_species_name: String,
    new_species_name: String,
) -> Result<(), String> {
    let old_species_name = old_species_name.trim().to_string();
    let new_species_name = new_species_name.trim().to_string();
    if old_species_name.is_empty() || new_species_name.is_empty() {
        return Err("species names cannot be empty".into());
    }
    if old_species_name == new_species_name {
        return Ok(());
    }

    let find_ids: Vec<i64> = {
        let conn = open_db(&storage_path)?;
        let mut stmt = conn
            .prepare("SELECT id FROM finds WHERE species_name = ?1 ORDER BY id ASC")
            .map_err(|e| e.to_string())?;
        let ids = stmt
            .query_map(params![old_species_name], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        ids
    };

    bulk_rename_species(storage_path, find_ids, new_species_name).await
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
    if std::fs::read_dir(path)
        .map(|mut entries| entries.next().is_none())
        .unwrap_or(false)
    {
        let _ = std::fs::remove_dir(path);
    }
}

fn backup_db_before_destructive_change(
    storage_path: &str,
    reason: &str,
) -> Result<Option<String>, String> {
    let db_path = Path::new(storage_path).join("bili-mushroom.db");
    if !db_path.exists() {
        return Ok(None);
    }

    let backup_dir = Path::new(storage_path).join(".bili-backups");
    std::fs::create_dir_all(&backup_dir).map_err(|e| {
        format!(
            "Failed to create backup folder '{}': {}",
            backup_dir.display(),
            e
        )
    })?;

    let safe_reason: String = reason
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect();
    let timestamp = Utc::now().format("%Y%m%d-%H%M%S").to_string();
    let backup_path = backup_dir.join(format!("bili-mushroom-{timestamp}-{safe_reason}.db"));

    std::fs::copy(&db_path, &backup_path).map_err(|e| {
        format!(
            "Failed to back up database from '{}' to '{}': {}",
            db_path.display(),
            backup_path.display(),
            e
        )
    })?;

    Ok(Some(backup_path.to_string_lossy().to_string()))
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
            "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note FROM finds WHERE id = ?1",
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

    let stale_count: i64 = conn
        .query_row(
            &format!(
                "SELECT COUNT(*) FROM finds WHERE {}",
                INTERNAL_SPECIES_FILTER
            ),
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count internal finds: {}", e))?;
    if stale_count > 0 {
        backup_db_before_destructive_change(&storage_path, "cleanup-internal-records")?;
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let deleted_finds =
        tx.execute(
            &format!("DELETE FROM finds WHERE {}", INTERNAL_SPECIES_FILTER),
            [],
        )
        .map_err(|e| format!("Failed to delete internal finds: {}", e))? as i64;

    tx.execute(
        &format!(
            "DELETE FROM species_notes WHERE {}",
            INTERNAL_SPECIES_FILTER
        ),
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
        let probe = build_dest_path(
            &storage_path,
            &species_name,
            &date_found,
            &location_label,
            1,
            ".jpg",
        );
        probe
            .parent()
            .map(std::path::PathBuf::from)
            .unwrap_or_else(|| std::path::Path::new(&storage_path).to_path_buf())
    };

    std::fs::create_dir_all(&dest_folder).map_err(|e| {
        format!(
            "Failed to create destination folder '{}': {}",
            dest_folder.display(),
            e
        )
    })?;

    let mut seen_source_paths: HashSet<String> = HashSet::new();
    for source_path in &source_paths {
        if !remember_source_path(&mut seen_source_paths, source_path) {
            continue;
        }

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

        std::fs::copy(source_path, &dest_path).map_err(|e| {
            format!(
                "Failed to copy '{}' to '{}': {}",
                source_path,
                dest_path.display(),
                e
            )
        })?;

        let relative = dest_path
            .strip_prefix(&storage_path)
            .map(|p| {
                p.to_string_lossy()
                    .replace('\\', "/")
                    .trim_start_matches('/')
                    .to_string()
            })
            .unwrap_or_else(|_| dest_path.to_string_lossy().replace('\\', "/"));

        insert_find_photo(&conn, find_id, &relative, false)
            .map_err(|e| format!("DB insert photo failed: {}", e))?;
    }

    // Backfill find lat/lng from the first GPS-tagged newly-added photo, but only if
    // the find does not already have coordinates. Manual edits (via EditFindDialog)
    // always win — this UPDATE is a no-op if either lat or lng is already set.
    if let Some((lat, lng)) = first_gps_coords_from_paths(
        &source_paths.iter().map(String::as_str).collect::<Vec<_>>(),
    ) {
        conn.execute(
            "UPDATE finds SET lat = ?1, lng = ?2 WHERE id = ?3 AND lat IS NULL AND lng IS NULL",
            params![lat, lng, find_id],
        )
        .map_err(|e| format!("Failed to backfill lat/lng from EXIF: {}", e))?;
    }

    // Re-query the full find record with photos
    let mut record = conn
        .query_row(
            "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note FROM finds WHERE id = ?1",
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
    permanent_delete: Option<bool>,
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

    // 2. Optionally remove the file from disk. The UI exposes this as an
    // explicit checkbox so users can see whether deletion is permanent.
    if delete_file {
        let abs_path = format!("{}/{}", storage_path, photo_path);
        if permanent_delete.unwrap_or(false) {
            if let Err(e) = std::fs::remove_file(&abs_path) {
                if e.kind() != std::io::ErrorKind::NotFound {
                    eprintln!("remove_file failed for {}: {}", abs_path, e);
                }
            }
        } else if let Err(e) = trash::delete(&abs_path) {
            eprintln!("trash::delete failed for {}: {}", abs_path, e);
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
            "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note FROM finds WHERE id = ?1",
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
    permanent_delete: Option<bool>,
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

    // Validate: all photo_ids must belong to the same find
    for &photo_id in &photo_ids[1..] {
        let other_find_id: i64 = conn
            .query_row(
                "SELECT find_id FROM find_photos WHERE id = ?1",
                params![photo_id],
                |row| row.get(0),
            )
            .map_err(|_| format!("photo {} not found", photo_id))?;
        if other_find_id != find_id {
            return Err(format!(
                "photo {} belongs to find {} but expected find {}",
                photo_id, other_find_id, find_id
            ));
        }
    }

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
                if permanent_delete.unwrap_or(false) {
                    if let Err(e) = std::fs::remove_file(&abs_path) {
                        if e.kind() != std::io::ErrorKind::NotFound {
                            eprintln!("remove_file failed for {}: {}", abs_path, e);
                        }
                    }
                } else if let Err(e) = trash::delete(&abs_path) {
                    eprintln!("trash::delete failed for {}: {}", abs_path, e);
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
            "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note FROM finds WHERE id = ?1",
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

#[tauri::command]
pub async fn edit_find_photo_image(
    storage_path: String,
    photo_id: i64,
    rotate_degrees: Option<i32>,
    crop: Option<CropRect>,
) -> Result<(), String> {
    let conn = open_db(&storage_path)?;
    let photo_path: String = conn
        .query_row(
            "SELECT photo_path FROM find_photos WHERE id = ?1",
            params![photo_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Photo not found: {}", e))?;

    let absolute_path =
        Path::new(&storage_path).join(photo_path.replace('/', std::path::MAIN_SEPARATOR_STR));
    if !absolute_path.exists() {
        return Err(format!(
            "Photo file does not exist: {}",
            absolute_path.display()
        ));
    }

    tauri::async_runtime::spawn_blocking(move || {
        let mut image = image::open(&absolute_path)
            .map_err(|e| format!("Failed to open image for editing: {}", e))?;

        image = apply_exif_orientation(image, read_exif_orientation(&absolute_path));

        match rotate_degrees.unwrap_or(0).rem_euclid(360) {
            90 => image = image.rotate90(),
            180 => image = image.rotate180(),
            270 => image = image.rotate270(),
            0 => {}
            other => return Err(format!("Unsupported rotation angle: {}", other)),
        }

        if let Some(rect) = crop {
            let img_w = image.width();
            let img_h = image.height();
            if rect.width == 0 || rect.height == 0 || rect.x >= img_w || rect.y >= img_h {
                return Err("Invalid crop rectangle".into());
            }
            let width = rect.width.min(img_w.saturating_sub(rect.x));
            let height = rect.height.min(img_h.saturating_sub(rect.y));
            if width == 0 || height == 0 {
                return Err("Invalid crop rectangle".into());
            }
            image = image.crop_imm(rect.x, rect.y, width, height);
        }

        let file_stem = absolute_path
            .file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or("edited-photo");
        let extension = absolute_path
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("jpg");
        let temp_path = absolute_path.with_file_name(format!(
            ".{}.editing.{}.{}",
            file_stem,
            std::process::id(),
            extension,
        ));
        image
            .save(&temp_path)
            .map_err(|e| format!("Failed to save edited image: {}", e))?;
        std::fs::copy(&temp_path, &absolute_path)
            .map_err(|e| format!("Failed to overwrite original image: {}", e))?;
        let _ = std::fs::remove_file(&temp_path);

        Ok(())
    })
    .await
    .map_err(|e| format!("Image edit task failed: {}", e))??;

    Ok(())
}

#[tauri::command]
pub async fn edit_source_photo_image(
    source_path: String,
    rotate_degrees: Option<i32>,
    crop: Option<CropRect>,
) -> Result<String, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!(
            "Source photo file does not exist: {}",
            source.display()
        ));
    }

    tauri::async_runtime::spawn_blocking(move || {
        let mut image = image::open(&source)
            .map_err(|e| format!("Failed to open source image for editing: {}", e))?;

        image = apply_exif_orientation(image, read_exif_orientation(&source));

        match rotate_degrees.unwrap_or(0).rem_euclid(360) {
            90 => image = image.rotate90(),
            180 => image = image.rotate180(),
            270 => image = image.rotate270(),
            0 => {}
            other => return Err(format!("Unsupported rotation angle: {}", other)),
        }

        if let Some(rect) = crop {
            let img_w = image.width();
            let img_h = image.height();
            if rect.width == 0 || rect.height == 0 || rect.x >= img_w || rect.y >= img_h {
                return Err("Invalid crop rectangle".into());
            }
            let width = rect.width.min(img_w.saturating_sub(rect.x));
            let height = rect.height.min(img_h.saturating_sub(rect.y));
            if width == 0 || height == 0 {
                return Err("Invalid crop rectangle".into());
            }
            image = image.crop_imm(rect.x, rect.y, width, height);
        }

        let file_stem = source
            .file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or("source-photo");
        let extension = source
            .extension()
            .and_then(|ext| ext.to_str())
            .unwrap_or("jpg");
        let temp_path = std::env::temp_dir().join(format!(
            "gljivobook-source-edit-{}-{}-{}.{}",
            std::process::id(),
            Utc::now().timestamp_millis(),
            file_stem,
            extension,
        ));

        image
            .save(&temp_path)
            .map_err(|e| format!("Failed to save edited source image: {}", e))?;

        Ok(temp_path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| format!("Source image edit task failed: {}", e))?
}

/// Remove find_photos entries whose files no longer exist on disk.
/// Returns the number of photo rows deleted.
#[tauri::command]
pub async fn prune_missing_photos(storage_path: String) -> Result<u32, String> {
    let conn = open_db(&storage_path)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, find_id, photo_path, is_primary FROM find_photos ORDER BY find_id, is_primary DESC, id ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows: Vec<(i64, i64, String, bool)> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)? == 1,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    let missing_photo_ids: Vec<i64> = rows
        .iter()
        .filter_map(|(photo_id, _, photo_path, _)| {
            let abs = Path::new(&storage_path)
                .join(photo_path.replace('/', std::path::MAIN_SEPARATOR_STR));
            if abs.exists() {
                None
            } else {
                Some(*photo_id)
            }
        })
        .collect();

    if missing_photo_ids.is_empty() {
        return Ok(0);
    }

    backup_db_before_destructive_change(&storage_path, "prune-missing-photos")?;

    let missing_photo_ids: HashSet<i64> = missing_photo_ids.into_iter().collect();
    let mut deleted: u32 = 0;
    let mut primaries_deleted: std::collections::HashSet<i64> = Default::default();

    for (photo_id, find_id, _photo_path, is_primary) in &rows {
        if missing_photo_ids.contains(photo_id) {
            conn.execute("DELETE FROM find_photos WHERE id = ?1", params![photo_id])
                .map_err(|e| format!("delete failed: {}", e))?;
            if *is_primary {
                primaries_deleted.insert(*find_id);
            }
            deleted += 1;
        }
    }

    // Promote a new primary for any find whose primary was deleted
    for find_id in primaries_deleted {
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

    Ok(deleted)
}

#[derive(serde::Serialize, Debug)]
pub struct DuplicatePhotoCleanupSummary {
    pub deleted_rows: u32,
    pub affected_find_ids: Vec<i64>,
    pub backup_path: Option<String>,
}

/// Remove duplicate find_photos rows for the same find + path.
///
/// This is deliberately conservative: it never deletes physical files and it does
/// not remove references where different finds point at the same path.
#[tauri::command]
pub async fn cleanup_duplicate_photo_rows(
    storage_path: String,
) -> Result<DuplicatePhotoCleanupSummary, String> {
    let mut conn = open_db(&storage_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, find_id, photo_path, is_primary
             FROM find_photos
             ORDER BY find_id, photo_path, is_primary DESC, id ASC",
        )
        .map_err(|e| e.to_string())?;
    let rows: Vec<(i64, i64, String, bool)> = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, i64>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, i64>(3)? == 1,
            ))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    let mut seen: HashSet<(i64, String)> = HashSet::new();
    let mut delete_ids = Vec::new();
    let mut affected_find_ids: HashSet<i64> = HashSet::new();

    for (photo_id, find_id, photo_path, _is_primary) in &rows {
        let key = (*find_id, photo_path.replace('\\', "/"));
        if seen.insert(key) {
            continue;
        }
        delete_ids.push(*photo_id);
        affected_find_ids.insert(*find_id);
    }

    if delete_ids.is_empty() {
        return Ok(DuplicatePhotoCleanupSummary {
            deleted_rows: 0,
            affected_find_ids: Vec::new(),
            backup_path: None,
        });
    }

    let backup_path = backup_db_before_destructive_change(&storage_path, "cleanup-duplicate-photo-rows")?;
    let tx = conn
        .transaction()
        .map_err(|e| format!("Failed to start duplicate cleanup transaction: {}", e))?;

    for photo_id in &delete_ids {
        tx.execute("DELETE FROM find_photos WHERE id = ?1", params![photo_id])
            .map_err(|e| format!("Duplicate photo row delete failed: {}", e))?;
    }

    let mut affected_find_ids: Vec<i64> = affected_find_ids.into_iter().collect();
    affected_find_ids.sort_unstable();
    for find_id in &affected_find_ids {
        let primary_id: Option<i64> = tx
            .query_row(
                "SELECT id FROM find_photos WHERE find_id = ?1 ORDER BY is_primary DESC, id ASC LIMIT 1",
                params![find_id],
                |row| row.get(0),
            )
            .ok();
        if let Some(primary_id) = primary_id {
            tx.execute(
                "UPDATE find_photos SET is_primary = CASE WHEN id = ?1 THEN 1 ELSE 0 END WHERE find_id = ?2",
                params![primary_id, find_id],
            )
            .map_err(|e| format!("Primary repair failed: {}", e))?;
        }
    }

    tx.commit()
        .map_err(|e| format!("Failed to commit duplicate cleanup: {}", e))?;

    Ok(DuplicatePhotoCleanupSummary {
        deleted_rows: delete_ids.len() as u32,
        affected_find_ids,
        backup_path,
    })
}

#[derive(serde::Serialize, Debug)]
pub struct DuplicatePhotoPath {
    pub photo_path: String,
    pub count: u32,
    pub find_ids: Vec<i64>,
}

#[derive(serde::Serialize, Debug)]
pub struct PhotoLibraryAudit {
    pub db_photo_rows: u32,
    pub db_distinct_photo_paths: u32,
    pub filesystem_images: u32,
    pub missing_db_photo_paths: Vec<String>,
    pub orphan_filesystem_images: Vec<String>,
    pub duplicate_photo_paths: Vec<DuplicatePhotoPath>,
}

fn is_supported_photo_path(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            matches!(
                ext.to_ascii_lowercase().as_str(),
                "jpg" | "jpeg" | "png" | "webp" | "heic" | "heif"
            )
        })
        .unwrap_or(false)
}

fn collect_library_images(
    storage_root: &Path,
    current: &Path,
    out: &mut Vec<String>,
) -> Result<(), String> {
    for entry in std::fs::read_dir(current)
        .map_err(|e| format!("Failed to read folder '{}': {}", current.display(), e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read folder entry: {}", e))?;
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        if path.is_dir() {
            if matches!(
                file_name.as_str(),
                ".bili-cache" | ".bili-backups" | ".bili-cache-tiles"
            ) {
                continue;
            }
            collect_library_images(storage_root, &path, out)?;
        } else if is_supported_photo_path(&path) {
            let rel = path
                .strip_prefix(storage_root)
                .map_err(|e| format!("Failed to relativize '{}': {}", path.display(), e))?
                .to_string_lossy()
                .replace('\\', "/");
            out.push(rel);
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn audit_photo_library(storage_path: String) -> Result<PhotoLibraryAudit, String> {
    let conn = open_db(&storage_path)?;
    let storage_root = Path::new(&storage_path);

    let mut stmt = conn
        .prepare("SELECT find_id, photo_path FROM find_photos ORDER BY find_id, id")
        .map_err(|e| e.to_string())?;
    let rows: Vec<(i64, String)> = stmt
        .query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    drop(stmt);

    let mut db_paths: Vec<String> = rows
        .iter()
        .map(|(_, path)| path.replace('\\', "/"))
        .collect();
    db_paths.sort();
    let db_photo_rows = db_paths.len() as u32;
    let db_path_set: HashSet<String> = db_paths.iter().cloned().collect();

    let mut filesystem_images = Vec::new();
    collect_library_images(storage_root, storage_root, &mut filesystem_images)?;
    filesystem_images.sort();
    let fs_path_set: HashSet<String> = filesystem_images.iter().cloned().collect();

    let mut missing_db_photo_paths: Vec<String> =
        db_path_set.difference(&fs_path_set).cloned().collect();
    missing_db_photo_paths.sort();

    let mut orphan_filesystem_images: Vec<String> =
        fs_path_set.difference(&db_path_set).cloned().collect();
    orphan_filesystem_images.sort();

    let mut duplicates_stmt = conn
        .prepare(
            "SELECT photo_path, COUNT(*) AS duplicate_count, GROUP_CONCAT(find_id) AS find_ids
             FROM find_photos
             GROUP BY photo_path
             HAVING duplicate_count > 1
             ORDER BY duplicate_count DESC, photo_path",
        )
        .map_err(|e| e.to_string())?;
    let duplicate_photo_paths = duplicates_stmt
        .query_map([], |row| {
            let find_ids_csv: String = row.get(2)?;
            let find_ids = find_ids_csv
                .split(',')
                .filter_map(|value| value.parse::<i64>().ok())
                .collect();
            Ok(DuplicatePhotoPath {
                photo_path: row.get(0)?,
                count: row.get::<_, i64>(1)? as u32,
                find_ids,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(PhotoLibraryAudit {
        db_photo_rows,
        db_distinct_photo_paths: db_path_set.len() as u32,
        filesystem_images: filesystem_images.len() as u32,
        missing_db_photo_paths,
        orphan_filesystem_images,
        duplicate_photo_paths,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::import::test_helpers::{make_find_record, setup_in_memory_db};
    use crate::commands::import::{find_record_from_row, insert_find_photo, insert_find_row};

    // -----------------------------------------------------------------------
    // create_find tests
    // -----------------------------------------------------------------------

    fn make_create_payload(species_name: &str) -> CreateFindPayload {
        CreateFindPayload {
            species_name: species_name.to_string(),
            common_name: None,
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
            edibility_note: None,
        }
    }

    fn do_create_find(
        conn: &rusqlite::Connection,
        payload: &CreateFindPayload,
    ) -> Result<FindRecord, String> {
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
            edibility_note: None,
            photo_count: Some(0),
            photos: vec![],
        };
        let new_id = insert_find_row(conn, &record).map_err(|e| e.to_string())?;
        let mut inserted = conn
            .query_row(
                "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note FROM finds WHERE id = ?1",
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
        assert_eq!(
            photo_count, 0,
            "no find_photos rows should exist for a no-photo find"
        );
    }

    #[test]
    fn test_create_find_returns_empty_photos_vec() {
        let conn = setup_in_memory_db();
        let payload = make_create_payload("Cantharellus cibarius");
        let record = do_create_find(&conn, &payload).expect("create_find");
        assert!(
            record.photos.is_empty(),
            "returned record.photos must be empty"
        );
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
        assert!(
            photo_path_result.is_err(),
            "no photos means query should return Err"
        );

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
        let species_folder = std::path::Path::new(storage_path).join(
            crate::commands::path_builder::resolve_location_component(
                &species_name,
                "unknown_species",
            ),
        );
        // Ensure folder can be created on demand
        std::fs::create_dir_all(&species_folder).expect("create species folder");
        assert!(
            species_folder.exists(),
            "species folder should exist after creation"
        );
    }

    #[test]
    fn test_delete_find_removes_record() {
        let conn = setup_in_memory_db();
        let record = make_find_record("mushroom.jpg", "2024-05-10");
        let find_id = insert_find_row(&conn, &record).expect("insert find");
        insert_find_photo(
            &conn,
            find_id,
            "Croatia/Region/2024-05-10/mushroom_1.jpg",
            true,
        )
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
        insert_find_photo(
            &conn,
            find_id,
            "Croatia/Region/2024-05-10/mushroom_1.jpg",
            true,
        )
        .expect("insert primary photo");
        insert_find_photo(
            &conn,
            find_id,
            "Croatia/Region/2024-05-10/mushroom_2.jpg",
            false,
        )
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
        insert_find_photo(
            &conn,
            find_id,
            "Croatia/Region/2024-05-10/mushroom_1.jpg",
            true,
        )
        .expect("insert primary photo");
        insert_find_photo(
            &conn,
            find_id,
            "Croatia/Region/2024-05-10/mushroom_2.jpg",
            false,
        )
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
                "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note FROM finds WHERE id = ?1",
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
                "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note FROM finds WHERE id = ?1",
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
        insert_find_photo(
            &conn,
            find_id,
            "Croatia/Region/2024-05-10/mushroom_1.jpg",
            true,
        )
        .expect("insert primary photo");
        let secondary_id = insert_find_photo(
            &conn,
            find_id,
            "Croatia/Region/2024-05-10/mushroom_2.jpg",
            false,
        )
        .expect("insert secondary photo");

        let result = do_delete_find_photo(&conn, secondary_id).expect("delete secondary");

        assert_eq!(result.photos.len(), 1, "one photo should remain");
        assert!(
            result.photos[0].is_primary,
            "remaining photo should still be primary"
        );
    }

    #[test]
    fn test_delete_find_photo_primary_promotes_another() {
        let conn = setup_in_memory_db();
        let record = make_find_record("mushroom.jpg", "2024-05-10");
        let find_id = insert_find_row(&conn, &record).expect("insert find");
        let primary_id = insert_find_photo(
            &conn,
            find_id,
            "Croatia/Region/2024-05-10/mushroom_1.jpg",
            true,
        )
        .expect("insert primary photo");
        insert_find_photo(
            &conn,
            find_id,
            "Croatia/Region/2024-05-10/mushroom_2.jpg",
            false,
        )
        .expect("insert secondary photo");

        let result = do_delete_find_photo(&conn, primary_id).expect("delete primary");

        assert_eq!(result.photos.len(), 1, "one photo should remain");
        assert!(
            result.photos[0].is_primary,
            "remaining photo should be promoted to primary"
        );
    }

    #[test]
    fn test_delete_find_photo_last_photo() {
        let conn = setup_in_memory_db();
        let record = make_find_record("mushroom.jpg", "2024-05-10");
        let find_id = insert_find_row(&conn, &record).expect("insert find");
        let only_id = insert_find_photo(
            &conn,
            find_id,
            "Croatia/Region/2024-05-10/mushroom_1.jpg",
            true,
        )
        .expect("insert only photo");

        let result = do_delete_find_photo(&conn, only_id).expect("delete only photo");

        // Find should still exist
        let find_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM finds WHERE id = ?1",
                params![find_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(find_count, 1, "find should still exist");
        assert!(result.photos.is_empty(), "photos should be empty");
    }

    #[test]
    fn test_bulk_delete_find_photos() {
        let conn = setup_in_memory_db();
        let record = make_find_record("mushroom.jpg", "2024-05-10");
        let find_id = insert_find_row(&conn, &record).expect("insert find");
        let primary_id = insert_find_photo(
            &conn,
            find_id,
            "Croatia/Region/2024-05-10/mushroom_1.jpg",
            true,
        )
        .expect("insert primary photo");
        let secondary_id = insert_find_photo(
            &conn,
            find_id,
            "Croatia/Region/2024-05-10/mushroom_2.jpg",
            false,
        )
        .expect("insert secondary photo");
        insert_find_photo(
            &conn,
            find_id,
            "Croatia/Region/2024-05-10/mushroom_3.jpg",
            false,
        )
        .expect("insert third photo");

        let result =
            do_bulk_delete_find_photos(&conn, &[primary_id, secondary_id]).expect("bulk delete");

        assert_eq!(result.photos.len(), 1, "one photo should remain");
        assert!(
            result.photos[0].is_primary,
            "remaining photo should be promoted to primary"
        );
    }

    #[test]
    fn test_upsert_and_get_species_profile_synonyms_other_names() {
        let conn = setup_in_memory_db();
        let updated_at = "2026-05-12T00:00:00Z".to_string();
        let tags_json = serde_json::to_string(&Vec::<String>::new()).unwrap();
        let synonyms = vec![
            "Boletus reticulatus".to_string(),
            "Boletus aestivalis".to_string(),
        ];
        let other_names = vec!["vrganj".to_string(), "pravi vrganj".to_string()];
        let synonyms_json = serde_json::to_string(&synonyms).unwrap();
        let other_names_json = serde_json::to_string(&other_names).unwrap();

        conn.execute(
            "INSERT INTO species_profiles (species_name, cover_photo_id, tags_json, updated_at, edibility, threat_status, distribution, edibility_note, synonyms, other_names)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params!["Boletus *edulis*", None::<i64>, tags_json, updated_at, None::<String>, None::<String>, None::<String>, None::<String>, synonyms_json, other_names_json],
        ).expect("insert species profile");

        let row: (Option<String>, Option<String>) = conn
            .query_row(
                "SELECT synonyms, other_names FROM species_profiles WHERE species_name = ?1",
                rusqlite::params!["Boletus *edulis*"],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .expect("query profile");

        let got_synonyms: Vec<String> = serde_json::from_str(&row.0.unwrap()).unwrap();
        let got_other_names: Vec<String> = serde_json::from_str(&row.1.unwrap()).unwrap();

        assert_eq!(got_synonyms, synonyms, "synonyms round-trip must match");
        assert_eq!(
            got_other_names, other_names,
            "other_names round-trip must match"
        );
    }

    // -----------------------------------------------------------------------
    // add_find_photos lat/lng backfill guard tests
    // (auto-populate-find-lat-lng-from-photo-exif)
    // -----------------------------------------------------------------------

    fn make_find_record_with_coords(
        filename: &str,
        date: &str,
        lat: Option<f64>,
        lng: Option<f64>,
    ) -> FindRecord {
        let mut record = make_find_record(filename, date);
        record.lat = lat;
        record.lng = lng;
        record
    }

    #[test]
    fn test_backfill_update_sets_lat_lng_when_find_has_none() {
        let conn = setup_in_memory_db();
        let record = make_find_record_with_coords("photo.jpg", "2024-05-10", None, None);
        let find_id = insert_find_row(&conn, &record).expect("insert find");

        let rows_affected = conn
            .execute(
                "UPDATE finds SET lat = ?1, lng = ?2 WHERE id = ?3 AND lat IS NULL AND lng IS NULL",
                rusqlite::params![45.5, 16.0, find_id],
            )
            .expect("guarded update should succeed");

        assert_eq!(rows_affected, 1, "should update the single null-coords row");

        let (lat, lng): (Option<f64>, Option<f64>) = conn
            .query_row(
                "SELECT lat, lng FROM finds WHERE id = ?1",
                rusqlite::params![find_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("query find");
        assert_eq!(lat, Some(45.5));
        assert_eq!(lng, Some(16.0));
    }

    #[test]
    fn test_backfill_update_never_changes_already_set_lat_lng() {
        let conn = setup_in_memory_db();
        let record =
            make_find_record_with_coords("photo.jpg", "2024-05-10", Some(44.0), Some(15.0));
        let find_id = insert_find_row(&conn, &record).expect("insert find");

        let rows_affected = conn
            .execute(
                "UPDATE finds SET lat = ?1, lng = ?2 WHERE id = ?3 AND lat IS NULL AND lng IS NULL",
                rusqlite::params![45.5, 16.0, find_id],
            )
            .expect("guarded update should succeed as a no-op");

        assert_eq!(
            rows_affected, 0,
            "guarded update must not touch an already-set find"
        );

        let (lat, lng): (Option<f64>, Option<f64>) = conn
            .query_row(
                "SELECT lat, lng FROM finds WHERE id = ?1",
                rusqlite::params![find_id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("query find");
        assert_eq!(lat, Some(44.0), "original manual lat must be intact");
        assert_eq!(lng, Some(15.0), "original manual lng must be intact");
    }

    #[test]
    fn test_backfill_sql_guard_only_affects_rows_with_both_lat_and_lng_null() {
        let conn = setup_in_memory_db();

        let null_coords_record =
            make_find_record_with_coords("null.jpg", "2024-05-10", None, None);
        let null_coords_id = insert_find_row(&conn, &null_coords_record).expect("insert find");

        let set_coords_record =
            make_find_record_with_coords("set.jpg", "2024-05-10", Some(44.0), Some(15.0));
        let set_coords_id = insert_find_row(&conn, &set_coords_record).expect("insert find");

        let rows_affected_for_set = conn
            .execute(
                "UPDATE finds SET lat = ?1, lng = ?2 WHERE id = ?3 AND lat IS NULL AND lng IS NULL",
                rusqlite::params![50.0, 20.0, set_coords_id],
            )
            .expect("guarded update should succeed");
        assert_eq!(
            rows_affected_for_set, 0,
            "0 rows affected when lat/lng already set"
        );

        let rows_affected_for_null = conn
            .execute(
                "UPDATE finds SET lat = ?1, lng = ?2 WHERE id = ?3 AND lat IS NULL AND lng IS NULL",
                rusqlite::params![50.0, 20.0, null_coords_id],
            )
            .expect("guarded update should succeed");
        assert_eq!(
            rows_affected_for_null, 1,
            "1 row affected when both lat/lng are null"
        );
    }

    #[test]
    fn test_first_gps_coords_from_paths_reachable_from_finds_module() {
        let dir = tempfile::tempdir().expect("tempdir");
        let path_a = dir.path().join("a.jpg");
        let path_b = dir.path().join("b.jpg");
        std::fs::write(&path_a, b"AAAA").unwrap();
        std::fs::write(&path_b, b"BBBB").unwrap();

        let path_a_str = path_a.to_string_lossy().to_string();
        let path_b_str = path_b.to_string_lossy().to_string();
        let paths = [path_a_str.as_str(), path_b_str.as_str()];

        assert_eq!(
            first_gps_coords_from_paths(&paths),
            None,
            "cross-module import should compile and behave like import.rs's own tests"
        );
    }
}
