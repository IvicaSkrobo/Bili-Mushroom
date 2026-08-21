use chrono::Utc;
use rusqlite::{params, params_from_iter, types::ToSql, Connection, OptionalExtension};
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
use crate::commands::thumbnail_scheduler::run_thumbnail_job;

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
    #[serde(default)]
    pub weather: Option<String>,
    #[serde(default)]
    pub determiner: Option<String>,
    #[serde(default)]
    pub finder: Option<String>,
}

#[tauri::command]
pub async fn create_find(
    storage_path: String,
    payload: CreateFindPayload,
) -> Result<FindRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
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
            weather: payload.weather,
            determiner: payload.determiner,
            finder: payload.finder,
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
                "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note, weather, determiner, finder FROM finds WHERE id = ?1",
                params![new_id],
                |row| find_record_from_row(row),
            )
            .map_err(|e| format!("Failed to read inserted find: {}", e))?;

        // No photo rows were inserted — explicitly set to empty
        inserted.photos = vec![];

        Ok(inserted)
    })
    .await
    .map_err(|e| format!("Create find worker failed: {e}"))?
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
    pub habitat: Option<String>,
    pub synonyms: Vec<String>,
    pub other_names: Vec<String>,
    pub fruiting_body_count_override: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct SpeciesProfileSummary {
    pub species_name: String,
    pub common_name: Option<String>,
    pub cover_photo_id: Option<i64>,
    pub tags: Vec<String>,
    pub edibility: Option<String>,
    pub threat_status: Option<String>,
    pub distribution: Option<String>,
    pub synonyms: Vec<String>,
    pub other_names: Vec<String>,
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
    run_thumbnail_job(move || {
        generate_photo_thumbnail_blocking(&storage_path, &photo_path, size)
    })
    .await
}

#[derive(serde::Serialize)]
pub struct ThumbnailWarmupSummary {
    pub processed: u32,
    pub failed: u32,
}

fn next_thumbnail_warmup_batch(
    conn: &Connection,
    size: u32,
    limit: u32,
) -> Result<Vec<String>, String> {
    let cursor_key = format!("thumbnail_warmup_cursor_{size}");
    let cursor = conn
        .query_row(
            "SELECT CAST(value AS INTEGER) FROM app_metadata WHERE key = ?1",
            params![cursor_key],
            |row| row.get::<_, i64>(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .unwrap_or(0);

    let load_after = |after_id: i64| -> Result<Vec<(i64, String)>, String> {
        let mut stmt = conn
            .prepare(
                "SELECT MIN(id) AS cursor_id, photo_path
                 FROM find_photos
                 GROUP BY photo_path
                 HAVING MIN(id) > ?1
                 ORDER BY cursor_id ASC
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![after_id, limit], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(rows)
    };

    let mut rows = load_after(cursor)?;
    if rows.is_empty() && cursor > 0 {
        rows = load_after(0)?;
    }

    // Advancing before decode is intentional: one corrupt original must not pin every
    // future startup to the same batch. This is disposable cache state, not user data.
    let next_cursor = if rows.len() < limit as usize {
        0
    } else {
        rows.last().map(|(id, _)| *id).unwrap_or(0)
    };
    conn.execute(
        "INSERT INTO app_metadata (key, value) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        params![cursor_key, next_cursor.to_string()],
    )
    .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(_, photo_path)| photo_path).collect())
}

#[tauri::command]
pub async fn warm_photo_thumbnail_cache(
    storage_path: String,
    size: Option<u32>,
    limit: Option<u32>,
) -> Result<ThumbnailWarmupSummary, String> {
    let size = size.unwrap_or(256).clamp(64, 768);
    let limit = limit.unwrap_or(40).clamp(1, 500);
    let lookup_storage_path = storage_path.clone();
    let photo_paths = tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&lookup_storage_path)?;
        next_thumbnail_warmup_batch(&conn, size, limit)
    })
    .await
    .map_err(|e| format!("Thumbnail warmup lookup failed: {e}"))??;

    let mut processed = 0u32;
    let mut failed = 0u32;
    for photo_path in photo_paths {
        let item_storage_path = storage_path.clone();
        match run_thumbnail_job(move || {
            generate_photo_thumbnail_blocking(&item_storage_path, &photo_path, size)
        })
        .await
        {
            Ok(_) => processed += 1,
            Err(_) => failed += 1,
        }

        // The semaphore is released after every image. Yield here so queued visible
        // thumbnails can claim the next permit before background warmup continues.
        tokio::task::yield_now().await;
    }

    Ok(ThumbnailWarmupSummary { processed, failed })
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
    tauri::async_runtime::spawn_blocking(move || get_species_notes_blocking(&storage_path))
        .await
        .map_err(|e| format!("Species notes worker failed: {}", e))?
}

fn get_species_notes_blocking(storage_path: &str) -> Result<Vec<SpeciesNote>, String> {
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
    tauri::async_runtime::spawn_blocking(move || get_species_profiles_blocking(&storage_path))
        .await
        .map_err(|e| format!("Species profiles worker failed: {}", e))?
}

fn species_profile_from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<SpeciesProfile> {
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
        habitat: row.get(12)?,
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
}

fn get_species_profiles_blocking(storage_path: &str) -> Result<Vec<SpeciesProfile>, String> {
    let conn = open_db(&storage_path)?;
    let mut stmt = conn
        .prepare("SELECT species_name, common_name, cover_photo_id, tags_json, edibility, threat_status, distribution, edibility_note, description, synonyms, other_names, fruiting_body_count_override, habitat FROM species_profiles ORDER BY species_name")
        .map_err(|e| e.to_string())?;
    let profiles = stmt
        .query_map([], species_profile_from_row)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(profiles)
}

#[tauri::command]
pub async fn get_species_profile_summaries(
    storage_path: String,
) -> Result<Vec<SpeciesProfileSummary>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        get_species_profile_summaries_for_connection(&conn)
    })
    .await
    .map_err(|e| format!("Species profile summaries worker failed: {}", e))?
}

fn get_species_profile_summaries_for_connection(
    conn: &Connection,
) -> Result<Vec<SpeciesProfileSummary>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT species_name, common_name, cover_photo_id, tags_json, edibility, threat_status, distribution, synonyms, other_names
             FROM species_profiles ORDER BY species_name",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| {
        let tags_json: String = row.get(3)?;
        let synonyms_json: Option<String> = row.get(7)?;
        let other_names_json: Option<String> = row.get(8)?;
        Ok(SpeciesProfileSummary {
            species_name: row.get(0)?,
            common_name: row.get(1)?,
            cover_photo_id: row.get(2)?,
            tags: serde_json::from_str(&tags_json).unwrap_or_default(),
            edibility: row.get(4)?,
            threat_status: row.get(5)?,
            distribution: row.get(6)?,
            synonyms: synonyms_json
                .as_deref()
                .and_then(|value| serde_json::from_str(value).ok())
                .unwrap_or_default(),
            other_names: other_names_json
                .as_deref()
                .and_then(|value| serde_json::from_str(value).ok())
                .unwrap_or_default(),
        })
    })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_species_profile(
    storage_path: String,
    species_name: String,
) -> Result<Option<SpeciesProfile>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        get_species_profile_for_connection(&conn, &species_name)
    })
    .await
    .map_err(|e| format!("Species profile worker failed: {}", e))?
}

const SPECIES_PROFILE_COLUMNS: &str = "species_name, common_name, cover_photo_id, tags_json, edibility, threat_status, distribution, edibility_note, description, synonyms, other_names, fruiting_body_count_override, habitat";

/// Looks up one species profile.
///
/// Callers overwrite the profile with what they read here, so a miss caused by nothing
/// more than different casing or surrounding whitespace would blank out tags, cover and
/// edibility. Try the exact key first, then a normalized match.
pub(crate) fn get_species_profile_for_connection(
    conn: &Connection,
    species_name: &str,
) -> Result<Option<SpeciesProfile>, String> {
    let exact = conn
        .query_row(
            &format!("SELECT {SPECIES_PROFILE_COLUMNS} FROM species_profiles WHERE species_name = ?1"),
            params![species_name],
            species_profile_from_row,
        )
        .optional()
        .map_err(|e| e.to_string())?;
    if exact.is_some() {
        return Ok(exact);
    }
    conn.query_row(
        &format!(
            "SELECT {SPECIES_PROFILE_COLUMNS} FROM species_profiles
             WHERE LOWER(TRIM(species_name)) = LOWER(TRIM(?1)) LIMIT 1"
        ),
        params![species_name],
        species_profile_from_row,
    )
    .optional()
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_species_note(
    storage_path: String,
    species_name: String,
) -> Result<Option<SpeciesNote>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        conn.query_row(
            "SELECT species_name, notes FROM species_notes WHERE species_name = ?1",
            params![species_name],
            |row| {
                Ok(SpeciesNote {
                    species_name: row.get(0)?,
                    notes: row.get(1)?,
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| format!("Species note worker failed: {}", e))?
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
    habitat: Option<String>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        let updated_at = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
        let tags_json = serde_json::to_string(&tags)
            .map_err(|e| format!("Failed to encode species tags: {}", e))?;
        let synonyms_json = serde_json::to_string(&synonyms)
            .map_err(|e| format!("Failed to encode synonyms: {}", e))?;
        let other_names_json = serde_json::to_string(&other_names)
            .map_err(|e| format!("Failed to encode other_names: {}", e))?;
        conn.execute(
            "INSERT INTO species_profiles (species_name, common_name, cover_photo_id, tags_json, updated_at, edibility, threat_status, distribution, edibility_note, synonyms, other_names, fruiting_body_count_override, description, habitat)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
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
               description = excluded.description,
               habitat = excluded.habitat",
            params![species_name, common_name, cover_photo_id, tags_json, updated_at, edibility, threat_status, distribution, edibility_note, synonyms_json, other_names_json, fruiting_body_count_override, description, habitat],
        )
        .map_err(|e| format!("Upsert species profile failed: {}", e))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Species profile worker failed: {e}"))?
}

/// A partial edit to a species profile: every field left unset stays untouched.
///
/// `upsert_species_profile` replaces the whole row, so callers that only edit a couple
/// of fields have to read the profile back first and echo everything else. That
/// read-modify-write is two IPC calls, and a read that missed silently blanked tags,
/// cover, edibility and habitat. Screens that own only part of the profile — the find
/// and import dialogs — send a patch instead and never have to read first.
#[derive(serde::Deserialize, Default, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SpeciesProfilePatch {
    pub common_name: Option<String>,
    pub description: Option<String>,
    pub edibility: Option<String>,
    pub threat_status: Option<String>,
    pub distribution: Option<String>,
    pub habitat: Option<String>,
    pub edibility_note: Option<String>,
    pub cover_photo_id: Option<i64>,
    pub tags: Option<Vec<String>>,
}

#[tauri::command]
pub async fn patch_species_profile(
    storage_path: String,
    species_name: String,
    patch: SpeciesProfilePatch,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        patch_species_profile_on_connection(&conn, &species_name, &patch)
    })
    .await
    .map_err(|e| format!("Species profile patch worker failed: {}", e))?
}

pub(crate) fn patch_species_profile_on_connection(
    conn: &Connection,
    species_name: &str,
    patch: &SpeciesProfilePatch,
) -> Result<(), String> {
    let tags_json = match patch.tags.as_ref() {
        Some(tags) => Some(
            serde_json::to_string(tags)
                .map_err(|e| format!("Failed to encode species tags: {}", e))?,
        ),
        None => None,
    };

    // (column, value) for every field the caller actually set. Anything absent is left
    // exactly as stored, which is the whole point of this command.
    let mut columns: Vec<&str> = Vec::new();
    let mut values: Vec<Box<dyn ToSql>> = Vec::new();
    let mut push = |column: &'static str, value: Option<Box<dyn ToSql>>| {
        if let Some(value) = value {
            columns.push(column);
            values.push(value);
        }
    };
    push(
        "common_name",
        patch
            .common_name
            .clone()
            .map(|v| Box::new(v) as Box<dyn ToSql>),
    );
    push(
        "description",
        patch
            .description
            .clone()
            .map(|v| Box::new(v) as Box<dyn ToSql>),
    );
    push(
        "edibility",
        patch
            .edibility
            .clone()
            .map(|v| Box::new(v) as Box<dyn ToSql>),
    );
    push(
        "threat_status",
        patch
            .threat_status
            .clone()
            .map(|v| Box::new(v) as Box<dyn ToSql>),
    );
    push(
        "distribution",
        patch
            .distribution
            .clone()
            .map(|v| Box::new(v) as Box<dyn ToSql>),
    );
    push(
        "habitat",
        patch.habitat.clone().map(|v| Box::new(v) as Box<dyn ToSql>),
    );
    push(
        "edibility_note",
        patch
            .edibility_note
            .clone()
            .map(|v| Box::new(v) as Box<dyn ToSql>),
    );
    push(
        "cover_photo_id",
        patch.cover_photo_id.map(|v| Box::new(v) as Box<dyn ToSql>),
    );
    push("tags_json", tags_json.map(|v| Box::new(v) as Box<dyn ToSql>));

    if columns.is_empty() {
        return Ok(());
    }

    let updated_at = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let insert_columns = std::iter::once("species_name")
        .chain(columns.iter().copied())
        .chain(std::iter::once("updated_at"))
        .collect::<Vec<_>>()
        .join(", ");
    let placeholders = (1..=columns.len() + 2)
        .map(|index| format!("?{index}"))
        .collect::<Vec<_>>()
        .join(", ");
    let assignments = columns
        .iter()
        .map(|column| format!("{column} = excluded.{column}"))
        .chain(std::iter::once("updated_at = excluded.updated_at".to_string()))
        .collect::<Vec<_>>()
        .join(", ");
    let sql = format!(
        "INSERT INTO species_profiles ({insert_columns}) VALUES ({placeholders})
         ON CONFLICT(species_name) DO UPDATE SET {assignments}"
    );

    let mut params: Vec<Box<dyn ToSql>> = vec![Box::new(species_name.to_string())];
    params.extend(values);
    params.push(Box::new(updated_at));

    conn.execute(
        &sql,
        params_from_iter(params.iter().map(|value| value.as_ref() as &dyn ToSql)),
    )
    .map_err(|e| format!("Patch species profile failed: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn get_species_recipes(storage_path: String) -> Result<Vec<SpeciesRecipe>, String> {
    tauri::async_runtime::spawn_blocking(move || get_species_recipes_blocking(&storage_path))
        .await
        .map_err(|e| format!("Species recipes worker failed: {}", e))?
}

fn get_species_recipes_blocking(storage_path: &str) -> Result<Vec<SpeciesRecipe>, String> {
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
pub async fn get_species_recipes_for_species(
    storage_path: String,
    species_name: String,
) -> Result<Vec<SpeciesRecipe>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        let mut stmt = conn
            .prepare(
                "SELECT id, species_name, title, notes, created_at, updated_at
                 FROM species_recipes WHERE species_name = ?1 ORDER BY id",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt.query_map(params![species_name], |row| {
            Ok(SpeciesRecipe {
                id: row.get(0)?,
                species_name: row.get(1)?,
                title: row.get(2)?,
                notes: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;
        let recipes = rows
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(recipes)
    })
    .await
    .map_err(|e| format!("Species recipes worker failed: {}", e))?
}

#[tauri::command]
pub async fn upsert_species_recipe(
    storage_path: String,
    id: Option<i64>,
    species_name: String,
    title: String,
    notes: String,
) -> Result<SpeciesRecipe, String> {
    tauri::async_runtime::spawn_blocking(move || {
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
    })
    .await
    .map_err(|e| format!("Species recipe worker failed: {e}"))?
}

#[tauri::command]
pub async fn delete_species_recipe(storage_path: String, id: i64) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        conn.execute("DELETE FROM species_recipes WHERE id = ?1", params![id])
            .map_err(|e| format!("Delete species recipe failed: {}", e))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Species recipe delete worker failed: {e}"))?
}

#[tauri::command]
pub async fn upsert_species_note(
    storage_path: String,
    species_name: String,
    notes: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        let updated_at = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
        conn.execute(
            "INSERT INTO species_notes (species_name, notes, updated_at) VALUES (?1, ?2, ?3)
             ON CONFLICT(species_name) DO UPDATE SET notes=excluded.notes, updated_at=excluded.updated_at",
            params![species_name, notes, updated_at],
        )
        .map_err(|e| format!("Upsert species note failed: {}", e))?;
        Ok(())
    })
    .await
    .map_err(|e| format!("Species note worker failed: {e}"))?
}

/// Move all photo files for a find to a different folder, then delete the DB record.
/// Used by the "move files to another folder" option in the delete dialog.
#[tauri::command]
pub async fn move_find_files(
    storage_path: String,
    find_id: i64,
    dest_folder: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let mut conn = open_db(&storage_path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .map_err(|e| e.to_string())?;
        move_find_files_on_conn(&mut conn, &storage_path, find_id, &dest_folder)
    })
    .await
    .map_err(|e| format!("Move find files worker failed: {e}"))?
}

/// Moves one find's photos into `dest_folder` and then drops its record.
///
/// Files first, row second: the record must not disappear while its photos are still
/// where they were.
fn move_find_files_on_conn(
    conn: &mut Connection,
    storage_path: &str,
    find_id: i64,
    dest_folder: &str,
) -> Result<(), String> {
    let exists = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM finds WHERE id = ?1)",
            params![find_id],
            |row| row.get::<_, bool>(0),
        )
        .map_err(|e| format!("Could not locate find {find_id}: {e}"))?;
    if !exists {
        return Err(format!("Find {find_id} no longer exists"));
    }
    let mut stmt = conn
        .prepare("SELECT photo_path FROM find_photos WHERE find_id = ?1")
        .map_err(|e| e.to_string())?;
    let paths: Vec<String> = stmt
        .query_map(params![find_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Could not read photo paths for find {find_id}: {e}"))?;
    drop(stmt);

    std::fs::create_dir_all(dest_folder)
        .map_err(|e| format!("Could not create destination folder '{dest_folder}': {e}"))?;
    let mut reserved = HashSet::new();
    let mut plan: Vec<(PathBuf, PathBuf)> = Vec::new();
    for rel_path in &paths {
        let abs_src = Path::new(storage_path).join(rel_path.replace('/', std::path::MAIN_SEPARATOR_STR));
        if !abs_src.is_file() {
            return Err(format!("Photo is missing or not a file: '{}'", abs_src.display()));
        }
        let filename = std::path::Path::new(rel_path.as_str())
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(rel_path.as_str());
        let abs_dest = unique_destination_path_reserved(
            &Path::new(dest_folder).join(filename),
            &mut reserved,
        );
        plan.push((abs_src, abs_dest));
    }

    let mut moved: Vec<(PathBuf, PathBuf)> = Vec::new();
    for (source, destination) in &plan {
        if let Err(error) = move_file_without_overwrite(source, destination) {
            let rollback_errors = rollback_file_moves(&moved);
            let suffix = if rollback_errors.is_empty() {
                String::new()
            } else {
                format!(" Rollback also failed: {}", rollback_errors.join("; "))
            };
            return Err(format!("{error}{suffix}"));
        }
        moved.push((source.clone(), destination.clone()));
    }

    let db_result = (|| -> Result<(), String> {
        let tx = conn.transaction().map_err(|e| e.to_string())?;
        crate::commands::samples::remove_sample_for_find(&tx, storage_path, find_id, false)?;
        let deleted = tx
            .execute("DELETE FROM finds WHERE id = ?1", params![find_id])
            .map_err(|e| format!("DB delete failed: {e}"))?;
        if deleted != 1 {
            return Err(format!("Find {find_id} disappeared before it could be deleted"));
        }
        tx.commit().map_err(|e| format!("DB delete commit failed: {e}"))
    })();
    if let Err(error) = db_result {
        let rollback_errors = rollback_file_moves(&moved);
        let suffix = if rollback_errors.is_empty() {
            String::new()
        } else {
            format!(" Rollback also failed: {}", rollback_errors.join("; "))
        };
        return Err(format!("{error}{suffix}"));
    }
    Ok(())
}

#[tauri::command]
pub async fn open_find_folder(
    storage_path: String,
    find_id: i64,
    scope: Option<String>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
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
    })
    .await
    .map_err(|e| format!("Open find folder worker failed: {e}"))?
}

#[tauri::command]
pub async fn open_species_folder(storage_path: String, species_name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
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
    })
    .await
    .map_err(|e| format!("Open species folder worker failed: {e}"))?
}

/// Move a file to the system Recycle Bin. Used by the import dialog's
/// "delete source" trash button to remove the original before or instead of importing.
#[tauri::command]
pub async fn trash_source_file(path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        trash::delete(&path).map_err(|e| format!("Failed to trash '{}': {}", path, e))
    })
    .await
    .map_err(|e| format!("Trash worker failed: {e}"))?
}

/// Terminate the process immediately. Used by the DB error dialog's Quit button.
/// getCurrentWindow().close() on macOS only closes the window, leaving the process alive.
#[tauri::command]
pub async fn quit_app() {
    std::process::exit(0);
}

#[tauri::command]
/// `delete_sample_folder` controls whether a linked sample's folder goes too. It defaults
/// to keeping the folder: it holds the specimen's data sheet and photos, so destroying it
/// has to be asked for explicitly.
/// Returns the same structured result as the bulk delete so the caller can tell a clean
/// delete from one that dropped the record but left photos on disk. Reporting that as a
/// plain success is what made a locked photo look like a finished cleanup.
pub async fn delete_find(
    storage_path: String,
    find_id: i64,
    delete_files: bool,
    delete_sample_folder: Option<bool>,
) -> Result<BulkOperationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        delete_single_find_blocking(
            &storage_path,
            find_id,
            delete_files,
            delete_sample_folder.unwrap_or(false),
        )
    })
    .await
    .map_err(|e| format!("Delete find worker failed: {e}"))?
}

fn delete_single_find_blocking(
    storage_path: &str,
    find_id: i64,
    delete_files: bool,
    delete_sample_folder: bool,
) -> Result<BulkOperationResult, String> {
    let result =
        bulk_delete_finds_blocking(storage_path, &[find_id], delete_files, delete_sample_folder)?;
    if result.completed == 1 {
        return Ok(result);
    }

    // Deleting a find that is already gone is the outcome the caller asked for, so it
    // reports as done rather than as a red error on a stale list or a double confirm. A row
    // that is still there means a real failure the caller has to see. The bulk contract is
    // left alone: for a batch, "one of the ten was missing" is worth reporting.
    let conn = open_db(storage_path)?;
    let still_present = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM finds WHERE id = ?1)",
            params![find_id],
            |row| row.get::<_, bool>(0),
        )
        .map_err(|e| format!("Could not confirm whether find {find_id} was deleted: {e}"))?;
    if still_present {
        return Err(result
            .operation_failures
            .first()
            .map(|failure| failure.error.clone())
            .unwrap_or_else(|| format!("Find {find_id} was not deleted")));
    }

    let mut already_gone = result;
    already_gone.completed = 1;
    already_gone.operation_failures.clear();
    Ok(already_gone)
}

/// Deletes many finds in one command.
///
/// The per-find command is fine for one row and wrong for five hundred: each call was a
/// separate IPC round trip opening its own connection, and they then queued behind
/// SQLite's single writer. This takes one connection and removes every row inside one
/// transaction, so a batch either lands or does not.
///
/// Irreversible filesystem work happens *after* the commit, deliberately. Trashing
/// photos first and then failing to delete the rows would leave records pointing at
/// files that are gone; this way a failure at worst leaves files behind, which
/// `audit_photo_library` already reports as orphans.
#[derive(Debug, Default, serde::Serialize, PartialEq)]
pub struct BulkOperationFailure {
    pub item: String,
    pub error: String,
}

#[derive(Debug, Default, serde::Serialize, PartialEq)]
pub struct BulkOperationResult {
    pub requested: u32,
    pub completed: u32,
    pub file_failures: Vec<BulkOperationFailure>,
    pub operation_failures: Vec<BulkOperationFailure>,
}

fn bulk_requested(find_ids: &[i64]) -> u32 {
    u32::try_from(find_ids.len()).unwrap_or(u32::MAX)
}

#[tauri::command]
pub async fn bulk_delete_finds(
    storage_path: String,
    find_ids: Vec<i64>,
    delete_files: bool,
    delete_sample_folder: Option<bool>,
) -> Result<BulkOperationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        bulk_delete_finds_blocking(
            &storage_path,
            &find_ids,
            delete_files,
            delete_sample_folder.unwrap_or(false),
        )
    })
    .await
    .map_err(|e| format!("Bulk delete worker failed: {e}"))?
}

fn bulk_delete_finds_blocking(
    storage_path: &str,
    find_ids: &[i64],
    delete_files: bool,
    delete_sample_folder: bool,
) -> Result<BulkOperationResult, String> {
    let mut result = BulkOperationResult {
        requested: bulk_requested(find_ids),
        ..BulkOperationResult::default()
    };
    if find_ids.is_empty() {
        return Ok(result);
    }

    let mut conn = open_db(storage_path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;

    // Collect before deleting: once the rows are gone the paths are unrecoverable.
    let mut photo_paths: Vec<String> = Vec::new();
    let mut sample_folders: Vec<String> = Vec::new();
    for find_id in find_ids {
        if delete_files {
            let mut stmt = conn
                .prepare("SELECT photo_path FROM find_photos WHERE find_id = ?1")
                .map_err(|e| e.to_string())?;
            let paths = stmt
                .query_map(params![find_id], |row| row.get::<_, String>(0))
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| format!("Could not read photo paths for find {find_id}: {e}"))?;
            photo_paths.extend(paths);
        }
        if delete_sample_folder {
            if let Some(folder) = conn
                .query_row(
                    "SELECT folder_path FROM samples WHERE find_id = ?1",
                    params![find_id],
                    |row| row.get::<_, Option<String>>(0),
                )
                .optional()
                .map_err(|e| format!("Could not read sample folder for find {find_id}: {e}"))?
                .flatten()
            {
                sample_folders.push(folder);
            }
        }
    }

    let tx = conn
        .transaction()
        .map_err(|e| format!("Could not start the delete transaction: {e}"))?;
    for find_id in find_ids {
        // The register entry always goes with the find — it points at a row that is
        // about to disappear. The folder is handled below, after the commit.
        crate::commands::samples::remove_sample_for_find(&tx, storage_path, *find_id, false)?;
        let deleted = tx
            .execute("DELETE FROM finds WHERE id = ?1", params![find_id])
            .map_err(|e| format!("DB delete failed: {}", e))?;
        if deleted > 0 {
            result.completed = result.completed.saturating_add(1);
        } else {
            result.operation_failures.push(BulkOperationFailure {
                item: find_id.to_string(),
                error: "Find no longer exists".to_string(),
            });
        }
    }
    tx.commit()
        .map_err(|e| format!("Could not finish the delete: {e}"))?;

    for rel_path in &photo_paths {
        let abs_path =
            Path::new(storage_path).join(rel_path.replace('/', std::path::MAIN_SEPARATOR_STR));
        match path_state(&abs_path) {
            // Nothing was left behind, so there is nothing to warn about. The audit
            // reports rows like this separately.
            PathState::Missing => continue,
            PathState::File => {}
            // A photo row pointing at a folder would otherwise put that whole folder in
            // the Recycle Bin. Anything that is not plainly a file is left alone.
            other => {
                result.file_failures.push(BulkOperationFailure {
                    item: rel_path.clone(),
                    error: other.reason_code().to_string(),
                });
                continue;
            }
        }
        if let Err(e) = trash::delete(&abs_path) {
            if removal_failure_is_real(&abs_path) {
                eprintln!("trash::delete failed for {}: {}", abs_path.display(), e);
                result.file_failures.push(BulkOperationFailure {
                    item: rel_path.clone(),
                    error: e.to_string(),
                });
            }
        }
    }
    for folder_rel in &sample_folders {
        let folder_abs =
            Path::new(storage_path).join(folder_rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        match path_state(&folder_abs) {
            // Already gone is the requested outcome for a folder too.
            PathState::Missing => continue,
            PathState::Directory => {}
            other => {
                result.file_failures.push(BulkOperationFailure {
                    item: folder_rel.clone(),
                    error: other.reason_code().to_string(),
                });
                continue;
            }
        }
        if let Err(error) = std::fs::remove_dir_all(&folder_abs) {
            if removal_failure_is_real(&folder_abs) {
                result.file_failures.push(BulkOperationFailure {
                    item: folder_rel.clone(),
                    error: error.to_string(),
                });
            }
        }
    }
    Ok(result)
}

/// Moves many finds' photos out to a folder and drops their records, in one command.
///
/// Unlike the delete above this is *not* one transaction: each find's files are moved
/// and only then is its row removed. Moving files out of the library is irreversible, so
/// a failure part way through must leave the already-moved finds correctly deleted
/// rather than rolling their rows back into records pointing at files that have left.
#[tauri::command]
pub async fn bulk_move_finds_to_folder(
    storage_path: String,
    find_ids: Vec<i64>,
    dest_folder: String,
) -> Result<BulkOperationResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        bulk_move_finds_to_folder_blocking(&storage_path, &find_ids, &dest_folder)
    })
    .await
    .map_err(|e| format!("Bulk move worker failed: {e}"))?
}

fn bulk_move_finds_to_folder_blocking(
    storage_path: &str,
    find_ids: &[i64],
    dest_folder: &str,
) -> Result<BulkOperationResult, String> {
    let mut result = BulkOperationResult {
        requested: bulk_requested(find_ids),
        ..BulkOperationResult::default()
    };
    if find_ids.is_empty() {
        return Ok(result);
    }
    let mut conn = open_db(storage_path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .map_err(|e| e.to_string())?;
    for find_id in find_ids {
        match move_find_files_on_conn(&mut conn, storage_path, *find_id, dest_folder) {
            Ok(()) => result.completed = result.completed.saturating_add(1),
            Err(error) => {
                result.operation_failures.push(BulkOperationFailure {
                    item: find_id.to_string(),
                    error,
                });
                // Preserve the old stop-on-first-error behaviour. A failed find may
                // already have moved some files; continuing would enlarge the recovery
                // surface while providing no additional safety.
                break;
            }
        }
    }
    Ok(result)
}

#[tauri::command]
pub async fn get_find_photos(storage_path: String, find_id: i64) -> Result<Vec<FindPhoto>, String> {
    tauri::async_runtime::spawn_blocking(move || {
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
    })
    .await
    .map_err(|e| format!("Find photos worker failed: {e}"))?
}

#[tauri::command]
pub async fn bulk_rename_species(
    storage_path: String,
    find_ids: Vec<i64>,
    new_species_name: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        bulk_rename_species_blocking(&storage_path, &find_ids, &new_species_name)
    })
    .await
    .map_err(|e| format!("Bulk rename worker failed: {e}"))?
}

fn bulk_rename_species_blocking(
    storage_path: &str,
    find_ids: &[i64],
    new_species_name: &str,
) -> Result<(), String> {
    {
        if find_ids.is_empty() {
            return Ok(());
        }
        let new_species_name = new_species_name.trim().to_string();
        if new_species_name.is_empty() {
            return Err("new species name cannot be empty".into());
        }

        let mut conn = open_db(storage_path)?;

        // Read first, outside any transaction. Holding SQLite's write lock while photos
        // are moved on disk blocks every other write for as long as the move takes —
        // on a species folder with hundreds of photos that is long enough to push other
        // commands past their busy timeout.
        let mut photo_rows: Vec<(i64, String)> = Vec::new();
        let mut old_species_names: Vec<String> = Vec::new();
        for find_id in find_ids {
            let species_name: String = conn
                .query_row(
                    "SELECT species_name FROM finds WHERE id = ?1",
                    params![find_id],
                    |row| row.get(0),
                )
                .map_err(|e| format!("Failed to read species for id {}: {}", find_id, e))?;
            old_species_names.push(species_name);

            let mut stmt = conn
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

        let target_folder = Path::new(storage_path).join(resolve_location_component(
            &plain_species_name(&new_species_name),
            "unknown_species",
        ));
        let mut old_folders: Vec<PathBuf> = old_species_names
            .iter()
            .map(|name| {
                Path::new(storage_path).join(resolve_location_component(
                    &plain_species_name(name),
                    "unknown_species",
                ))
            })
            .collect();
        old_folders.sort();
        old_folders.dedup();

        // A species is only *leaving* if every find carrying it is in this selection.
        // Renaming part of a species is a normal thing to do from the collection, and it
        // must not disturb the finds left behind — neither their photos on disk nor the
        // zones, notes and profile that still belong to the old name.
        let selected: std::collections::HashSet<i64> = find_ids.iter().copied().collect();
        let mut distinct_old_species: Vec<String> = old_species_names.clone();
        distinct_old_species.sort();
        distinct_old_species.dedup();
        let mut fully_moved_species: std::collections::HashSet<String> =
            std::collections::HashSet::new();
        for species in &distinct_old_species {
            if species == &new_species_name {
                continue;
            }
            let mut stmt = conn
                .prepare("SELECT id FROM finds WHERE species_name = ?1")
                .map_err(|e| e.to_string())?;
            let mut all_selected = true;
            let ids = stmt
                .query_map(params![species], |row| row.get::<_, i64>(0))
                .map_err(|e| e.to_string())?;
            for id in ids {
                let id = id.map_err(|e| e.to_string())?;
                if !selected.contains(&id) {
                    all_selected = false;
                    break;
                }
            }
            if all_selected {
                fully_moved_species.insert(species.clone());
            }
        }

        // Renaming the folder itself carries every file inside it, including photos of
        // finds that were not selected. Only safe when the whole species is moving.
        let whole_species_is_moving = distinct_old_species.len() == 1
            && fully_moved_species.contains(&distinct_old_species[0]);
        let renamed_whole_folder = if whole_species_is_moving
            && old_folders.len() == 1
            && old_folders[0].exists()
            && !target_folder.exists()
        {
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

        // Move the files and record where each photo ended up. Still no transaction.
        let mut moved_photo_paths: Vec<(i64, String)> = Vec::new();
        for (photo_id, photo_path) in &photo_rows {
            // Normalize DB-stored forward slashes to the OS separator so the
            // path comparison below works correctly on Windows (mixed separators
            // would make source_abs != target_abs even for the same file).
            let normalized_photo_path = photo_path.replace('/', std::path::MAIN_SEPARATOR_STR);
            let source_abs = Path::new(storage_path).join(&normalized_photo_path);
            let filename = source_abs
                .file_name()
                .ok_or_else(|| format!("Photo path has no filename: {}", source_abs.display()))?;
            let expected_target = target_folder.join(filename);
            let target_abs = if source_abs == expected_target {
                source_abs.clone()
            } else if renamed_whole_folder && expected_target.is_file() {
                // The folder move already carried this file to the expected path.
                expected_target
            } else if source_abs.is_file() {
                let destination = unique_destination_path(&expected_target);
                std::fs::create_dir_all(destination.parent().ok_or_else(|| {
                    format!("Target path has no parent: {}", destination.display())
                })?)
                .map_err(|e| {
                    format!(
                        "Failed to prepare target folder for '{}': {}",
                        destination.display(),
                        e
                    )
                })?;
                move_file_without_overwrite(&source_abs, &destination)?;
                destination
            } else {
                // Never guess that an unrelated same-named file in the target folder is
                // the missing source. Preserve the stale path so the library audit can
                // report it accurately instead of silently attaching somebody else's photo.
                moved_photo_paths.push((*photo_id, photo_path.clone()));
                continue;
            };

            let relative = target_abs
                .strip_prefix(storage_path)
                .map(|p| {
                    p.to_string_lossy()
                        .replace('\\', "/")
                        .trim_start_matches('/')
                        .to_string()
                })
                .unwrap_or_else(|_| target_abs.to_string_lossy().replace('\\', "/"));
            moved_photo_paths.push((*photo_id, relative));
        }

        // Everything below is SQL only, so the write lock is held for the length of a
        // few statements rather than the length of the file moves.
        let tx = conn.transaction().map_err(|e| e.to_string())?;

        for (photo_id, relative) in &moved_photo_paths {
            tx.execute(
                "UPDATE find_photos SET photo_path = ?1 WHERE id = ?2",
                params![relative, photo_id],
            )
            .map_err(|e| format!("Failed to update photo path for photo {}: {}", photo_id, e))?;
        }

        for find_id in find_ids {
            tx.execute(
                "UPDATE finds SET species_name = ?1 WHERE id = ?2",
                params![new_species_name, find_id],
            )
            .map_err(|e| format!("Bulk rename failed for id {}: {}", find_id, e))?;
        }

        for old_species_name in &old_species_names {
            // Zones, notes and the profile describe the species, not these particular
            // finds. Moving them while finds remain under the old name would take them
            // away from the species that still has them.
            if !fully_moved_species.contains(old_species_name) {
                continue;
            }
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

        // After the commit so the helper sees the updated photo paths and species names.
        crate::commands::samples::relocate_samples_for_finds(
            &conn,
            storage_path,
            find_ids,
            &new_species_name,
        )?;

        for old_species_name in &old_species_names {
            let old_folder = Path::new(storage_path).join(resolve_location_component(
                &plain_species_name(old_species_name),
                "unknown_species",
            ));
            remove_empty_dir_if_possible(&old_folder);
        }

        Ok(())
    }
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

    // Only the id lookup blocks here; the rename it delegates to offloads its own work.
    let lookup_storage_path = storage_path.clone();
    let find_ids: Vec<i64> = tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&lookup_storage_path)?;
        let mut stmt = conn
            .prepare("SELECT id FROM finds WHERE species_name = ?1 ORDER BY id ASC")
            .map_err(|e| e.to_string())?;
        let ids = stmt
            .query_map(params![old_species_name], |row| row.get(0))
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok::<Vec<i64>, String>(ids)
    })
    .await
    .map_err(|e| format!("Species folder rename worker failed: {e}"))??;

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

fn unique_destination_path_reserved(initial: &Path, reserved: &mut HashSet<PathBuf>) -> PathBuf {
    let stem = initial
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| "photo".to_string());
    let ext = initial
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    let parent = initial.parent().map(Path::to_path_buf).unwrap_or_default();
    for index in 1..10_000 {
        let candidate = if index == 1 {
            initial.to_path_buf()
        } else {
            parent.join(format!("{stem} ({index}){ext}"))
        };
        if !candidate.exists() && reserved.insert(candidate.clone()) {
            return candidate;
        }
    }
    // The caller will reject this as an existing destination instead of overwriting it.
    initial.to_path_buf()
}

fn move_file_without_overwrite(source: &Path, destination: &Path) -> Result<(), String> {
    if destination.exists() {
        return Err(format!(
            "Refusing to overwrite existing file '{}'",
            destination.display()
        ));
    }
    if std::fs::rename(source, destination).is_ok() {
        return Ok(());
    }
    std::fs::copy(source, destination).map_err(|e| {
        format!(
            "Failed to copy '{}' to '{}': {e}",
            source.display(),
            destination.display()
        )
    })?;
    if let Err(error) = std::fs::remove_file(source) {
        let _ = std::fs::remove_file(destination);
        return Err(format!(
            "Copied '{}' but could not remove the source: {error}",
            source.display()
        ));
    }
    Ok(())
}

fn rollback_file_moves(moved: &[(PathBuf, PathBuf)]) -> Vec<String> {
    let mut errors = Vec::new();
    for (original, destination) in moved.iter().rev() {
        if let Err(error) = move_file_without_overwrite(destination, original) {
            errors.push(error);
        }
    }
    errors
}

#[derive(serde::Serialize, Debug, Default)]
pub struct PruneSummary {
    /// Photo rows removed because the filesystem confirmed the file is gone.
    pub removed: u32,
    pub affected_finds: u32,
    /// Paths that stopped the cleanup. Non-empty means nothing at all was removed.
    pub blocked: Vec<BulkOperationFailure>,
    pub backup_path: Option<String>,
}

pub(crate) struct PhotoRow {
    pub photo_id: i64,
    pub find_id: i64,
    pub photo_path: String,
    pub is_primary: bool,
}

#[derive(Default)]
pub(crate) struct PrunePlan {
    pub remove: Vec<i64>,
    pub primaries_lost: Vec<i64>,
    pub affected_finds: HashSet<i64>,
    /// Paths that stopped the cleanup: unreadable, or present as something other than a
    /// photo file. Non-empty means nothing may be removed.
    pub blocked: Vec<BulkOperationFailure>,
}

/// Pure decision step, kept apart from the database so the rules can be tested without
/// having to make a real disk fail.
pub(crate) fn plan_prune(
    rows: &[PhotoRow],
    state_of: impl Fn(&str) -> PathState,
) -> PrunePlan {
    let mut plan = PrunePlan::default();
    for row in rows {
        match state_of(&row.photo_path) {
            // A healthy photo: leave it alone.
            PathState::File => {}
            PathState::Missing => {
                plan.remove.push(row.photo_id);
                plan.affected_finds.insert(row.find_id);
                if row.is_primary && !plan.primaries_lost.contains(&row.find_id) {
                    plan.primaries_lost.push(row.find_id);
                }
            }
            // Unreadable, or there but not a photo file. Either way the library is not in
            // the state this cleanup assumes, so it stops rather than guessing.
            other => plan.blocked.push(BulkOperationFailure {
                item: row.photo_path.clone(),
                error: other.reason_code().to_string(),
            }),
        }
    }
    // One blocked path invalidates the whole run, so there is nothing to remove.
    if !plan.blocked.is_empty() {
        plan.remove.clear();
        plan.primaries_lost.clear();
        plan.affected_finds.clear();
    }
    plan
}

/// What the filesystem can tell us about a path.
///
/// `Path::exists()` collapses "confirmed absent" and "could not tell" into `false`, which
/// is how an unplugged drive or a permissions problem can look exactly like a deleted
/// photo. "Something is there" is not enough either: a photo row that now points at a
/// folder would send that whole folder to the Recycle Bin, and a cleanup would read it as
/// a healthy photo. So callers get the kind as well, and act only on what they expect.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum PathState {
    /// The filesystem confirmed there is nothing there.
    Missing,
    /// A regular file.
    File,
    /// A directory.
    Directory,
    /// Something else entirely: a symlink, a device, a reparse point. Never acted on.
    Other,
    /// The filesystem refused to answer: permissions, I/O, an offline volume.
    Inaccessible,
}

impl PathState {
    /// Stable code for a caller that expected something else.
    ///
    /// A code rather than a sentence: these travel to the UI, which has to render them in
    /// the user's language. An English string here would show up mid-sentence in Croatian.
    pub(crate) fn reason_code(self) -> &'static str {
        match self {
            PathState::Missing => "path-missing",
            PathState::File => "path-is-file",
            PathState::Directory => "path-is-folder",
            PathState::Other => "path-not-a-file",
            PathState::Inaccessible => "path-unreadable",
        }
    }
}

/// Uses `symlink_metadata` so a link is reported as `Other` rather than followed to
/// whatever it points at -- deleting through a link is not something to guess at.
pub(crate) fn path_state(path: &Path) -> PathState {
    match std::fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_file() => PathState::File,
        Ok(metadata) if metadata.is_dir() => PathState::Directory,
        Ok(_) => PathState::Other,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => PathState::Missing,
        Err(_) => PathState::Inaccessible,
    }
}

/// Decides what a failed removal means, by asking the filesystem again.
///
/// A removal can fail because the path vanished between the check and the attempt — a
/// concurrent cleanup, or the user deleting it in Explorer at that moment. That is the
/// outcome the caller wanted, so it is not worth a warning. Anything else is a leftover
/// the caller has to hear about.
pub(crate) fn removal_failure_is_real(path: &Path) -> bool {
    !matches!(path_state(path), PathState::Missing)
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
    const BACKUP_HEADROOM_BYTES: u64 = 32 * 1024 * 1024;
    let db_path = Path::new(storage_path).join("bili-mushroom.db");
    if !db_path.exists() {
        return Ok(None);
    }

    let backup_dir = Path::new(storage_path)
        .join(".bili-backups")
        .join("maintenance");
    std::fs::create_dir_all(&backup_dir).map_err(|e| {
        format!(
            "Failed to create backup folder '{}': {}",
            backup_dir.display(),
            e
        )
    })?;

    let needed = std::fs::metadata(&db_path)
        .map(|metadata| metadata.len())
        .unwrap_or(0)
        .saturating_add(BACKUP_HEADROOM_BYTES);
    if crate::commands::import::free_space_bytes(&backup_dir)
        .is_some_and(|free| free < needed)
    {
        let existing = maintenance_backups(&backup_dir);
        for stale in crate::commands::import::backups_expendable_for_space(&existing) {
            let _ = std::fs::remove_file(stale);
        }
    }
    if let Some(free) = crate::commands::import::free_space_bytes(&backup_dir) {
        if free < needed {
            return Err(format!(
                "A safety copy of the library database ({}) is needed before maintenance, but only {} is free. Free some disk space and try again — your library has not been changed.",
                crate::commands::import::format_bytes(needed),
                crate::commands::import::format_bytes(free),
            ));
        }
    }

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
    // Milliseconds so two backups in the same second cannot collide.
    let timestamp = Utc::now().format("%Y%m%d-%H%M%S%.3f").to_string();
    let backup_path = backup_dir.join(format!("bili-mushroom-{timestamp}-{safe_reason}.db"));

    // Goes through SQLite rather than fs::copy: a file copy of a live database is not
    // guaranteed coherent, and once the library runs in WAL mode it would miss whatever
    // still sits in the -wal sidecar — exactly the recent edits worth protecting.
    let conn = open_db(storage_path)?;
    crate::commands::import::copy_database_to(&conn, &backup_path).map_err(|e| {
        format!(
            "Failed to back up database from '{}' to '{}': {}",
            db_path.display(),
            backup_path.display(),
            e
        )
    })?;

    prune_maintenance_backups(&backup_dir);

    Ok(Some(backup_path.to_string_lossy().to_string()))
}

/// Automatic maintenance backups, oldest first. The dedicated folder ensures pruning
/// can never touch a manual copy or a migration backup.
fn maintenance_backups(backup_dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(backup_dir) else {
        return Vec::new();
    };
    let mut backups: Vec<PathBuf> = entries
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|extension| extension == "db"))
        .collect();
    backups.sort();
    backups
}

fn prune_maintenance_backups(backup_dir: &Path) {
    let backups: Vec<(PathBuf, u64)> = maintenance_backups(backup_dir)
        .into_iter()
        .map(|path| {
            let size = std::fs::metadata(&path)
                .map(|metadata| metadata.len())
                .unwrap_or(0);
            (path, size)
        })
        .collect();
    for stale in crate::commands::import::backups_to_discard(&backups) {
        let _ = std::fs::remove_file(stale);
    }
}

#[tauri::command]
pub async fn set_find_favorite(
    storage_path: String,
    find_id: i64,
    is_favorite: bool,
) -> Result<FindRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
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
                "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note, weather, determiner, finder FROM finds WHERE id = ?1",
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
    })
    .await
    .map_err(|e| format!("Favorite worker failed: {e}"))?
}

#[tauri::command]
pub async fn cleanup_internal_records(storage_path: String) -> Result<i64, String> {
    tauri::async_runtime::spawn_blocking(move || {
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
    })
    .await
    .map_err(|e| format!("Library cleanup worker failed: {e}"))?
}

#[tauri::command]
pub async fn add_find_photos(
    storage_path: String,
    find_id: i64,
    source_paths: Vec<String>,
) -> Result<FindRecord, String> {
    tauri::async_runtime::spawn_blocking(move || {
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
                "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note, weather, determiner, finder FROM finds WHERE id = ?1",
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
    })
    .await
    .map_err(|e| format!("Add photos worker failed: {e}"))?
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
    tauri::async_runtime::spawn_blocking(move || {
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
                "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note, weather, determiner, finder FROM finds WHERE id = ?1",
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
    })
    .await
    .map_err(|e| format!("Delete photo worker failed: {e}"))?
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
    tauri::async_runtime::spawn_blocking(move || {
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
                "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note, weather, determiner, finder FROM finds WHERE id = ?1",
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
    })
    .await
    .map_err(|e| format!("Bulk photo delete worker failed: {e}"))?
}

#[tauri::command]
pub async fn edit_find_photo_image(
    storage_path: String,
    photo_id: i64,
    rotate_degrees: Option<i32>,
    crop: Option<CropRect>,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let conn = open_db(&storage_path)?;
        let photo_path: String = conn
            .query_row(
                "SELECT photo_path FROM find_photos WHERE id = ?1",
                params![photo_id],
                |row| row.get(0),
            )
            .map_err(|e| format!("Photo not found: {}", e))?;

        let absolute_path = Path::new(&storage_path)
            .join(photo_path.replace('/', std::path::MAIN_SEPARATOR_STR));
        if !absolute_path.exists() {
            return Err(format!(
                "Photo file does not exist: {}",
                absolute_path.display()
            ));
        }

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
pub async fn prune_missing_photos(storage_path: String) -> Result<PruneSummary, String> {
    tauri::async_runtime::spawn_blocking(move || prune_missing_photos_blocking(&storage_path))
        .await
        .map_err(|e| format!("Prune photos worker failed: {e}"))?
}

fn prune_missing_photos_blocking(storage_path: &str) -> Result<PruneSummary, String> {
    {
        let mut conn = open_db(storage_path)?;

        let mut stmt = conn
            .prepare(
                "SELECT id, find_id, photo_path, is_primary FROM find_photos ORDER BY find_id, is_primary DESC, id ASC",
            )
            .map_err(|e| e.to_string())?;
        let rows: Vec<PhotoRow> = stmt
            .query_map([], |row| {
                Ok(PhotoRow {
                    photo_id: row.get::<_, i64>(0)?,
                    find_id: row.get::<_, i64>(1)?,
                    photo_path: row.get::<_, String>(2)?,
                    is_primary: row.get::<_, i64>(3)? == 1,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        drop(stmt);

        // Look at every path before touching the database. Forgetting a row is only safe
        // when the filesystem actually confirmed the file is gone.
        let plan = plan_prune(&rows, |photo_path| {
            let abs = Path::new(storage_path)
                .join(photo_path.replace('/', std::path::MAIN_SEPARATOR_STR));
            path_state(&abs)
        });

        if !plan.blocked.is_empty() {
            // An unplugged drive makes every photo look missing, and a row pointing at a
            // folder is not a photo at all. Removing rows on either reading would throw
            // away the library's only record of them, so nothing is removed and the
            // caller is told which path stopped the run.
            return Ok(PruneSummary {
                removed: 0,
                affected_finds: 0,
                blocked: plan.blocked,
                backup_path: None,
            });
        }

        if plan.remove.is_empty() {
            return Ok(PruneSummary::default());
        }

        let backup_path = backup_db_before_destructive_change(storage_path, "prune-missing-photos")?;

        let tx = conn
            .transaction()
            .map_err(|e| format!("Could not start the cleanup transaction: {e}"))?;
        let mut removed: u32 = 0;
        for photo_id in &plan.remove {
            removed += tx
                .execute("DELETE FROM find_photos WHERE id = ?1", params![photo_id])
                .map_err(|e| format!("delete failed: {e}"))? as u32;
        }

        // A find whose primary photo went needs a new one, in the same transaction: a
        // crash between the two would leave a find with photos but no primary.
        for find_id in &plan.primaries_lost {
            let remaining: i64 = tx
                .query_row(
                    "SELECT COUNT(*) FROM find_photos WHERE find_id = ?1",
                    params![find_id],
                    |row| row.get(0),
                )
                .map_err(|e| format!("Could not count the remaining photos: {e}"))?;
            if remaining > 0 {
                tx.execute(
                    "UPDATE find_photos SET is_primary = 1 WHERE id = (SELECT id FROM find_photos WHERE find_id = ?1 ORDER BY id ASC LIMIT 1)",
                    params![find_id],
                )
                .map_err(|e| format!("Primary promotion failed: {e}"))?;
            }
        }
        tx.commit()
            .map_err(|e| format!("Could not finish the cleanup: {e}"))?;

        Ok(PruneSummary {
            removed,
            affected_finds: plan.affected_finds.len() as u32,
            blocked: Vec::new(),
            backup_path,
        })
    }
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
    tauri::async_runtime::spawn_blocking(move || {
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
    })
    .await
    .map_err(|e| format!("Duplicate photo cleanup worker failed: {e}"))?
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
    tauri::async_runtime::spawn_blocking(move || {
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
    })
    .await
    .map_err(|e| format!("Photo library audit worker failed: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::import::test_helpers::{make_find_record, setup_in_memory_db};
    use crate::commands::import::{find_record_from_row, insert_find_photo, insert_find_row};

    #[test]
    fn thumbnail_warmup_advances_through_the_library_and_wraps() {
        let conn = setup_in_memory_db();
        let find_id = insert_find_row(&conn, &make_find_record("one.jpg", "2024-05-10"))
            .expect("insert find");
        for index in 1..=5 {
            insert_find_photo(
                &conn,
                find_id,
                &format!("Boletus_edulis/photo-{index}.jpg"),
                index == 1,
            )
            .expect("insert photo");
        }
        insert_find_photo(
            &conn,
            find_id,
            "Boletus_edulis/photo-1.jpg",
            false,
        )
        .expect("insert duplicate path");

        assert_eq!(
            next_thumbnail_warmup_batch(&conn, 256, 2).expect("first batch"),
            vec![
                "Boletus_edulis/photo-1.jpg".to_string(),
                "Boletus_edulis/photo-2.jpg".to_string()
            ]
        );
        assert_eq!(
            next_thumbnail_warmup_batch(&conn, 256, 2).expect("second batch"),
            vec![
                "Boletus_edulis/photo-3.jpg".to_string(),
                "Boletus_edulis/photo-4.jpg".to_string()
            ]
        );
        assert_eq!(
            next_thumbnail_warmup_batch(&conn, 256, 2).expect("short final batch"),
            vec!["Boletus_edulis/photo-5.jpg".to_string()]
        );
        assert_eq!(
            next_thumbnail_warmup_batch(&conn, 256, 2).expect("wrapped batch"),
            vec![
                "Boletus_edulis/photo-1.jpg".to_string(),
                "Boletus_edulis/photo-2.jpg".to_string()
            ]
        );
    }

    // -----------------------------------------------------------------------
    // create_find tests
    // -----------------------------------------------------------------------

    /// Destructive maintenance takes a copy first. It must be a real, complete database
    /// — `fs::copy` of a live SQLite file is not guaranteed coherent, and under WAL it
    /// would miss whatever still sits in the sidecar, which is precisely the recent work
    /// worth protecting.
    #[test]
    fn destructive_backup_writes_a_usable_database_copy() {
        let dir = tempfile::tempdir().expect("tempdir");
        let storage_path = dir.path().to_str().expect("storage path");
        {
            let conn = open_db(storage_path).expect("create library database");
            insert_find_row(&conn, &make_find_record("keep-me.jpg", "2024-05-10"))
                .expect("insert a find worth protecting");
        }

        let backup_path = backup_db_before_destructive_change(storage_path, "prune missing/photos!")
            .expect("write the backup")
            .expect("a backup path is returned when the database exists");

        let file_name = Path::new(&backup_path)
            .file_name()
            .and_then(|name| name.to_str())
            .expect("backup file name");
        assert!(
            file_name.ends_with("-prune-missing-photos-.db"),
            "the reason is sanitised into the file name, got {file_name}"
        );
        assert_eq!(
            Path::new(&backup_path).parent(),
            Some(
                dir.path()
                    .join(".bili-backups")
                    .join("maintenance")
                    .as_path()
            ),
            "maintenance copies stay isolated from manual and migration backups"
        );

        let backup = Connection::open(&backup_path).expect("open the backup");
        let check: String = backup
            .query_row("PRAGMA quick_check", [], |row| row.get(0))
            .expect("check the backup");
        assert_eq!(check, "ok");
        let finds: i64 = backup
            .query_row("SELECT COUNT(*) FROM finds", [], |row| row.get(0))
            .expect("count finds in the backup");
        assert_eq!(finds, 1, "the copy must carry the user's data");
    }

    #[test]
    fn destructive_backup_is_skipped_when_there_is_no_database() {
        let dir = tempfile::tempdir().expect("tempdir");
        let storage_path = dir.path().to_str().expect("storage path");

        assert!(
            backup_db_before_destructive_change(storage_path, "nothing-to-do")
                .expect("no database is not an error")
                .is_none()
        );
    }

    #[test]
    fn maintenance_backup_retention_keeps_three_newest_and_ignores_other_files() {
        let dir = tempfile::tempdir().expect("tempdir");
        let backup_dir = dir.path();
        let names = [
            "bili-mushroom-20260101-000000.000-cleanup.db",
            "bili-mushroom-20260201-000000.000-cleanup.db",
            "bili-mushroom-20260301-000000.000-cleanup.db",
            "bili-mushroom-20260401-000000.000-cleanup.db",
        ];
        for name in names {
            std::fs::write(backup_dir.join(name), b"backup").expect("write backup fixture");
        }
        let unrelated = backup_dir.join("readme.txt");
        std::fs::write(&unrelated, b"do not delete").expect("write unrelated fixture");

        prune_maintenance_backups(backup_dir);

        assert!(!backup_dir.join(names[0]).exists());
        for name in &names[1..] {
            assert!(backup_dir.join(name).exists(), "{name} should be retained");
        }
        assert!(unrelated.exists(), "non-database files are never considered");
    }

    #[test]
    fn bulk_delete_removes_every_find_in_one_transaction() {
        let dir = tempfile::tempdir().expect("tempdir");
        let storage_path = dir.path().to_str().expect("storage path");
        let ids: Vec<i64> = {
            let conn = open_db(storage_path).expect("open library");
            (0..5)
                .map(|i| {
                    insert_find_row(&conn, &make_find_record(&format!("f{i}.jpg"), "2024-05-10"))
                        .expect("insert find")
                })
                .collect()
        };

        let result = bulk_delete_finds_blocking(storage_path, &ids[..3], false, false)
            .expect("bulk delete");
        assert_eq!(result.requested, 3);
        assert_eq!(result.completed, 3);
        assert!(result.file_failures.is_empty());
        assert!(result.operation_failures.is_empty());

        let conn = open_db(storage_path).expect("reopen library");
        let remaining: i64 = conn
            .query_row("SELECT COUNT(*) FROM finds", [], |row| row.get(0))
            .expect("count finds");
        assert_eq!(remaining, 2, "only the requested finds are removed");
        for id in &ids[..3] {
            let gone: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM finds WHERE id = ?1",
                    params![id],
                    |row| row.get(0),
                )
                .expect("look up deleted find");
            assert_eq!(gone, 0);
        }
    }

    /// Exercises the single-delete path itself, not the bulk helper underneath it: the
    /// contract being guarded is that `delete_find` hands the failures back to the caller
    /// instead of swallowing them, which is what let a leftover look like a clean delete.
    #[test]
    fn single_delete_reports_something_it_could_not_remove() {
        let dir = tempfile::tempdir().expect("tempdir");
        let storage_path = dir.path().to_str().expect("storage path");
        let photo_rel = "Boletus_edulis/here.jpg";
        std::fs::create_dir_all(dir.path().join("Boletus_edulis")).expect("species folder");
        std::fs::write(dir.path().join("Boletus_edulis/here.jpg"), b"photo").expect("photo");
        // A sample whose recorded folder is a file, not a directory: removing it fails
        // deterministically, which is a leftover the user has to hear about.
        let blocker_rel = "Uzorci/blocked";
        std::fs::create_dir_all(dir.path().join("Uzorci")).expect("samples root");
        std::fs::write(dir.path().join("Uzorci/blocked"), b"not a directory").expect("blocker");
        let find_id = {
            let conn = open_db(storage_path).expect("open library");
            let find_id = insert_find_row(&conn, &make_find_record("here.jpg", "2024-05-10"))
                .expect("insert find");
            insert_find_photo(&conn, find_id, photo_rel, true).expect("insert photo");
            conn.execute(
                "INSERT INTO samples (find_id, species_name, sample_year, sample_no, folder_path, spore_print, dna_sample, created_at, updated_at)
                 VALUES (?1, 'Boletus edulis', 2026, 1, ?2, 0, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
                params![find_id, blocker_rel],
            )
            .expect("insert sample");
            find_id
        };

        let result = delete_single_find_blocking(storage_path, find_id, true, true)
            .expect("the record still goes");

        assert_eq!(result.completed, 1);
        assert_eq!(
            result.file_failures.len(),
            1,
            "the caller must be able to see what stayed behind"
        );
        assert_eq!(result.file_failures[0].item, blocker_rel);
    }

    #[test]
    fn deleting_a_find_that_is_already_gone_counts_as_done() {
        let dir = tempfile::tempdir().expect("tempdir");
        let storage_path = dir.path().to_str().expect("storage path");
        let find_id = {
            let conn = open_db(storage_path).expect("open library");
            insert_find_row(&conn, &make_find_record("here.jpg", "2024-05-10")).expect("insert")
        };

        let first = delete_single_find_blocking(storage_path, find_id, false, false)
            .expect("first delete");
        assert_eq!(first.completed, 1);

        // Deleting it again is the same requested outcome, not a red error on a stale
        // list or a double confirm.
        let second = delete_single_find_blocking(storage_path, find_id, false, false)
            .expect("deleting an already deleted find succeeds");
        assert_eq!(second.completed, 1);
        assert!(second.operation_failures.is_empty());

        // The bulk contract still reports a missing id, so batches stay informative.
        let bulk = bulk_delete_finds_blocking(storage_path, &[find_id], false, false)
            .expect("bulk delete with a stale id");
        assert_eq!(bulk.completed, 0);
        assert_eq!(bulk.operation_failures.len(), 1);
    }

    fn photo_row(photo_id: i64, find_id: i64, path: &str, is_primary: bool) -> PhotoRow {
        PhotoRow {
            photo_id,
            find_id,
            photo_path: path.to_string(),
            is_primary,
        }
    }

    #[test]
    fn prune_removes_rows_whose_files_are_confirmed_gone() {
        let rows = vec![
            photo_row(1, 10, "Boletus/primary.jpg", true),
            photo_row(2, 10, "Boletus/second.jpg", false),
            photo_row(3, 11, "Amanita/kept.jpg", true),
        ];

        let plan = plan_prune(&rows, |path| {
            if path.starts_with("Boletus") {
                PathState::Missing
            } else {
                PathState::File
            }
        });

        assert_eq!(plan.remove, vec![1, 2]);
        assert_eq!(plan.primaries_lost, vec![10], "find 10 lost its primary photo");
        assert!(plan.affected_finds.contains(&10));
        assert!(!plan.affected_finds.contains(&11));
        assert!(plan.blocked.is_empty());
    }

    /// An unplugged drive or a permissions problem makes every photo look missing to
    /// `Path::exists()`. Acting on that would delete the library's only record of photos
    /// that are perfectly fine, so one unreadable path stops the whole cleanup.
    #[test]
    fn prune_removes_nothing_when_a_path_cannot_be_read() {
        let rows = vec![
            photo_row(1, 10, "Boletus/gone.jpg", true),
            photo_row(2, 11, "OfflineDrive/unreadable.jpg", true),
        ];

        let plan = plan_prune(&rows, |path| {
            if path.starts_with("OfflineDrive") {
                PathState::Inaccessible
            } else {
                PathState::Missing
            }
        });

        assert!(
            plan.remove.is_empty(),
            "a cleanup that cannot see the disk must not forget any row"
        );
        assert!(plan.primaries_lost.is_empty());
        assert!(plan.affected_finds.is_empty());
        assert_eq!(plan.blocked.len(), 1);
        assert_eq!(plan.blocked[0].item, "OfflineDrive/unreadable.jpg");
    }

    #[test]
    fn prune_leaves_a_healthy_library_alone() {
        let rows = vec![photo_row(1, 10, "Boletus/here.jpg", true)];
        let plan = plan_prune(&rows, |_| PathState::File);
        assert!(plan.remove.is_empty());
        assert!(plan.blocked.is_empty());
    }

    #[test]
    fn deleting_a_find_whose_sample_folder_is_already_gone_warns_about_nothing() {
        let dir = tempfile::tempdir().expect("library");
        let storage_path = dir.path().to_str().expect("storage path");
        let find_id = {
            let conn = open_db(storage_path).expect("open library");
            let find_id = insert_find_row(&conn, &make_find_record("here.jpg", "2024-05-10"))
                .expect("insert find");
            conn.execute(
                "INSERT INTO samples (find_id, species_name, sample_year, sample_no, folder_path, spore_print, dna_sample, created_at, updated_at)
                 VALUES (?1, 'Boletus edulis', 2026, 1, 'Uzorci/Boletus edulis/2026-001', 0, 0, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
                params![find_id],
            )
            .expect("insert sample");
            find_id
        };

        // The folder was never created, so removing it has nothing to do.
        let result = delete_single_find_blocking(storage_path, find_id, true, true)
            .expect("delete the record");

        assert_eq!(result.completed, 1);
        assert!(
            result.file_failures.is_empty(),
            "a folder that is already gone is the requested outcome, not a leftover"
        );
    }

    #[test]
    fn a_removal_failure_is_only_real_while_the_path_is_still_there() {
        let dir = tempfile::tempdir().expect("tempdir");
        let present = dir.path().join("still-here.jpg");
        std::fs::write(&present, b"photo").expect("write");
        assert!(removal_failure_is_real(&present));

        // The path disappearing between the check and the attempt is the outcome the
        // caller wanted, so it is not reported.
        let vanished = dir.path().join("vanished.jpg");
        assert!(!removal_failure_is_real(&vanished));
    }

    /// Drives the real cleanup, not just its decision step: the row goes, the surviving
    /// photo is promoted to primary, and a backup is written first.
    #[test]
    fn prune_removes_the_row_promotes_a_new_primary_and_backs_up_first() {
        let dir = tempfile::tempdir().expect("library");
        let storage_path = dir.path().to_str().expect("storage path");
        let folder = dir.path().join("Boletus_edulis");
        std::fs::create_dir_all(&folder).expect("species folder");
        std::fs::write(folder.join("kept.jpg"), b"kept").expect("surviving photo");
        let (find_id, gone_id, kept_id) = {
            let conn = open_db(storage_path).expect("open library");
            let find_id = insert_find_row(&conn, &make_find_record("gone.jpg", "2024-05-10"))
                .expect("insert find");
            let gone_id = insert_find_photo(&conn, find_id, "Boletus_edulis/gone.jpg", true)
                .expect("primary photo whose file is gone");
            let kept_id = insert_find_photo(&conn, find_id, "Boletus_edulis/kept.jpg", false)
                .expect("secondary photo still on disk");
            (find_id, gone_id, kept_id)
        };

        let summary = prune_missing_photos_blocking(storage_path).expect("prune");

        assert_eq!(summary.removed, 1);
        assert_eq!(summary.affected_finds, 1);
        assert!(summary.blocked.is_empty());
        assert!(summary.backup_path.is_some(), "a destructive cleanup backs up first");

        let conn = open_db(storage_path).expect("reopen library");
        let remaining: Vec<(i64, bool)> = conn
            .prepare("SELECT id, is_primary FROM find_photos WHERE find_id = ?1")
            .unwrap()
            .query_map(params![find_id], |row| {
                Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)? == 1))
            })
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();
        assert_eq!(remaining, vec![(kept_id, true)], "the survivor becomes primary");
        assert_ne!(gone_id, kept_id);
    }

    /// A photo row that now points at a folder is not a missing photo, and deleting its
    /// row would lose the only record of it. One such path stops the whole cleanup.
    #[test]
    fn prune_stops_when_a_photo_path_is_a_folder() {
        let dir = tempfile::tempdir().expect("library");
        let storage_path = dir.path().to_str().expect("storage path");
        std::fs::create_dir_all(dir.path().join("Boletus_edulis/looks_like.jpg"))
            .expect("a folder where a photo should be");
        {
            let conn = open_db(storage_path).expect("open library");
            let find_id = insert_find_row(&conn, &make_find_record("looks_like.jpg", "2024-05-10"))
                .expect("insert find");
            insert_find_photo(&conn, find_id, "Boletus_edulis/looks_like.jpg", true).unwrap();
            insert_find_photo(&conn, find_id, "Boletus_edulis/really_gone.jpg", false).unwrap();
        }

        let summary = prune_missing_photos_blocking(storage_path).expect("prune");

        assert_eq!(summary.removed, 0, "not even the genuinely missing row goes");
        assert_eq!(summary.blocked.len(), 1);
        assert_eq!(summary.blocked[0].item, "Boletus_edulis/looks_like.jpg");
        let conn = open_db(storage_path).expect("reopen library");
        let rows: i64 = conn
            .query_row("SELECT COUNT(*) FROM find_photos", [], |row| row.get(0))
            .unwrap();
        assert_eq!(rows, 2, "the database is untouched");
    }

    /// The removals and the primary promotion share one transaction. A failure part way
    /// through must leave every row where it was, not half a cleanup.
    #[test]
    fn prune_rolls_back_every_row_when_one_delete_fails() {
        let dir = tempfile::tempdir().expect("library");
        let storage_path = dir.path().to_str().expect("storage path");
        let second_id = {
            let conn = open_db(storage_path).expect("open library");
            let find_id = insert_find_row(&conn, &make_find_record("gone.jpg", "2024-05-10"))
                .expect("insert find");
            insert_find_photo(&conn, find_id, "Boletus_edulis/first_gone.jpg", true).unwrap();
            let second_id =
                insert_find_photo(&conn, find_id, "Boletus_edulis/second_gone.jpg", false).unwrap();
            // Make the second delete fail the way a constraint or a corrupt index would.
            conn.execute_batch(&format!(
                "CREATE TRIGGER block_second_delete BEFORE DELETE ON find_photos
                 WHEN OLD.id = {second_id}
                 BEGIN SELECT RAISE(ABORT, 'blocked'); END;"
            ))
            .expect("install trigger");
            second_id
        };

        let error = prune_missing_photos_blocking(storage_path)
            .expect_err("the blocked delete fails the cleanup");
        assert!(error.contains("delete failed"), "unexpected error: {error}");

        let conn = open_db(storage_path).expect("reopen library");
        let rows: i64 = conn
            .query_row("SELECT COUNT(*) FROM find_photos", [], |row| row.get(0))
            .unwrap();
        assert_eq!(rows, 2, "the first delete is rolled back with the second");
        let still_there: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM find_photos WHERE id = ?1",
                params![second_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(still_there, 1);
    }

    #[test]
    fn a_photo_row_pointing_at_a_folder_is_never_sent_to_the_recycle_bin() {
        let dir = tempfile::tempdir().expect("library");
        let storage_path = dir.path().to_str().expect("storage path");
        let folder_as_photo = dir.path().join("Boletus_edulis/album.jpg");
        std::fs::create_dir_all(&folder_as_photo).expect("folder standing in for a photo");
        std::fs::write(folder_as_photo.join("inside.jpg"), b"someone's photos").expect("content");
        let find_id = {
            let conn = open_db(storage_path).expect("open library");
            let find_id = insert_find_row(&conn, &make_find_record("album.jpg", "2024-05-10"))
                .expect("insert find");
            insert_find_photo(&conn, find_id, "Boletus_edulis/album.jpg", true).unwrap();
            find_id
        };

        let result = delete_single_find_blocking(storage_path, find_id, true, false)
            .expect("the record still goes");

        assert_eq!(result.completed, 1);
        assert_eq!(result.file_failures.len(), 1, "the caller hears it was left alone");
        assert!(
            folder_as_photo.join("inside.jpg").exists(),
            "a folder must never be trashed because a photo row pointed at it"
        );
    }

    #[test]
    fn bulk_delete_of_an_empty_selection_touches_nothing() {
        let dir = tempfile::tempdir().expect("tempdir");
        let storage_path = dir.path().to_str().expect("storage path");
        {
            let conn = open_db(storage_path).expect("open library");
            insert_find_row(&conn, &make_find_record("keep.jpg", "2024-05-10")).expect("insert");
        }

        let result = bulk_delete_finds_blocking(storage_path, &[], true, true)
            .expect("empty selection is fine");
        assert_eq!(result, BulkOperationResult::default());

        let conn = open_db(storage_path).expect("reopen library");
        let remaining: i64 = conn
            .query_row("SELECT COUNT(*) FROM finds", [], |row| row.get(0))
            .expect("count finds");
        assert_eq!(remaining, 1);
    }

    /// A missing id must not take the rest of the batch down with it: the transaction
    /// still commits the finds that do exist.
    #[test]
    fn bulk_delete_tolerates_ids_that_are_already_gone() {
        let dir = tempfile::tempdir().expect("tempdir");
        let storage_path = dir.path().to_str().expect("storage path");
        let existing = {
            let conn = open_db(storage_path).expect("open library");
            insert_find_row(&conn, &make_find_record("here.jpg", "2024-05-10")).expect("insert")
        };

        let result = bulk_delete_finds_blocking(storage_path, &[existing, 9_999], false, false)
            .expect("bulk delete with a stale id");
        assert_eq!(result.requested, 2);
        assert_eq!(result.completed, 1);
        assert_eq!(result.operation_failures.len(), 1);
        assert_eq!(result.operation_failures[0].item, "9999");

        let conn = open_db(storage_path).expect("reopen library");
        let remaining: i64 = conn
            .query_row("SELECT COUNT(*) FROM finds", [], |row| row.get(0))
            .expect("count finds");
        assert_eq!(remaining, 0);
    }

    #[test]
    fn bulk_delete_does_not_report_a_photo_that_was_already_off_the_disk() {
        let dir = tempfile::tempdir().expect("tempdir");
        let storage_path = dir.path().to_str().expect("storage path");
        let find_id = {
            let conn = open_db(storage_path).expect("open library");
            let find_id = insert_find_row(&conn, &make_find_record("gone.jpg", "2024-05-10"))
                .expect("insert find");
            // Row points at a file somebody removed outside the app.
            insert_find_photo(&conn, find_id, "Boletus_edulis/gone.jpg", true)
                .expect("insert missing photo row");
            find_id
        };

        let result = bulk_delete_finds_blocking(storage_path, &[find_id], true, false)
            .expect("database delete still succeeds");

        assert_eq!(result.completed, 1);
        assert!(
            result.file_failures.is_empty(),
            "a file that is already gone is not something left behind, so warning about it \
             would send the user looking for a photo that does not exist"
        );
    }

    #[test]
    fn bulk_move_reports_the_failed_find_and_stops_before_the_rest() {
        let dir = tempfile::tempdir().expect("tempdir");
        let destination = tempfile::tempdir().expect("destination");
        let storage_path = dir.path().to_str().expect("storage path");
        let ids: Vec<i64> = {
            let conn = open_db(storage_path).expect("open library");
            (0..2)
                .map(|index| {
                    let id = insert_find_row(
                        &conn,
                        &make_find_record(&format!("missing-{index}.jpg"), "2024-05-10"),
                    )
                    .expect("insert find");
                    insert_find_photo(
                        &conn,
                        id,
                        &format!("Boletus_edulis/missing-{index}.jpg"),
                        true,
                    )
                    .expect("insert missing photo row");
                    id
                })
                .collect()
        };

        let result = bulk_move_finds_to_folder_blocking(
            storage_path,
            &ids,
            destination.path().to_str().expect("destination path"),
        )
        .expect("structured partial result");

        assert_eq!(result.requested, 2);
        assert_eq!(result.completed, 0);
        assert_eq!(result.operation_failures.len(), 1);
        assert_eq!(result.operation_failures[0].item, ids[0].to_string());
        let conn = open_db(storage_path).expect("reopen library");
        let remaining: i64 = conn
            .query_row("SELECT COUNT(*) FROM finds", [], |row| row.get(0))
            .expect("count untouched finds");
        assert_eq!(remaining, 2, "the failed and unattempted finds stay registered");
    }

    #[test]
    fn bulk_move_never_overwrites_an_existing_same_named_file() {
        let dir = tempfile::tempdir().expect("library");
        let destination = tempfile::tempdir().expect("destination");
        let storage_path = dir.path().to_str().expect("storage path");
        let source_folder = dir.path().join("Boletus_edulis");
        std::fs::create_dir_all(&source_folder).expect("source folder");
        std::fs::write(source_folder.join("same.jpg"), b"new photo").expect("source photo");
        std::fs::write(destination.path().join("same.jpg"), b"keep me").expect("existing photo");
        let find_id = {
            let conn = open_db(storage_path).expect("open library");
            let id = insert_find_row(&conn, &make_find_record("same.jpg", "2024-05-10"))
                .expect("insert find");
            insert_find_photo(&conn, id, "Boletus_edulis/same.jpg", true)
                .expect("insert photo");
            id
        };

        let result = bulk_move_finds_to_folder_blocking(
            storage_path,
            &[find_id],
            destination.path().to_str().expect("destination path"),
        )
        .expect("move find");

        assert_eq!(result.completed, 1);
        assert_eq!(std::fs::read(destination.path().join("same.jpg")).unwrap(), b"keep me");
        assert_eq!(
            std::fs::read(destination.path().join("same (2).jpg")).unwrap(),
            b"new photo"
        );
        let conn = open_db(storage_path).expect("reopen library");
        let remaining: i64 = conn.query_row("SELECT COUNT(*) FROM finds", [], |row| row.get(0)).unwrap();
        assert_eq!(remaining, 0);
    }

    #[test]
    fn bulk_move_preflight_keeps_every_source_when_any_photo_is_missing() {
        let dir = tempfile::tempdir().expect("library");
        let destination = tempfile::tempdir().expect("destination");
        let storage_path = dir.path().to_str().expect("storage path");
        let source_folder = dir.path().join("Boletus_edulis");
        std::fs::create_dir_all(&source_folder).expect("source folder");
        let existing = source_folder.join("first.jpg");
        std::fs::write(&existing, b"first").expect("source photo");
        let find_id = {
            let conn = open_db(storage_path).expect("open library");
            let id = insert_find_row(&conn, &make_find_record("first.jpg", "2024-05-10"))
                .expect("insert find");
            insert_find_photo(&conn, id, "Boletus_edulis/first.jpg", true).unwrap();
            insert_find_photo(&conn, id, "Boletus_edulis/missing.jpg", false).unwrap();
            id
        };

        let result = bulk_move_finds_to_folder_blocking(
            storage_path,
            &[find_id],
            destination.path().to_str().expect("destination path"),
        )
        .expect("structured failure");

        assert_eq!(result.completed, 0);
        assert_eq!(result.operation_failures.len(), 1);
        assert!(existing.exists(), "preflight must fail before moving the first photo");
        assert_eq!(std::fs::read_dir(destination.path()).unwrap().count(), 0);
        let conn = open_db(storage_path).expect("reopen library");
        let remaining: i64 = conn.query_row("SELECT COUNT(*) FROM finds", [], |row| row.get(0)).unwrap();
        assert_eq!(remaining, 1);
    }

    /// Renaming a species folder moves every photo on disk and rewrites the rows that
    /// name the old species. The move used to run inside the SQLite transaction, so a
    /// folder of hundreds of photos held the write lock for the whole copy.
    #[test]
    fn bulk_rename_moves_photos_and_rewrites_every_reference() {
        let dir = tempfile::tempdir().expect("tempdir");
        let storage_path = dir.path().to_str().expect("storage path").to_string();
        let old_species = "Boletus edulis";
        let new_species = "Boletus reticulatus";

        let old_folder = Path::new(&storage_path).join(resolve_location_component(
            &plain_species_name(old_species),
            "unknown_species",
        ));
        std::fs::create_dir_all(&old_folder).expect("create the old species folder");
        std::fs::write(old_folder.join("shroom.jpg"), b"photo bytes").expect("write a photo");

        let find_id;
        {
            let conn = open_db(&storage_path).expect("open library");
            let mut record = make_find_record("shroom.jpg", "2024-05-10");
            record.species_name = old_species.to_string();
            find_id = insert_find_row(&conn, &record).expect("insert find");
            let relative = format!(
                "{}/shroom.jpg",
                old_folder
                    .file_name()
                    .and_then(|name| name.to_str())
                    .expect("old folder name")
            );
            insert_find_photo(&conn, find_id, &relative, true).expect("insert photo row");
            conn.execute(
                "INSERT INTO species_notes (species_name, notes, updated_at) VALUES (?1, ?2, ?3)",
                params![old_species, "sjeverna padina", "2024-05-10T00:00:00Z"],
            )
            .expect("insert species note");
        }

        bulk_rename_species_blocking(&storage_path, &[find_id], new_species).expect("rename");

        let conn = open_db(&storage_path).expect("reopen library");
        let species: String = conn
            .query_row(
                "SELECT species_name FROM finds WHERE id = ?1",
                params![find_id],
                |row| row.get(0),
            )
            .expect("read renamed find");
        assert_eq!(species, new_species);

        let photo_path: String = conn
            .query_row(
                "SELECT photo_path FROM find_photos WHERE find_id = ?1",
                params![find_id],
                |row| row.get(0),
            )
            .expect("read photo path");
        let new_folder_name = Path::new(&storage_path)
            .join(resolve_location_component(
                &plain_species_name(new_species),
                "unknown_species",
            ))
            .file_name()
            .and_then(|name| name.to_str())
            .expect("new folder name")
            .to_string();
        assert!(
            photo_path.starts_with(&new_folder_name),
            "photo path must point at the new folder, got {photo_path}"
        );
        assert!(
            Path::new(&storage_path).join(photo_path.replace('/', std::path::MAIN_SEPARATOR_STR)).exists(),
            "the photo file must actually be where the database now says it is"
        );

        let renamed_notes: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM species_notes WHERE species_name = ?1",
                params![new_species],
                |row| row.get(0),
            )
            .expect("count renamed notes");
        assert_eq!(renamed_notes, 1, "species notes follow the rename");
    }

    /// Renaming part of a species must leave the rest of it alone: its finds, the photo
    /// files on disk, and the zones, notes and profile that still describe it.
    #[test]
    fn partial_rename_leaves_the_remaining_finds_and_their_metadata_untouched() {
        let dir = tempfile::tempdir().expect("tempdir");
        let storage_path = dir.path().to_str().expect("storage path").to_string();
        let old_species = "Boletus edulis";
        let new_species = "Boletus reticulatus";

        let old_folder = Path::new(&storage_path).join(resolve_location_component(
            &plain_species_name(old_species),
            "unknown_species",
        ));
        std::fs::create_dir_all(&old_folder).expect("create species folder");
        let old_folder_name = old_folder
            .file_name()
            .and_then(|name| name.to_str())
            .expect("folder name")
            .to_string();
        std::fs::write(old_folder.join("moved.jpg"), b"a").expect("write photo");
        std::fs::write(old_folder.join("stays.jpg"), b"b").expect("write photo");

        let (moved_id, stays_id);
        {
            let conn = open_db(&storage_path).expect("open library");
            let mut record = make_find_record("moved.jpg", "2024-05-10");
            record.species_name = old_species.to_string();
            moved_id = insert_find_row(&conn, &record).expect("insert find");
            insert_find_photo(&conn, moved_id, &format!("{old_folder_name}/moved.jpg"), true)
                .expect("insert photo");

            let mut other = make_find_record("stays.jpg", "2024-05-11");
            other.species_name = old_species.to_string();
            stays_id = insert_find_row(&conn, &other).expect("insert find");
            insert_find_photo(&conn, stays_id, &format!("{old_folder_name}/stays.jpg"), true)
                .expect("insert photo");

            conn.execute(
                "INSERT INTO species_notes (species_name, notes, updated_at) VALUES (?1, ?2, ?3)",
                params![old_species, "sjeverna padina", "2024-05-10T00:00:00Z"],
            )
            .expect("insert species note");
        }

        bulk_rename_species_blocking(&storage_path, &[moved_id], new_species)
            .expect("rename only one of the two finds");

        let conn = open_db(&storage_path).expect("reopen library");

        let stayed_species: String = conn
            .query_row(
                "SELECT species_name FROM finds WHERE id = ?1",
                params![stays_id],
                |row| row.get(0),
            )
            .expect("read the untouched find");
        assert_eq!(
            stayed_species, old_species,
            "a find that was not selected keeps its species"
        );

        let stayed_photo: String = conn
            .query_row(
                "SELECT photo_path FROM find_photos WHERE find_id = ?1",
                params![stays_id],
                |row| row.get(0),
            )
            .expect("read the untouched photo row");
        assert!(
            Path::new(&storage_path)
                .join(stayed_photo.replace('/', std::path::MAIN_SEPARATOR_STR))
                .exists(),
            "the untouched find's photo must still be where its row says: {stayed_photo}"
        );

        let notes_left_behind: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM species_notes WHERE species_name = ?1",
                params![old_species],
                |row| row.get(0),
            )
            .expect("count notes on the old species");
        assert_eq!(
            notes_left_behind, 1,
            "species notes belong to the species that still has finds, not to the ones that left"
        );

        // And the find that did move is where it should be.
        let moved_photo: String = conn
            .query_row(
                "SELECT photo_path FROM find_photos WHERE find_id = ?1",
                params![moved_id],
                |row| row.get(0),
            )
            .expect("read the moved photo row");
        assert!(
            Path::new(&storage_path)
                .join(moved_photo.replace('/', std::path::MAIN_SEPARATOR_STR))
                .exists(),
            "the moved find's photo must exist at its new path: {moved_photo}"
        );
        assert_ne!(moved_photo, format!("{old_folder_name}/moved.jpg"));
    }

    #[test]
    fn partial_rename_does_not_attach_a_missing_photo_to_a_same_named_target_file() {
        let dir = tempfile::tempdir().expect("tempdir");
        let storage_path = dir.path().to_str().expect("storage path").to_string();
        let old_species = "Boletus edulis";
        let new_species = "Boletus reticulatus";
        let old_folder = Path::new(&storage_path).join(resolve_location_component(
            &plain_species_name(old_species),
            "unknown_species",
        ));
        let target_folder = Path::new(&storage_path).join(resolve_location_component(
            &plain_species_name(new_species),
            "unknown_species",
        ));
        std::fs::create_dir_all(&old_folder).unwrap();
        std::fs::create_dir_all(&target_folder).unwrap();
        std::fs::write(old_folder.join("stays.jpg"), b"stays").unwrap();
        std::fs::write(target_folder.join("missing.jpg"), b"somebody else").unwrap();
        let old_folder_name = old_folder.file_name().unwrap().to_string_lossy();
        let (moved_id, original_missing_path) = {
            let conn = open_db(&storage_path).expect("open library");
            let mut moved = make_find_record("missing.jpg", "2024-05-10");
            moved.species_name = old_species.to_string();
            let moved_id = insert_find_row(&conn, &moved).unwrap();
            let missing = format!("{old_folder_name}/missing.jpg");
            insert_find_photo(&conn, moved_id, &missing, true).unwrap();
            let mut stays = make_find_record("stays.jpg", "2024-05-11");
            stays.species_name = old_species.to_string();
            let stays_id = insert_find_row(&conn, &stays).unwrap();
            insert_find_photo(&conn, stays_id, &format!("{old_folder_name}/stays.jpg"), true).unwrap();
            (moved_id, missing)
        };

        bulk_rename_species_blocking(&storage_path, &[moved_id], new_species)
            .expect("rename with stale photo path");

        let conn = open_db(&storage_path).expect("reopen library");
        let stored_path: String = conn
            .query_row(
                "SELECT photo_path FROM find_photos WHERE find_id = ?1",
                params![moved_id],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(stored_path, original_missing_path);
        assert_eq!(std::fs::read(target_folder.join("missing.jpg")).unwrap(), b"somebody else");
    }

    #[test]
    fn bulk_rename_refuses_an_empty_name_and_ignores_an_empty_selection() {
        let dir = tempfile::tempdir().expect("tempdir");
        let storage_path = dir.path().to_str().expect("storage path");
        open_db(storage_path).expect("create library");

        assert!(bulk_rename_species_blocking(storage_path, &[], "Anything").is_ok());
        assert!(bulk_rename_species_blocking(storage_path, &[1], "   ").is_err());
    }

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
            weather: None,
            determiner: None,
            finder: None,
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
            weather: None,
            determiner: None,
            finder: None,
            photo_count: Some(0),
            photos: vec![],
        };
        let new_id = insert_find_row(conn, &record).map_err(|e| e.to_string())?;
        let mut inserted = conn
            .query_row(
                "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note, weather, determiner, finder FROM finds WHERE id = ?1",
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
                "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note, weather, determiner, finder FROM finds WHERE id = ?1",
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
                "SELECT id, original_filename, species_name, date_found, country, region, lat, lng, notes, location_note, observed_count, observed_count_min, observed_count_max, is_favorite, created_at, edibility_note, weather, determiner, finder FROM finds WHERE id = ?1",
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

    /// A find dialog only owns the common name and description. Saving one must not
    /// disturb tags, cover, edibility, threat status, distribution or habitat, which
    /// belong to the species editor.
    #[test]
    fn patching_a_species_profile_leaves_untouched_fields_alone() {
        let conn = setup_in_memory_db();
        conn.execute(
            "INSERT INTO species_profiles (species_name, common_name, cover_photo_id, tags_json, edibility, threat_status, distribution, description, habitat, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                "Boletus edulis",
                "Vrganj",
                42i64,
                r#"["jestivo","cesto"]"#,
                "edible",
                "least_concern",
                "common",
                "Stari opis",
                "Hrastova suma",
                "2026-05-12T00:00:00Z"
            ],
        )
        .expect("insert full species profile");

        patch_species_profile_on_connection(
            &conn,
            "Boletus edulis",
            &SpeciesProfilePatch {
                common_name: Some("Pravi vrganj".to_string()),
                ..Default::default()
            },
        )
        .expect("patch only the common name");

        let profile = get_species_profile_for_connection(&conn, "Boletus edulis")
            .expect("read profile")
            .expect("profile exists");
        assert_eq!(profile.common_name.as_deref(), Some("Pravi vrganj"));
        assert_eq!(profile.cover_photo_id, Some(42));
        assert_eq!(
            profile.tags,
            vec!["jestivo".to_string(), "cesto".to_string()]
        );
        assert_eq!(profile.edibility.as_deref(), Some("edible"));
        assert_eq!(profile.threat_status.as_deref(), Some("least_concern"));
        assert_eq!(profile.distribution.as_deref(), Some("common"));
        assert_eq!(profile.description.as_deref(), Some("Stari opis"));
        assert_eq!(profile.habitat.as_deref(), Some("Hrastova suma"));
    }

    #[test]
    fn patching_an_unknown_species_creates_the_profile() {
        let conn = setup_in_memory_db();

        patch_species_profile_on_connection(
            &conn,
            "Cantharellus cibarius",
            &SpeciesProfilePatch {
                common_name: Some("Lisicarka".to_string()),
                description: Some("Zuta, mirisna".to_string()),
                ..Default::default()
            },
        )
        .expect("patch a species with no profile row");

        let profile = get_species_profile_for_connection(&conn, "Cantharellus cibarius")
            .expect("read profile")
            .expect("profile was created");
        assert_eq!(profile.common_name.as_deref(), Some("Lisicarka"));
        assert_eq!(profile.description.as_deref(), Some("Zuta, mirisna"));
        assert_eq!(profile.cover_photo_id, None);
        assert!(profile.tags.is_empty());
    }

    #[test]
    fn an_empty_species_profile_patch_writes_nothing() {
        let conn = setup_in_memory_db();

        patch_species_profile_on_connection(&conn, "Amanita muscaria", &SpeciesProfilePatch::default())
            .expect("empty patch is a no-op");

        assert!(
            get_species_profile_for_connection(&conn, "Amanita muscaria")
                .expect("read profile")
                .is_none(),
            "an empty patch must not create a bare profile row"
        );
    }

    /// The dialogs overwrite the profile with whatever this lookup returns, so a miss
    /// caused only by casing or stray whitespace would blank out tags, cover and
    /// edibility on the next save.
    #[test]
    fn species_profile_lookup_tolerates_casing_and_whitespace() {
        let conn = setup_in_memory_db();
        conn.execute(
            "INSERT INTO species_profiles (species_name, common_name, tags_json, updated_at)
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![
                "Boletus edulis",
                "Vrganj",
                r#"["jestivo"]"#,
                "2026-05-12T00:00:00Z"
            ],
        )
        .expect("insert species profile");

        for lookup in ["Boletus edulis", "boletus edulis", "  BOLETUS EDULIS  "] {
            let profile = get_species_profile_for_connection(&conn, lookup)
                .expect("look up species profile")
                .unwrap_or_else(|| panic!("profile must be found for {lookup:?}"));
            assert_eq!(profile.species_name, "Boletus edulis");
            assert_eq!(profile.tags, vec!["jestivo".to_string()]);
        }

        assert!(
            get_species_profile_for_connection(&conn, "Cantharellus cibarius")
                .expect("look up unknown species")
                .is_none(),
            "an unknown species must still return None so a new profile can be created"
        );
    }

    #[test]
    fn species_profile_summaries_include_searchable_names_with_safe_fallbacks() {
        let conn = setup_in_memory_db();
        conn.execute(
            "INSERT INTO species_profiles
             (species_name, common_name, tags_json, synonyms, other_names, description, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            rusqlite::params![
                "Boletus edulis", "Jestivi vrganj", r#"["jestivo"]"#,
                r#"["Boletus bulbosus","Boletus solidus"]"#,
                r#"["Pravi vrganj","Penny bun"]"#,
                "Large full-profile description that the summary query must not select",
                "2026-08-21T00:00:00Z",
            ],
        )
        .expect("insert aliased profile");
        conn.execute(
            "INSERT INTO species_profiles
             (species_name, tags_json, synonyms, other_names, updated_at)
             VALUES (?1, ?2, NULL, ?3, ?4)",
            rusqlite::params!["Cantharellus cibarius", "[]", "not-json", "2026-08-21T00:00:00Z"],
        )
        .expect("insert legacy profile");

        let summaries = get_species_profile_summaries_for_connection(&conn)
            .expect("load lightweight profile summaries");
        assert_eq!(summaries.len(), 2);
        let boletus = summaries
            .iter()
            .find(|summary| summary.species_name == "Boletus edulis")
            .expect("Boletus summary");
        assert_eq!(boletus.common_name.as_deref(), Some("Jestivi vrganj"));
        assert_eq!(boletus.synonyms, vec!["Boletus bulbosus", "Boletus solidus"]);
        assert_eq!(boletus.other_names, vec!["Pravi vrganj", "Penny bun"]);
        let legacy = summaries
            .iter()
            .find(|summary| summary.species_name == "Cantharellus cibarius")
            .expect("legacy summary");
        assert!(legacy.synonyms.is_empty(), "NULL aliases decode as an empty array");
        assert!(legacy.other_names.is_empty(), "invalid legacy JSON cannot break the list");
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
