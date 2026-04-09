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
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        // NOTE: see 01-RESEARCH.md Pitfall 2 / A2 — verify migrations apply when loading DB with absolute path
        .plugin(
            SqlBuilder::default()
                .add_migrations("sqlite:bili-mushroom.db", migrations)
                .build(),
        )
        .setup(|_app| Ok(()))
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
