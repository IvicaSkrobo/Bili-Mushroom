use exif::{In, Tag};

#[derive(serde::Serialize)]
pub struct ExifData {
    pub date: Option<String>,
    pub lat: Option<f64>,
    pub lng: Option<f64>,
}

/// Convert a DMS (degrees/minutes/seconds) rational field to decimal degrees.
fn dms_to_decimal(field: &exif::Field) -> Option<f64> {
    if let exif::Value::Rational(ref rationals) = field.value {
        if rationals.len() < 3 {
            return None;
        }
        let deg = rationals[0].to_f64();
        let min = rationals[1].to_f64();
        let sec = rationals[2].to_f64();
        Some(deg + min / 60.0 + sec / 3600.0)
    } else {
        None
    }
}

/// Apply hemisphere reference: flip sign for South ('S') or West ('W').
fn apply_ref(ref_char: char, value: f64) -> f64 {
    match ref_char {
        'S' | 'W' => -value,
        _ => value,
    }
}

/// Normalize EXIF date string "2024:05:10 14:23:00" → "2024-05-10".
/// Returns None if input is shorter than 10 characters or otherwise malformed.
fn normalize_exif_date(raw: &str) -> Option<String> {
    if raw.len() < 10 {
        return None;
    }
    let date_part = &raw[0..10];
    // Expect format YYYY:MM:DD — replace colons with dashes
    let normalized = date_part.replace(':', "-");
    // Basic sanity: should look like YYYY-MM-DD (digits and dashes)
    if normalized.chars().all(|c| c.is_ascii_digit() || c == '-') {
        Some(normalized)
    } else {
        None
    }
}

/// Extract EXIF data from a file path. Returns empty ExifData on any error — missing
/// EXIF is normal (user will fill in manually).
pub fn extract_exif(path: &str) -> ExifData {
    let result = (|| -> Option<ExifData> {
        let file = std::fs::File::open(path).ok()?;
        let mut buf = std::io::BufReader::new(&file);
        let exif = exif::Reader::new().read_from_container(&mut buf).ok()?;

        // GPS Latitude
        let lat_val = exif
            .get_field(Tag::GPSLatitude, In::PRIMARY)
            .and_then(|f| dms_to_decimal(f));
        let lat_ref = exif
            .get_field(Tag::GPSLatitudeRef, In::PRIMARY)
            .and_then(|f| {
                let s = f.display_value().to_string();
                s.trim().chars().next()
            })
            .unwrap_or('N');
        let lat = lat_val.map(|v| apply_ref(lat_ref, v));

        // GPS Longitude
        let lng_val = exif
            .get_field(Tag::GPSLongitude, In::PRIMARY)
            .and_then(|f| dms_to_decimal(f));
        let lng_ref = exif
            .get_field(Tag::GPSLongitudeRef, In::PRIMARY)
            .and_then(|f| {
                let s = f.display_value().to_string();
                s.trim().chars().next()
            })
            .unwrap_or('E');
        let lng = lng_val.map(|v| apply_ref(lng_ref, v));

        // Date
        let date = exif
            .get_field(Tag::DateTimeOriginal, In::PRIMARY)
            .and_then(|f| normalize_exif_date(&f.display_value().to_string()));

        Some(ExifData { date, lat, lng })
    })();

    result.unwrap_or(ExifData {
        date: None,
        lat: None,
        lng: None,
    })
}

/// Tauri command: parse EXIF from a file path.
/// Always returns Ok — missing EXIF fields are None, errors result in all-None ExifData.
#[tauri::command]
pub async fn parse_exif(path: String) -> Result<ExifData, String> {
    let data = tauri::async_runtime::spawn_blocking(move || extract_exif(&path))
        .await
        .map_err(|e| e.to_string())?;
    Ok(data)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_rational_field(deg: u32, min: u32, sec: u32) -> exif::Field {
        exif::Field {
            tag: Tag::GPSLatitude,
            ifd_num: In::PRIMARY,
            value: exif::Value::Rational(vec![
                exif::Rational { num: deg, denom: 1 },
                exif::Rational { num: min, denom: 1 },
                exif::Rational { num: sec, denom: 1 },
            ]),
        }
    }

    #[test]
    fn test_dms_to_decimal_45_30_0() {
        let field = make_rational_field(45, 30, 0);
        let result = dms_to_decimal(&field).expect("should parse");
        assert!((result - 45.5).abs() < 1e-9, "expected 45.5, got {}", result);
    }

    #[test]
    fn test_apply_ref_south_negates() {
        assert!((apply_ref('S', 45.5) - (-45.5)).abs() < 1e-9);
    }

    #[test]
    fn test_apply_ref_north_positive() {
        assert!((apply_ref('N', 45.5) - 45.5).abs() < 1e-9);
    }

    #[test]
    fn test_apply_ref_west_negates() {
        assert!((apply_ref('W', 16.0) - (-16.0)).abs() < 1e-9);
    }

    #[test]
    fn test_apply_ref_east_positive() {
        assert!((apply_ref('E', 16.0) - 16.0).abs() < 1e-9);
    }

    #[test]
    fn test_normalize_exif_date_valid() {
        assert_eq!(
            normalize_exif_date("2024:05:10 14:23:00"),
            Some("2024-05-10".to_string())
        );
    }

    #[test]
    fn test_normalize_exif_date_garbage() {
        assert_eq!(normalize_exif_date("garbage"), None);
    }

    #[test]
    fn test_normalize_exif_date_too_short() {
        assert_eq!(normalize_exif_date("2024:05"), None);
    }

    #[test]
    fn test_extract_exif_nonexistent_returns_empty() {
        let data = extract_exif("/nonexistent/path/photo.jpg");
        assert!(data.date.is_none());
        assert!(data.lat.is_none());
        assert!(data.lng.is_none());
    }

    /// Real-JPEG fixture test — skipped if fixture not present.
    /// Fixture would be a JPEG with known GPS tags embedded.
    #[test]
    #[ignore = "requires real JPEG fixture with GPS EXIF data"]
    fn test_extract_exif_real_jpeg_fixture() {
        let data = extract_exif("tests/fixtures/geo.jpg");
        assert!(data.lat.is_some());
        assert!(data.lng.is_some());
    }
}
