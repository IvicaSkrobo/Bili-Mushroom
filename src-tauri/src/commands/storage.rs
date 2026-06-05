use serde_json::Value;
use tauri::Manager;

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
