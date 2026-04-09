use rusqlite::params;

use crate::commands::import::{open_db, FindPhoto};

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
