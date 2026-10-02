use rusqlite::Connection;

/// Compare the complete scientific name, including author and infraspecific rank.
/// Display markup, abbreviation dots, case and repeated whitespace are not identity.
pub(crate) fn species_key(name: &str) -> String {
    name.replace(['*', '.'], "")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

pub(crate) fn resolve_species_name(conn: &Connection, input: &str) -> Result<String, String> {
    let mut stmt = conn.prepare(
        "SELECT species_name FROM finds UNION SELECT species_name FROM species_profiles UNION SELECT species_name FROM species_notes"
    ).map_err(|e| e.to_string())?;
    let all = stmt.query_map([], |row| row.get(0)).map_err(|e| e.to_string())?
        .collect::<Result<Vec<String>, _>>().map_err(|e| e.to_string())?;
    let input = input.trim();
    if all.iter().any(|name| name == input) {
        return Ok(input.to_string());
    }
    let key = species_key(input);
    let candidates: Vec<_> = all.into_iter().filter(|name| species_key(name) == key).collect();
    match candidates.as_slice() {
        [name] => Ok(name.clone()),
        [] => Ok(input.to_string()),
        _ => Err("Multiple matching species names exist. Choose an existing species name before importing.".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn species_identity_preserves_taxonomic_distinctions() {
        assert_eq!(species_key(" Amanita  citrina *Pers.* "), species_key("amanita citrina Pers"));
        assert_ne!(species_key("Amanita citrina Pers"), species_key("Amanita citrina var. alba Pers"));
        assert_ne!(species_key("Amanita citrina Pers"), species_key("Amanita citrina Smith"));
    }

    #[test]
    fn species_identity_resolves_folder_names_without_losing_display_formatting() {
        let dir = tempfile::tempdir().unwrap();
        let conn = super::super::import::open_db(dir.path().to_str().unwrap()).unwrap();
        conn.execute("INSERT INTO species_profiles (species_name, updated_at) VALUES ('Amanita citrina *Pers.*', '')", []).unwrap();
        assert_eq!(resolve_species_name(&conn, "Amanita citrina Pers").unwrap(), "Amanita citrina *Pers.*");
        assert_eq!(resolve_species_name(&conn, "Amanita citrina var. alba Pers").unwrap(), "Amanita citrina var. alba Pers");
        conn.execute("INSERT INTO species_profiles (species_name, updated_at) VALUES ('Amanita citrina Pers', '')", []).unwrap();
        assert!(resolve_species_name(&conn, "amanita citrina pers").is_err());
        assert_eq!(resolve_species_name(&conn, "Amanita citrina Pers").unwrap(), "Amanita citrina Pers");
    }
}
