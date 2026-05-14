mod commands;

pub fn run() {
    let mut builder = tauri::Builder::default()
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
            commands::finds::get_species_profiles,
            commands::finds::get_species_recipes,
            commands::finds::upsert_species_note,
            commands::finds::upsert_species_profile,
            commands::finds::upsert_species_recipe,
            commands::finds::delete_species_recipe,
            commands::finds::trash_source_file,
            commands::finds::quit_app,
            commands::finds::bulk_rename_species,
            commands::finds::set_find_favorite,
            commands::finds::move_find_files,
            commands::finds::open_find_folder,
            commands::finds::open_species_folder,
            commands::finds::cleanup_internal_records,
            commands::finds::add_find_photos,
            commands::finds::delete_find_photo,
            commands::finds::bulk_delete_find_photos,
            commands::finds::prune_missing_photos,
            commands::finds::create_find,
            commands::tile_proxy::fetch_tile,
            commands::tile_proxy::get_tile_cache_stats,
            commands::tile_proxy::clear_tile_cache,
            commands::tile_proxy::set_cache_max,
            commands::tile_proxy::get_cache_max_bytes,
            commands::zones::get_zones,
            commands::zones::upsert_zone,
            commands::zones::delete_zone,
            commands::stats::get_stats_cards,
            commands::stats::get_top_spots,
            commands::stats::get_best_months,
            commands::stats::get_calendar,
            commands::stats::get_species_stats,
            commands::stats::read_photos_as_base64,
            commands::updater::check_app_update,
            commands::updater::install_app_update,
        ]);

    if let Some(pubkey) = option_env!("TAURI_UPDATER_PUBLIC_KEY") {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().pubkey(pubkey).build());
    }

    builder
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
        assert_eq!(version, 21, "user_version must be 21 after all migrations");

        let edibility_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('species_profiles') WHERE name = 'edibility'",
                [],
                |r| r.get(0),
            )
            .expect("query species_profiles.edibility");
        assert_eq!(edibility_exists, 1, "species_profiles.edibility must exist after open_db");

        let protected_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('species_profiles') WHERE name = 'protected_status'",
                [],
                |r| r.get(0),
            )
            .expect("query species_profiles.protected_status");
        assert_eq!(protected_exists, 1, "species_profiles.protected_status must exist after open_db");

        let synonyms_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('species_profiles') WHERE name = 'synonyms'",
                [],
                |r| r.get(0),
            )
            .expect("query species_profiles.synonyms");
        assert_eq!(synonyms_exists, 1, "species_profiles.synonyms must exist after open_db");

        let other_names_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('species_profiles') WHERE name = 'other_names'",
                [],
                |r| r.get(0),
            )
            .expect("query species_profiles.other_names");
        assert_eq!(other_names_exists, 1, "species_profiles.other_names must exist after open_db");

        let description_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('species_profiles') WHERE name = 'description'",
                [],
                |r| r.get(0),
            )
            .expect("query species_profiles.description");
        assert_eq!(description_exists, 1, "species_profiles.description must exist after open_db");

        let recipes_exists: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='species_recipes'",
                [],
                |r| r.get(0),
            )
            .expect("query species_recipes");
        assert_eq!(recipes_exists, 1, "species_recipes table must exist after open_db");
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
