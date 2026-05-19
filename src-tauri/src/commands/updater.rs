use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_updater::UpdaterExt;

#[derive(Serialize)]
pub struct AvailableUpdate {
    pub version: String,
    pub notes: Option<String>,
    pub pub_date: Option<String>,
}

#[derive(Clone, Serialize)]
pub struct UpdateProgress {
    pub downloaded: usize,
    pub total: Option<u64>,
    pub status: String,
}

#[tauri::command]
pub async fn check_app_update(app: AppHandle) -> Result<Option<AvailableUpdate>, String> {
    let current = app.package_info().version.to_string();

    println!("[updater] checking for updates — current: v{current}");

    let update = app
        .updater()
        .map_err(|err| {
            eprintln!("[updater] init error: {err}");
            format!("Failed to initialize updater: {err}")
        })?
        .check()
        .await
        .map_err(|err| {
            eprintln!("[updater] check error: {err}");
            format!("Failed to check for updates: {err}")
        })?;

    match &update {
        Some(u) => println!("[updater] update found: v{} (notes: {:?})", u.version, u.body),
        None => println!("[updater] no update — already on latest"),
    }

    Ok(update.map(|update| AvailableUpdate {
        version: update.version.to_string(),
        notes: update.body.clone(),
        pub_date: update.date.map(|date| date.to_string()),
    }))
}

#[tauri::command]
pub async fn install_app_update(app: AppHandle) -> Result<bool, String> {
    // NOTE: This function re-runs check() rather than reusing the Update object from
    // check_app_update. This is an architectural constraint: the Tauri `Update` type is
    // not `Send`, so it cannot be cached across IPC call boundaries or stored in shared
    // state. The trade-off is an extra network round-trip and a small race window between
    // the version shown in the UI and the version actually installed. A future mitigation
    // would be to combine check + download + install into a single command invoked directly
    // from the "Update" confirmation button.
    let Some(update) = app
        .updater()
        .map_err(|err| format!("Failed to initialize updater: {err}"))?
        .check()
        .await
        .map_err(|err| format!("Failed to check for updates: {err}"))?
    else {
        return Ok(false);
    };

    let app_clone = app.clone();
    let _ = app.emit("update-progress", UpdateProgress {
        downloaded: 0,
        total: None,
        status: "downloading".into(),
    });

    update
        .download_and_install(
            |downloaded, total| {
                let _ = app_clone.emit("update-progress", UpdateProgress {
                    downloaded,
                    total,
                    status: "downloading".into(),
                });
            },
            || {
                let _ = app_clone.emit("update-progress", UpdateProgress {
                    downloaded: 0,
                    total: None,
                    status: "installing".into(),
                });
            },
        )
        .await
        .map_err(|err| format!("Failed to install update: {err}"))?;

    Ok(true)
}
