mod commands;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            commands::exif::parse_exif,
            commands::import::import_find,
            commands::import::get_finds,
            commands::import::update_find,
            commands::finds::delete_find,
            commands::finds::get_find_photos,
            commands::finds::get_species_notes,
            commands::finds::upsert_species_note,
            commands::finds::trash_source_file,
            commands::finds::quit_app,
            commands::finds::bulk_rename_species,
        ])
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod smoke {
    #[test]
    fn test_migrate_db_creates_schema_on_fresh_db() {
        // Verify that open_db() on a fresh path applies all three migrations
        // and produces a usable finds + find_photos schema.
        let dir = tempfile::tempdir().expect("tempdir");
        let storage_path = dir.path().to_str().expect("path to str");
        let conn = crate::commands::import::open_db(storage_path).expect("open_db");

        let finds_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='finds'",
                [],
                |r| r.get(0),
            )
            .expect("query finds");
        assert_eq!(finds_exists, 1, "finds table must exist after open_db");

        let photos_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='find_photos'",
                [],
                |r| r.get(0),
            )
            .expect("query find_photos");
        assert_eq!(photos_exists, 1, "find_photos table must exist after open_db");

        let version: i64 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .expect("user_version");
        assert_eq!(version, 3, "user_version must be 3 after all migrations");
    }

    #[test]
    fn test_command_symbols_exist() {
        // Compile-time check: verify command symbols are reachable
        // If these lines compile, the mod declarations and function signatures are correct.
        let _parse_exif_exists: bool = {
            // parse_exif is an async fn, just check it's reachable
            let _ = crate::commands::exif::extract_exif;
            true
        };
        let _path_builder_exists: bool = {
            let _ = crate::commands::path_builder::sanitize_path_component;
            let _ = crate::commands::path_builder::build_dest_path;
            true
        };
        assert!(_parse_exif_exists);
        assert!(_path_builder_exists);
    }
}
