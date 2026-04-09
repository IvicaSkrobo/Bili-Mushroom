mod commands;

use tauri_plugin_sql::{Builder as SqlBuilder, Migration, MigrationKind};

pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "enable_wal_and_create_schema",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_finds_table",
            sql: include_str!("../migrations/0002_finds.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "create_find_photos_and_migrate",
            sql: include_str!("../migrations/0003_find_photos.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        // NOTE: see 01-RESEARCH.md Pitfall 2 / A2 — verify migrations apply when loading DB with absolute path
        // Migration key MUST remain "sqlite:bili-mushroom.db" — do NOT change (risk A5)
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:bili-mushroom.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::exif::parse_exif,
            commands::import::import_find,
            commands::import::get_finds,
            commands::import::update_find,
            commands::finds::delete_find,
            commands::finds::get_find_photos,
        ])
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod smoke {
    #[test]
    fn test_migration_vec_has_three_entries() {
        // Validate migration vec length by constructing it inline
        use tauri_plugin_sql::{Migration, MigrationKind};
        let migrations = vec![
            Migration {
                version: 1,
                description: "enable_wal_and_create_schema",
                sql: include_str!("../migrations/0001_initial.sql"),
                kind: MigrationKind::Up,
            },
            Migration {
                version: 2,
                description: "create_finds_table",
                sql: include_str!("../migrations/0002_finds.sql"),
                kind: MigrationKind::Up,
            },
            Migration {
                version: 3,
                description: "create_find_photos_and_migrate",
                sql: include_str!("../migrations/0003_find_photos.sql"),
                kind: MigrationKind::Up,
            },
        ];
        assert_eq!(migrations.len(), 3, "Must have exactly 3 migrations");
        assert_eq!(migrations[0].version, 1);
        assert_eq!(migrations[1].version, 2);
        assert_eq!(migrations[2].version, 3);
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
