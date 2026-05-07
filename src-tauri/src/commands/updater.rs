use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

#[derive(Serialize)]
pub struct AvailableUpdate {
    pub version: String,
    pub notes: Option<String>,
    pub pub_date: Option<String>,
}

fn updater_enabled() -> bool {
    option_env!("TAURI_UPDATER_PUBLIC_KEY").is_some()
}

#[tauri::command]
pub async fn check_app_update(app: AppHandle) -> Result<Option<AvailableUpdate>, String> {
    if !updater_enabled() {
        return Ok(None);
    }

    let update = app
        .updater()
        .map_err(|err| format!("Failed to initialize updater: {err}"))?
        .check()
        .await
        .map_err(|err| format!("Failed to check for updates: {err}"))?;

    Ok(update.map(|update| AvailableUpdate {
        version: update.version.to_string(),
        notes: update.body.clone(),
        pub_date: update.date.map(|date| date.to_string()),
    }))
}

#[tauri::command]
pub async fn install_app_update(app: AppHandle) -> Result<bool, String> {
    if !updater_enabled() {
        return Err("Updater is not configured for this build yet.".to_string());
    }

    let Some(update) = app
        .updater()
        .map_err(|err| format!("Failed to initialize updater: {err}"))?
        .check()
        .await
        .map_err(|err| format!("Failed to check for updates: {err}"))?
    else {
        return Ok(false);
    };

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|err| format!("Failed to install update: {err}"))?;

    Ok(true)
}
