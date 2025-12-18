use crate::launcher_core::{Game, LauncherError, StoreType};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};

/// Parse a Steam ACF (App Cache File) manifest
pub fn parse_acf_file(path: &Path) -> Result<Game, LauncherError> {
    let content = fs::read_to_string(path).map_err(|e| LauncherError::IoError(e.to_string()))?;

    let values = parse_vdf_to_map(&content)?;

    let app_id = values
        .get("appid")
        .ok_or_else(|| LauncherError::ParseError("Missing appid in manifest".to_string()))?
        .clone();

    let name = values
        .get("name")
        .ok_or_else(|| LauncherError::ParseError("Missing name in manifest".to_string()))?
        .clone();

    let mut game = Game::new(app_id, name, StoreType::Steam);
    game.installed = true;

    // Get install directory
    if let Some(install_dir) = values.get("installdir") {
        if let Some(parent) = path.parent() {
            let install_path = parent.join("common").join(install_dir);
            if install_path.exists() {
                game.install_path = Some(install_path);
            }
        }
    }

    // Get size on disk (key is lowercased by parse_vdf_to_map)
    if let Some(size_str) = values.get("sizeondisk") {
        if let Ok(size) = size_str.parse::<u64>() {
            game.size_bytes = Some(size);
        }
    }

    // Set artwork URLs
    game.cover_url = Some(format!(
        "https://steamcdn-a.akamaihd.net/steam/apps/{}/library_600x900.jpg",
        game.id
    ));
    game.hero_url = Some(format!(
        "https://steamcdn-a.akamaihd.net/steam/apps/{}/library_hero.jpg",
        game.id
    ));
    game.icon_url = Some(format!(
        "https://steamcdn-a.akamaihd.net/steam/apps/{}/header.jpg",
        game.id
    ));

    Ok(game)
}

/// Parse Steam library folders VDF file
pub fn parse_library_folders(path: &Path) -> Result<Vec<PathBuf>, LauncherError> {
    let content = fs::read_to_string(path).map_err(|e| LauncherError::IoError(e.to_string()))?;

    let mut folders = Vec::new();

    // Parse the VDF structure to find library paths
    // The format is:
    // "libraryfolders"
    // {
    //     "0"
    //     {
    //         "path" "C:\\Program Files (x86)\\Steam"
    //         ...
    //     }
    //     "1"
    //     {
    //         "path" "D:\\SteamLibrary"
    //         ...
    //     }
    // }

    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i].trim();

        // Look for "path" key
        if line.starts_with("\"path\"") {
            if let Some(path_value) = extract_quoted_value(line, "path") {
                let folder = PathBuf::from(path_value.replace("\\\\", "\\"));
                if folder.exists() {
                    folders.push(folder);
                }
            }
        }

        i += 1;
    }

    // If no folders found, try the parent directory of the VDF file
    if folders.is_empty() {
        if let Some(parent) = path.parent().and_then(|p| p.parent()) {
            folders.push(parent.to_path_buf());
        }
    }

    Ok(folders)
}

/// Simple VDF parser that extracts key-value pairs from the AppState section
fn parse_vdf_to_map(content: &str) -> Result<HashMap<String, String>, LauncherError> {
    let mut map = HashMap::new();

    for line in content.lines() {
        let line = line.trim();

        // Skip empty lines and braces
        if line.is_empty() || line == "{" || line == "}" {
            continue;
        }

        // Parse "key" "value" format
        let parts: Vec<&str> = line.split('"').collect();
        if parts.len() >= 4 {
            let key = parts[1].to_lowercase();
            let value = parts[3].to_string();
            map.insert(key, value);
        }
    }

    Ok(map)
}

/// Extract a quoted value from a line like: "key" "value"
fn extract_quoted_value(line: &str, key: &str) -> Option<String> {
    let pattern = format!("\"{key}\"");
    if !line.contains(&pattern) {
        return None;
    }

    let parts: Vec<&str> = line.split('"').collect();
    if parts.len() >= 4 {
        Some(parts[3].to_string())
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_temp_acf(content: &str) -> (TempDir, PathBuf) {
        let temp = TempDir::new().unwrap();
        let steamapps = temp.path().join("steamapps");
        fs::create_dir_all(&steamapps).unwrap();
        let path = steamapps.join("appmanifest_12345.acf");
        fs::write(&path, content).unwrap();
        (temp, path)
    }

    #[test]
    fn test_parse_acf_file_basic() {
        let content = r#"
"AppState"
{
    "appid"        "12345"
    "name"         "Test Game"
    "installdir"   "TestGame"
}
"#;
        let (_temp, path) = create_temp_acf(content);
        let game = parse_acf_file(&path).unwrap();

        assert_eq!(game.id, "12345");
        assert_eq!(game.name, "Test Game");
        assert_eq!(game.store, StoreType::Steam);
        assert!(game.installed);
    }

    #[test]
    fn test_parse_acf_file_with_size() {
        let content = r#"
"AppState"
{
    "appid"        "12345"
    "name"         "Test Game"
    "installdir"   "TestGame"
    "SizeOnDisk"   "1073741824"
}
"#;
        let (_temp, path) = create_temp_acf(content);
        let game = parse_acf_file(&path).unwrap();

        assert_eq!(game.size_bytes, Some(1073741824));
    }

    #[test]
    fn test_parse_acf_file_sets_artwork_urls() {
        let content = r#"
"AppState"
{
    "appid"        "440"
    "name"         "Team Fortress 2"
    "installdir"   "Team Fortress 2"
}
"#;
        let (_temp, path) = create_temp_acf(content);
        let game = parse_acf_file(&path).unwrap();

        assert!(game.cover_url.is_some());
        assert!(game.cover_url.unwrap().contains("440"));
        assert!(game.hero_url.is_some());
        assert!(game.icon_url.is_some());
    }

    #[test]
    fn test_parse_acf_file_missing_appid() {
        let content = r#"
"AppState"
{
    "name"         "Test Game"
}
"#;
        let (_temp, path) = create_temp_acf(content);
        let result = parse_acf_file(&path);

        assert!(matches!(result, Err(LauncherError::ParseError(_))));
    }

    #[test]
    fn test_parse_acf_file_missing_name() {
        let content = r#"
"AppState"
{
    "appid"        "12345"
}
"#;
        let (_temp, path) = create_temp_acf(content);
        let result = parse_acf_file(&path);

        assert!(matches!(result, Err(LauncherError::ParseError(_))));
    }

    #[test]
    fn test_parse_acf_file_not_found() {
        let path = PathBuf::from("/nonexistent/path/appmanifest.acf");
        let result = parse_acf_file(&path);

        assert!(matches!(result, Err(LauncherError::IoError(_))));
    }

    #[test]
    fn test_parse_acf_file_with_install_path() {
        let content = r#"
"AppState"
{
    "appid"        "12345"
    "name"         "Test Game"
    "installdir"   "TestGame"
}
"#;
        let (temp, path) = create_temp_acf(content);

        // Create the install directory
        let common = temp
            .path()
            .join("steamapps")
            .join("common")
            .join("TestGame");
        fs::create_dir_all(&common).unwrap();

        let game = parse_acf_file(&path).unwrap();

        assert!(game.install_path.is_some());
        assert!(game.install_path.unwrap().ends_with("TestGame"));
    }

    #[test]
    fn test_parse_library_folders_empty() {
        let content = r#"
"libraryfolders"
{
}
"#;
        let temp = TempDir::new().unwrap();
        let steamapps = temp.path().join("steamapps");
        fs::create_dir_all(&steamapps).unwrap();
        let path = steamapps.join("libraryfolders.vdf");
        fs::write(&path, content).unwrap();

        let folders = parse_library_folders(&path).unwrap();

        // Should return parent as fallback
        assert!(!folders.is_empty());
    }

    #[test]
    fn test_parse_library_folders_with_path() {
        let temp = TempDir::new().unwrap();
        let steamapps = temp.path().join("steamapps");
        fs::create_dir_all(&steamapps).unwrap();

        let content = format!(
            r#"
"libraryfolders"
{{
    "0"
    {{
        "path"      "{}"
    }}
}}
"#,
            temp.path().display().to_string().replace('\\', "\\\\")
        );

        let path = steamapps.join("libraryfolders.vdf");
        fs::write(&path, content).unwrap();

        let folders = parse_library_folders(&path).unwrap();

        assert!(!folders.is_empty());
    }

    #[test]
    fn test_parse_library_folders_not_found() {
        let path = PathBuf::from("/nonexistent/libraryfolders.vdf");
        let result = parse_library_folders(&path);

        assert!(matches!(result, Err(LauncherError::IoError(_))));
    }

    #[test]
    fn test_parse_vdf_to_map_basic() {
        let content = r#"
"AppState"
{
    "appid"        "12345"
    "name"         "Test Game"
}
"#;
        let map = parse_vdf_to_map(content).unwrap();

        assert_eq!(map.get("appid"), Some(&"12345".to_string()));
        assert_eq!(map.get("name"), Some(&"Test Game".to_string()));
    }

    #[test]
    fn test_parse_vdf_to_map_empty() {
        let content = "";
        let map = parse_vdf_to_map(content).unwrap();
        assert!(map.is_empty());
    }

    #[test]
    fn test_parse_vdf_to_map_case_insensitive() {
        let content = r#"
"AppId"        "12345"
"NAME"         "Test"
"#;
        let map = parse_vdf_to_map(content).unwrap();

        assert_eq!(map.get("appid"), Some(&"12345".to_string()));
        assert_eq!(map.get("name"), Some(&"Test".to_string()));
    }

    #[test]
    fn test_extract_quoted_value_basic() {
        let line = r#""path"      "C:\\Steam""#;
        let value = extract_quoted_value(line, "path");

        // Raw string has two backslashes, function returns value as-is
        // Caller (parse_library_folders) handles escape processing
        assert_eq!(value, Some(r#"C:\\Steam"#.to_string()));
    }

    #[test]
    fn test_extract_quoted_value_not_found() {
        let line = r#""other"      "value""#;
        let value = extract_quoted_value(line, "path");

        assert!(value.is_none());
    }

    #[test]
    fn test_extract_quoted_value_malformed() {
        let line = r#""path""#;
        let value = extract_quoted_value(line, "path");

        assert!(value.is_none());
    }
}
