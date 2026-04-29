use chrono::Utc;
use rusqlite::params;

use crate::commands::import::open_db;

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct ZoneRecord {
    pub id: i64,
    pub species_name: String,
    pub zone_type: String,
    pub name: String,
    pub geometry_type: String,
    pub center_lat: Option<f64>,
    pub center_lng: Option<f64>,
    pub radius_meters: Option<f64>,
    pub polygon_json: Option<String>,
    pub source_find_id: Option<i64>,
    pub notes: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(serde::Deserialize, Clone, Debug)]
pub struct UpsertZonePayload {
    pub id: Option<i64>,
    pub species_name: String,
    pub zone_type: String,
    pub name: String,
    pub geometry_type: String,
    pub center_lat: Option<f64>,
    pub center_lng: Option<f64>,
    pub radius_meters: Option<f64>,
    pub polygon_json: Option<String>,
    pub source_find_id: Option<i64>,
    pub notes: String,
}

fn validate_zone(payload: &UpsertZonePayload) -> Result<(), String> {
    let species_name = payload.species_name.trim();
    if species_name.is_empty() {
        return Err("species name is required".into());
    }
    if payload.zone_type != "local" && payload.zone_type != "region" {
        return Err("zone type must be local or region".into());
    }
    if payload.geometry_type != "circle" && payload.geometry_type != "polygon" {
        return Err("geometry type must be circle or polygon".into());
    }
    if payload.geometry_type == "circle" {
        if payload.center_lat.is_none() || payload.center_lng.is_none() {
            return Err("circle zones require center coordinates".into());
        }
        match payload.radius_meters {
            Some(radius) if radius > 0.0 => {}
            _ => return Err("circle zones require a positive radius".into()),
        }
    }
    if payload.geometry_type == "polygon" {
        let polygon = payload.polygon_json.as_deref().unwrap_or("").trim();
        if polygon.is_empty() {
            return Err("polygon zones require polygon coordinates".into());
        }
    }
    Ok(())
}

fn row_to_zone(row: &rusqlite::Row<'_>) -> rusqlite::Result<ZoneRecord> {
    Ok(ZoneRecord {
        id: row.get(0)?,
        species_name: row.get(1)?,
        zone_type: row.get(2)?,
        name: row.get(3)?,
        geometry_type: row.get(4)?,
        center_lat: row.get(5)?,
        center_lng: row.get(6)?,
        radius_meters: row.get(7)?,
        polygon_json: row.get(8)?,
        source_find_id: row.get(9)?,
        notes: row.get(10)?,
        created_at: row.get(11)?,
        updated_at: row.get(12)?,
    })
}

fn get_zone_by_id(storage_path: &str, zone_id: i64) -> Result<ZoneRecord, String> {
    let conn = open_db(storage_path)?;
    conn.query_row(
        "SELECT id, species_name, zone_type, name, geometry_type, center_lat, center_lng, radius_meters, polygon_json, source_find_id, notes, created_at, updated_at FROM zones WHERE id = ?1",
        params![zone_id],
        row_to_zone,
    )
    .map_err(|e| format!("Zone not found: {}", e))
}

fn find_existing_zone_id(
    conn: &rusqlite::Connection,
    payload: &UpsertZonePayload,
) -> Result<Option<i64>, String> {
    if payload.zone_type == "local" {
        if let Some(source_find_id) = payload.source_find_id {
            let mut stmt = conn
                .prepare(
                    "SELECT id FROM zones
                     WHERE species_name = ?1
                       AND zone_type = 'local'
                       AND geometry_type = ?2
                       AND source_find_id = ?3
                     ORDER BY updated_at DESC, id DESC
                     LIMIT 1",
                )
                .map_err(|e| e.to_string())?;
            let mut rows = stmt
                .query(params![payload.species_name.trim(), payload.geometry_type, source_find_id])
                .map_err(|e| e.to_string())?;
            if let Some(row) = rows.next().map_err(|e| e.to_string())? {
                return row.get(0).map(Some).map_err(|e| e.to_string());
            }
        }
    }

    if payload.zone_type == "region" {
        if let Some(source_find_id) = payload.source_find_id {
            let mut stmt = conn
                .prepare(
                    "SELECT id FROM zones
                     WHERE species_name = ?1
                       AND zone_type = 'region'
                       AND geometry_type = ?2
                       AND source_find_id = ?3
                     ORDER BY updated_at DESC, id DESC
                     LIMIT 1",
                )
                .map_err(|e| e.to_string())?;
            let mut rows = stmt
                .query(params![payload.species_name.trim(), payload.geometry_type, source_find_id])
                .map_err(|e| e.to_string())?;
            if let Some(row) = rows.next().map_err(|e| e.to_string())? {
                return row.get(0).map(Some).map_err(|e| e.to_string());
            }
        } else {
            let mut stmt = conn
                .prepare(
                    "SELECT id FROM zones
                     WHERE species_name = ?1
                       AND zone_type = 'region'
                       AND geometry_type = ?2
                       AND source_find_id IS NULL
                     ORDER BY updated_at DESC, id DESC
                     LIMIT 1",
                )
                .map_err(|e| e.to_string())?;
            let mut rows = stmt
                .query(params![payload.species_name.trim(), payload.geometry_type])
                .map_err(|e| e.to_string())?;
            if let Some(row) = rows.next().map_err(|e| e.to_string())? {
                return row.get(0).map(Some).map_err(|e| e.to_string());
            }
        }
    }

    Ok(None)
}

#[tauri::command]
pub async fn get_zones(storage_path: String) -> Result<Vec<ZoneRecord>, String> {
    let conn = open_db(&storage_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, species_name, zone_type, name, geometry_type, center_lat, center_lng, radius_meters, polygon_json, source_find_id, notes, created_at, updated_at
             FROM zones
             ORDER BY species_name ASC, zone_type ASC, updated_at DESC, id DESC",
        )
        .map_err(|e| e.to_string())?;
    let zones = stmt.query_map([], row_to_zone)
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(zones)
}

#[tauri::command]
pub async fn upsert_zone(
    storage_path: String,
    payload: UpsertZonePayload,
) -> Result<ZoneRecord, String> {
    validate_zone(&payload)?;
    let conn = open_db(&storage_path)?;
    let now = Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();
    let species_name = payload.species_name.trim().to_string();
    let name = payload.name.trim().to_string();
    let notes = payload.notes.trim().to_string();

    let zone_id = match payload.id {
        Some(id) => {
            let rows = conn
                .execute(
                    "UPDATE zones
                     SET species_name = ?1, zone_type = ?2, name = ?3, geometry_type = ?4,
                         center_lat = ?5, center_lng = ?6, radius_meters = ?7,
                         polygon_json = ?8, source_find_id = ?9, notes = ?10, updated_at = ?11
                     WHERE id = ?12",
                    params![
                        species_name,
                        payload.zone_type,
                        name,
                        payload.geometry_type,
                        payload.center_lat,
                        payload.center_lng,
                        payload.radius_meters,
                        payload.polygon_json,
                        payload.source_find_id,
                        notes,
                        now,
                        id,
                    ],
                )
                .map_err(|e| format!("Zone update failed: {}", e))?;
            if rows == 0 {
                return Err("zone not found".into());
            }
            id
        }
        None => {
            if let Some(existing_id) = find_existing_zone_id(&conn, &payload)? {
                return get_zone_by_id(&storage_path, existing_id);
            }
            conn.execute(
                "INSERT INTO zones
                 (species_name, zone_type, name, geometry_type, center_lat, center_lng, radius_meters, polygon_json, source_find_id, notes, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
                params![
                    species_name,
                    payload.zone_type,
                    name,
                    payload.geometry_type,
                    payload.center_lat,
                    payload.center_lng,
                    payload.radius_meters,
                    payload.polygon_json,
                    payload.source_find_id,
                    notes,
                    now,
                    now,
                ],
            )
            .map_err(|e| format!("Zone insert failed: {}", e))?;
            conn.last_insert_rowid()
        }
    };

    get_zone_by_id(&storage_path, zone_id)
}

#[tauri::command]
pub async fn delete_zone(storage_path: String, zone_id: i64) -> Result<(), String> {
    let conn = open_db(&storage_path)?;
    conn.execute("DELETE FROM zones WHERE id = ?1", params![zone_id])
        .map_err(|e| format!("Zone delete failed: {}", e))?;
    Ok(())
}
