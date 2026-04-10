use rusqlite::params;
use chrono::Utc;

use crate::commands::import::{open_db, FindPhoto};

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct SpeciesNote {
    pub species_name: String,
    pub notes: String,
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
    let mut conn = open_db(&storage_path)?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for find_id in &find_ids {
        tx.execute(
            "UPDATE finds SET species_name = ?1 WHERE id = ?2",
            params![new_species_name, find_id],
        )
        .map_err(|e| format!("Bulk rename failed for id {}: {}", find_id, e))?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::import::test_helpers::{setup_in_memory_db, make_find_record};
    use crate::commands::import::{insert_find_photo, insert_find_row};

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
}
