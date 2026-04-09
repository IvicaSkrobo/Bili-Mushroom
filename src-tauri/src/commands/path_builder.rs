use std::path::{Path, PathBuf};

/// Replace Windows-illegal characters and spaces with underscores, collapse consecutive underscores,
/// then trim leading/trailing underscores.
pub fn sanitize_path_component(s: &str) -> String {
    let replaced: String = s
        .chars()
        .map(|c| match c {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' | ' ' => '_',
            c => c,
        })
        .collect();
    // Collapse consecutive underscores into a single one
    let mut result = String::with_capacity(replaced.len());
    let mut prev_underscore = false;
    for c in replaced.chars() {
        if c == '_' {
            if !prev_underscore {
                result.push('_');
            }
            prev_underscore = true;
        } else {
            result.push(c);
            prev_underscore = false;
        }
    }
    result.trim_matches('_').to_string()
}

/// Returns `fallback` if the sanitized value is empty, otherwise returns the sanitized value.
pub fn resolve_location_component(value: &str, fallback: &str) -> String {
    let sanitized = sanitize_path_component(value);
    if sanitized.is_empty() {
        fallback.to_string()
    } else {
        sanitized
    }
}

/// Build the full destination path for a find's photo file.
///
/// Pattern: `<storage_root>/<country>/<region>/<date>/<species>_<date>_<seq:03><ext>`
/// Falls back to `unknown_country`, `unknown_region`, `unknown_species` if the sanitized values are empty.
pub fn build_dest_path(
    storage_root: &str,
    country: &str,
    region: &str,
    date: &str,
    species: &str,
    seq: u32,
    ext: &str,
) -> PathBuf {
    let country_part = resolve_location_component(country, "unknown_country");
    let region_part = resolve_location_component(region, "unknown_region");
    let species_part = resolve_location_component(species, "unknown_species");
    let filename = format!("{}_{}_{:03}{}", species_part, date, seq, ext);

    let mut path = PathBuf::from(storage_root);
    path.push(&country_part);
    path.push(&region_part);
    path.push(date);
    path.push(&filename);
    path
}

/// Returns the next sequence number for files in a folder.
/// If the folder does not exist, returns 1.
/// Otherwise returns the count of existing entries + 1.
pub fn next_seq_for_folder(folder: &Path) -> u32 {
    if !folder.exists() {
        return 1;
    }
    std::fs::read_dir(folder)
        .map(|entries| entries.count() as u32 + 1)
        .unwrap_or(1)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_build_dest_path_standard() {
        let result = build_dest_path(
            "/root",
            "Croatia",
            "Gorski Kotar",
            "2024-05-10",
            "Boletus edulis",
            1,
            ".jpg",
        );
        // Check components rather than full string for cross-platform compatibility
        let components: Vec<_> = result.components().collect();
        // Find the relevant suffix: Country/Region/Date/Filename
        let path_str = result.to_string_lossy();
        assert!(
            path_str.contains("Croatia"),
            "Expected Croatia in path, got: {}",
            path_str
        );
        assert!(
            path_str.contains("Gorski_Kotar"),
            "Expected Gorski_Kotar in path, got: {}",
            path_str
        );
        assert!(
            path_str.contains("2024-05-10"),
            "Expected 2024-05-10 in path, got: {}",
            path_str
        );
        assert!(
            path_str.contains("Boletus_edulis_2024-05-10_001.jpg"),
            "Expected Boletus_edulis_2024-05-10_001.jpg in path, got: {}",
            path_str
        );
        // Verify the path has root component
        assert!(components.len() >= 5, "Expected at least 5 path components");
    }

    #[test]
    fn test_sanitize_removes_quotes_and_illegal_chars() {
        assert_eq!(sanitize_path_component("Amanita \"muscaria\""), "Amanita_muscaria");
    }

    #[test]
    fn test_sanitize_empty_string() {
        assert_eq!(sanitize_path_component(""), "");
    }

    #[test]
    fn test_sanitize_slashes() {
        assert_eq!(sanitize_path_component("foo/bar\\baz"), "foo_bar_baz");
    }

    #[test]
    fn test_sanitize_spaces() {
        assert_eq!(sanitize_path_component("Gorski Kotar"), "Gorski_Kotar");
    }

    #[test]
    fn test_sanitize_windows_illegal_chars() {
        assert_eq!(sanitize_path_component("a:b*c?d<e>f|g"), "a_b_c_d_e_f_g");
    }

    #[test]
    fn test_resolve_location_component_empty_uses_fallback() {
        assert_eq!(resolve_location_component("", "unknown_country"), "unknown_country");
    }

    #[test]
    fn test_resolve_location_component_nonempty() {
        assert_eq!(resolve_location_component("Croatia", "unknown_country"), "Croatia");
    }

    #[test]
    fn test_resolve_location_component_whitespace_only_uses_fallback() {
        // Spaces get replaced by underscores, then trimmed — result is empty → fallback
        assert_eq!(resolve_location_component("   ", "unknown_country"), "unknown_country");
    }

    #[test]
    fn test_build_dest_path_empty_country_uses_fallback() {
        let result = build_dest_path("/root", "", "Region", "2024-05-10", "Species", 1, ".jpg");
        let path_str = result.to_string_lossy();
        assert!(
            path_str.contains("unknown_country"),
            "Expected unknown_country fallback, got: {}",
            path_str
        );
    }

    #[test]
    fn test_next_seq_nonexistent_folder_returns_1() {
        let nonexistent = PathBuf::from("/tmp/bili_mushroom_test_nonexistent_12345xyz");
        assert_eq!(next_seq_for_folder(&nonexistent), 1);
    }

    #[test]
    fn test_next_seq_folder_with_entries() {
        let dir = tempfile::tempdir().expect("tempdir");
        // Create 2 files
        std::fs::write(dir.path().join("file1.jpg"), b"a").unwrap();
        std::fs::write(dir.path().join("file2.jpg"), b"b").unwrap();
        assert_eq!(next_seq_for_folder(dir.path()), 3);
    }
}
