use serde_json::Value;
use std::path::Path;
use std::process::Command;
use tauri::Manager;

#[derive(Debug, Default, serde::Serialize, PartialEq)]
pub struct LibraryStorageStats {
    pub database_bytes: u64,
    pub thumbnail_cache_bytes: u64,
    pub thumbnail_count: u64,
    pub backup_bytes: u64,
    pub backup_count: u64,
}

fn directory_usage(path: &Path) -> (u64, u64) {
    let Ok(entries) = std::fs::read_dir(path) else {
        return (0, 0);
    };

    entries.flatten().fold((0, 0), |(bytes, count), entry| {
        let Ok(file_type) = entry.file_type() else {
            return (bytes, count);
        };
        if file_type.is_symlink() {
            return (bytes, count);
        }
        if file_type.is_dir() {
            let (child_bytes, child_count) = directory_usage(&entry.path());
            return (
                bytes.saturating_add(child_bytes),
                count.saturating_add(child_count),
            );
        }
        if file_type.is_file() {
            let file_bytes = entry.metadata().map(|metadata| metadata.len()).unwrap_or(0);
            return (bytes.saturating_add(file_bytes), count.saturating_add(1));
        }
        (bytes, count)
    })
}

fn library_storage_stats_inner(storage_path: &Path) -> LibraryStorageStats {
    let database_bytes = std::fs::metadata(storage_path.join("bili-mushroom.db"))
        .map(|metadata| metadata.len())
        .unwrap_or(0);
    let (thumbnail_cache_bytes, thumbnail_count) =
        directory_usage(&storage_path.join(".bili-cache").join("thumbnails"));
    let (backup_bytes, backup_count) = directory_usage(&storage_path.join(".bili-backups"));

    LibraryStorageStats {
        database_bytes,
        thumbnail_cache_bytes,
        thumbnail_count,
        backup_bytes,
        backup_count,
    }
}

#[tauri::command]
pub async fn get_library_storage_stats(
    storage_path: String,
) -> Result<LibraryStorageStats, String> {
    tauri::async_runtime::spawn_blocking(move || {
        Ok(library_storage_stats_inner(Path::new(&storage_path)))
    })
    .await
    .map_err(|error| format!("Storage statistics worker failed: {error}"))?
}

#[tauri::command]
pub async fn open_library_backups_folder(storage_path: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let backup_folder = Path::new(&storage_path).join(".bili-backups");
        std::fs::create_dir_all(&backup_folder)
            .map_err(|error| format!("Could not create backup folder: {error}"))?;

        #[cfg(target_os = "windows")]
        let mut command = {
            let mut command = Command::new("explorer");
            command.arg(&backup_folder);
            command
        };
        #[cfg(target_os = "macos")]
        let mut command = {
            let mut command = Command::new("open");
            command.arg(&backup_folder);
            command
        };
        #[cfg(all(unix, not(target_os = "macos")))]
        let mut command = {
            let mut command = Command::new("xdg-open");
            command.arg(&backup_folder);
            command
        };

        command
            .spawn()
            .map_err(|error| format!("Could not open backup folder: {error}"))?;
        Ok(())
    })
    .await
    .map_err(|error| format!("Open backup folder worker failed: {error}"))?
}

#[tauri::command]
pub async fn load_saved_storage_path(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let preferences_path = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Failed to resolve app config dir: {}", e))?
        .join("preferences.json");

    if !preferences_path.exists() {
        return Ok(None);
    }

    let raw = std::fs::read_to_string(&preferences_path).map_err(|e| {
        format!(
            "Failed to read preferences file '{}': {}",
            preferences_path.display(),
            e
        )
    })?;
    let json: Value = serde_json::from_str(&raw).map_err(|e| {
        format!(
            "Failed to parse preferences file '{}': {}",
            preferences_path.display(),
            e
        )
    })?;

    Ok(json
        .get("storageFolderPath")
        .and_then(|value| value.as_str())
        .map(str::to_string))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn library_storage_stats_keep_backups_and_thumbnails_separate() {
        let dir = tempfile::tempdir().expect("tempdir");
        std::fs::write(dir.path().join("bili-mushroom.db"), [0u8; 11]).expect("database");

        let thumbnails = dir.path().join(".bili-cache").join("thumbnails");
        std::fs::create_dir_all(thumbnails.join("nested")).expect("thumbnail folders");
        std::fs::write(thumbnails.join("one.jpg"), [0u8; 7]).expect("thumbnail one");
        std::fs::write(thumbnails.join("nested").join("two.jpg"), [0u8; 5]).expect("thumbnail two");

        let backups = dir.path().join(".bili-backups").join("migrations");
        std::fs::create_dir_all(&backups).expect("backup folder");
        std::fs::write(backups.join("backup.db"), [0u8; 13]).expect("backup");

        assert_eq!(
            library_storage_stats_inner(dir.path()),
            LibraryStorageStats {
                database_bytes: 11,
                thumbnail_cache_bytes: 12,
                thumbnail_count: 2,
                backup_bytes: 13,
                backup_count: 1,
            }
        );
    }

    #[test]
    fn library_storage_stats_tolerate_a_library_without_cache_folders() {
        let dir = tempfile::tempdir().expect("tempdir");
        assert_eq!(
            library_storage_stats_inner(dir.path()),
            LibraryStorageStats::default()
        );
    }
}
