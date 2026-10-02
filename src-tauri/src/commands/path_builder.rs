use std::path::{Path, PathBuf};

/// Reserve a new file atomically: existing library photos must never be overwritten,
/// including when sequence numbers have gaps or another writer picks the same name.
pub(crate) fn copy_photo_without_overwrite(source: &Path, destination: &Path) -> std::io::Result<PathBuf> {
    let mut input = std::fs::File::open(source)?;
    let mut candidate = destination.to_path_buf();
    let mut suffix = 1u64;
    loop {
        match std::fs::OpenOptions::new().write(true).create_new(true).open(&candidate) {
            Ok(mut output) => {
                if let Err(error) = std::io::copy(&mut input, &mut output) {
                    drop(output);
                    let _ = std::fs::remove_file(&candidate);
                    return Err(error);
                }
                return Ok(candidate);
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                let stem = destination.file_stem().unwrap_or_default().to_string_lossy();
                let ext = destination.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
                candidate = destination.with_file_name(format!("{stem}_{suffix}{ext}"));
                suffix += 1;
            }
            Err(error) => return Err(error),
        }
    }
}

/// Replace Windows-illegal characters with underscores, collapse consecutive underscores,
/// and trim outer whitespace/underscores while preserving user-entered spaces.
pub fn sanitize_path_component(s: &str) -> String {
    let trimmed = s.trim();
    let replaced: String = trimmed
        .chars()
        .map(|c| match c {
            '\\' | '/' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
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
    if trimmed.is_empty() {
        String::new()
    } else {
        result.trim_matches('_').trim().to_string()
    }
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
/// Pattern (with location): `<storage_root>/<species_folder>/<date>_<location>_<seq:03><ext>`
/// Pattern (no location):   `<storage_root>/<species_folder>/<date>_<seq:03><ext>`
/// Falls back to `unknown_species` if the sanitized species value is empty.
/// `location_label` is sanitized and spaces replaced with underscores; omitted when empty.
pub fn build_dest_path(
    storage_root: &str,
    species: &str,
    date: &str,
    location_label: &str,
    seq: u32,
    ext: &str,
) -> PathBuf {
    let species_folder = resolve_location_component(&plain_species_name(species), "unknown_species");
    let loc = sanitize_path_component(location_label)
        .replace(' ', "_");
    let filename = if loc.is_empty() {
        format!("{}_{:03}{}", date, seq, ext)
    } else {
        format!("{}_{}_{:03}{}", date, loc, seq, ext)
    };

    let mut path = PathBuf::from(storage_root);
    path.push(&species_folder);
    path.push(&filename);
    path
}

/// Strip the `*text*` italic-marker format used by SpeciesNameEditor before
/// using a species name as a filesystem path component.
/// "Boletus *edulis*" → "Boletus edulis"
pub fn plain_species_name(name: &str) -> String {
    name.replace('*', "")
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
    fn copying_a_photo_never_overwrites_an_existing_destination() {
        let dir = tempfile::tempdir().unwrap();
        let source = dir.path().join("source.jpg");
        let destination = dir.path().join("2026-10-02_003.jpg");
        std::fs::write(&source, b"new photo").unwrap();
        std::fs::write(&destination, b"precious original").unwrap();
        let first = copy_photo_without_overwrite(&source, &destination).unwrap();
        let second = copy_photo_without_overwrite(&source, &destination).unwrap();
        assert_ne!(first, destination);
        assert_ne!(first, second);
        assert_eq!(std::fs::read(&destination).unwrap(), b"precious original");
        assert_eq!(std::fs::read(first).unwrap(), b"new photo");
        assert_eq!(std::fs::read(second).unwrap(), b"new photo");
    }

    #[test]
    fn test_build_dest_path_standard() {
        let result = build_dest_path(
            "/root",
            "Boletus edulis",
            "2024-05-10",
            "",
            1,
            ".jpg",
        );
        let path_str = result.to_string_lossy();
        assert!(
            path_str.contains("Boletus edulis"),
            "Expected 'Boletus edulis' folder in path, got: {}",
            path_str
        );
        assert!(
            path_str.contains("2024-05-10_001.jpg"),
            "Expected 2024-05-10_001.jpg filename in path, got: {}",
            path_str
        );
        // Verify the path has root component
        let components: Vec<_> = result.components().collect();
        assert!(components.len() >= 3, "Expected at least 3 path components");
    }

    #[test]
    fn test_build_dest_path_with_location() {
        let result = build_dest_path(
            "/root",
            "Boletus edulis",
            "2024-05-10",
            "Gorski Kotar",
            1,
            ".jpg",
        );
        let path_str = result.to_string_lossy();
        assert!(
            path_str.contains("2024-05-10_Gorski_Kotar_001.jpg"),
            "Expected location in filename, got: {}",
            path_str
        );
    }

    #[test]
    fn test_build_dest_path_location_sanitized() {
        let result = build_dest_path(
            "/root",
            "Boletus edulis",
            "2024-05-10",
            "Šuma/Rijeka",
            1,
            ".jpg",
        );
        let path_str = result.to_string_lossy();
        // slash replaced with underscore
        assert!(
            path_str.contains("Šuma_Rijeka"),
            "Expected sanitized location in filename, got: {}",
            path_str
        );
    }

    #[test]
    fn test_sanitize_removes_quotes_and_illegal_chars() {
        // trailing underscore trimmed by trim_matches('_')
        assert_eq!(sanitize_path_component("Amanita \"muscaria\""), "Amanita _muscaria");
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
        assert_eq!(sanitize_path_component("Gorski Kotar"), "Gorski Kotar");
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
    fn test_build_dest_path_empty_species_uses_fallback() {
        let result = build_dest_path("/root", "", "2024-05-10", "", 1, ".jpg");
        let path_str = result.to_string_lossy();
        assert!(
            path_str.contains("unknown_species"),
            "Expected unknown_species fallback, got: {}",
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

    #[test]
    fn test_build_dest_path_formatted_species_strips_markers() {
        let result = build_dest_path(
            "/root",
            "Boletus *edulis*",
            "2024-05-10",
            "",
            1,
            ".jpg",
        );
        let path_str = result.to_string_lossy();
        assert!(
            path_str.contains("Boletus edulis"),
            "Expected 'Boletus edulis' folder (markers stripped), got: {}",
            path_str
        );
        // Only the species folder must be free of marker characters. The generated file
        // name legitimately contains an underscore ("2024-05-10_001.jpg"), so asserting
        // over the whole path would reject a correct result.
        let species_folder = result
            .parent()
            .and_then(|parent| parent.file_name())
            .expect("species folder component")
            .to_string_lossy()
            .to_string();
        assert!(
            !species_folder.contains('*') && !species_folder.contains('_'),
            "Expected no asterisks or underscores from markers in the species folder, got: {}",
            species_folder
        );
    }
}
