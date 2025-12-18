use crate::launcher_core::{Game, LauncherError, StoreType};
use serde::Deserialize;
use std::fs;
use std::path::{Path, PathBuf};

/// Epic Games manifest file structure
#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct EpicManifest {
    /// Unique app identifier
    pub app_name: String,

    /// Display name of the game
    pub display_name: String,

    /// Installation location
    pub install_location: String,

    /// Launch executable relative to install location
    pub launch_executable: String,

    /// Version string
    #[serde(default)]
    pub app_version_string: Option<String>,

    /// Whether installation is incomplete
    #[serde(default)]
    #[serde(rename = "bIsIncompleteInstall")]
    pub is_incomplete_install: bool,

    /// Whether game can run offline
    #[serde(default)]
    #[serde(rename = "bCanRunOffline")]
    #[allow(dead_code)]
    pub can_run_offline: bool,

    /// Installation size
    #[serde(default)]
    pub install_size: Option<u64>,
}

/// Parse an Epic Games manifest (.item) file
pub fn parse_manifest_file(path: &Path) -> Result<Game, LauncherError> {
    let content = fs::read_to_string(path).map_err(|e| LauncherError::IoError(e.to_string()))?;

    let manifest: EpicManifest =
        serde_json::from_str(&content).map_err(|e| LauncherError::JsonError(e.to_string()))?;

    // Skip incomplete installations
    if manifest.is_incomplete_install {
        return Err(LauncherError::ParseError(
            "Game installation is incomplete".to_string(),
        ));
    }

    let mut game = Game::new(
        manifest.app_name.clone(),
        manifest.display_name.clone(),
        StoreType::Epic,
    );

    game.installed = true;

    // Set install path
    let install_path = PathBuf::from(&manifest.install_location);
    if install_path.exists() {
        game.install_path = Some(install_path.clone());

        // Set executable path
        let exe_path = install_path.join(&manifest.launch_executable);
        if exe_path.exists() {
            game.executable = Some(exe_path);
        }
    } else {
        game.install_path = Some(install_path);
    }

    // Set version
    if let Some(version) = manifest.app_version_string {
        game.version = Some(version);
    }

    // Set size
    if let Some(size) = manifest.install_size {
        game.size_bytes = Some(size);
    }

    Ok(game)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn write_manifest(temp: &TempDir, filename: &str, content: &str) -> PathBuf {
        let path = temp.path().join(filename);
        fs::write(&path, content).unwrap();
        path
    }

    #[test]
    fn test_parse_manifest_basic() {
        let temp = TempDir::new().unwrap();
        let content = r#"{
            "AppName": "TestApp",
            "DisplayName": "Test Game",
            "InstallLocation": "C:\\Games\\TestGame",
            "LaunchExecutable": "TestGame.exe",
            "bIsIncompleteInstall": false
        }"#;
        let path = write_manifest(&temp, "test.item", content);

        let game = parse_manifest_file(&path).unwrap();

        assert_eq!(game.id, "TestApp");
        assert_eq!(game.name, "Test Game");
        assert_eq!(game.store, StoreType::Epic);
        assert!(game.installed);
    }

    #[test]
    fn test_parse_manifest_with_version() {
        let temp = TempDir::new().unwrap();
        let content = r#"{
            "AppName": "App",
            "DisplayName": "Game",
            "InstallLocation": "C:\\G",
            "LaunchExecutable": "g.exe",
            "AppVersionString": "1.2.3",
            "bIsIncompleteInstall": false
        }"#;
        let path = write_manifest(&temp, "test.item", content);

        let game = parse_manifest_file(&path).unwrap();

        assert_eq!(game.version, Some("1.2.3".to_string()));
    }

    #[test]
    fn test_parse_manifest_with_size() {
        let temp = TempDir::new().unwrap();
        let content = r#"{
            "AppName": "App",
            "DisplayName": "Game",
            "InstallLocation": "C:\\G",
            "LaunchExecutable": "g.exe",
            "InstallSize": 1073741824,
            "bIsIncompleteInstall": false
        }"#;
        let path = write_manifest(&temp, "test.item", content);

        let game = parse_manifest_file(&path).unwrap();

        assert_eq!(game.size_bytes, Some(1073741824));
    }

    #[test]
    fn test_parse_manifest_incomplete_fails() {
        let temp = TempDir::new().unwrap();
        let content = r#"{
            "AppName": "App",
            "DisplayName": "Game",
            "InstallLocation": "C:\\G",
            "LaunchExecutable": "g.exe",
            "bIsIncompleteInstall": true
        }"#;
        let path = write_manifest(&temp, "test.item", content);

        let result = parse_manifest_file(&path);

        assert!(matches!(result, Err(LauncherError::ParseError(_))));
    }

    #[test]
    fn test_parse_manifest_file_not_found() {
        let path = PathBuf::from("/nonexistent/manifest.item");
        let result = parse_manifest_file(&path);

        assert!(matches!(result, Err(LauncherError::IoError(_))));
    }

    #[test]
    fn test_parse_manifest_invalid_json() {
        let temp = TempDir::new().unwrap();
        let content = "not valid json";
        let path = write_manifest(&temp, "test.item", content);

        let result = parse_manifest_file(&path);

        assert!(matches!(result, Err(LauncherError::JsonError(_))));
    }

    #[test]
    fn test_parse_manifest_missing_fields() {
        let temp = TempDir::new().unwrap();
        let content = r#"{"AppName": "Test"}"#;
        let path = write_manifest(&temp, "test.item", content);

        let result = parse_manifest_file(&path);

        assert!(matches!(result, Err(LauncherError::JsonError(_))));
    }

    #[test]
    fn test_parse_manifest_with_existing_install_path() {
        let temp = TempDir::new().unwrap();
        let game_dir = temp.path().join("GameDir");
        fs::create_dir_all(&game_dir).unwrap();

        let content = format!(
            r#"{{
            "AppName": "App",
            "DisplayName": "Game",
            "InstallLocation": "{}",
            "LaunchExecutable": "game.exe",
            "bIsIncompleteInstall": false
        }}"#,
            game_dir.display().to_string().replace('\\', "\\\\")
        );
        let path = write_manifest(&temp, "test.item", &content);

        let game = parse_manifest_file(&path).unwrap();

        assert!(game.install_path.is_some());
    }

    #[test]
    fn test_parse_manifest_with_existing_executable() {
        let temp = TempDir::new().unwrap();
        let game_dir = temp.path().join("GameDir");
        fs::create_dir_all(&game_dir).unwrap();
        fs::write(game_dir.join("game.exe"), "").unwrap();

        let content = format!(
            r#"{{
            "AppName": "App",
            "DisplayName": "Game",
            "InstallLocation": "{}",
            "LaunchExecutable": "game.exe",
            "bIsIncompleteInstall": false
        }}"#,
            game_dir.display().to_string().replace('\\', "\\\\")
        );
        let path = write_manifest(&temp, "test.item", &content);

        let game = parse_manifest_file(&path).unwrap();

        assert!(game.executable.is_some());
    }

    #[test]
    fn test_parse_manifest_can_run_offline_default() {
        let temp = TempDir::new().unwrap();
        let content = r#"{
            "AppName": "App",
            "DisplayName": "Game",
            "InstallLocation": "C:\\G",
            "LaunchExecutable": "g.exe",
            "bIsIncompleteInstall": false
        }"#;
        let path = write_manifest(&temp, "test.item", content);

        // This should not fail - bCanRunOffline defaults to false
        let _game = parse_manifest_file(&path).unwrap();
    }

    #[test]
    fn test_epic_manifest_deserialize() {
        let json = r#"{
            "AppName": "Test",
            "DisplayName": "Test Game",
            "InstallLocation": "C:\\Test",
            "LaunchExecutable": "test.exe",
            "AppVersionString": "1.0",
            "bIsIncompleteInstall": false,
            "bCanRunOffline": true,
            "InstallSize": 12345
        }"#;

        let manifest: EpicManifest = serde_json::from_str(json).unwrap();

        assert_eq!(manifest.app_name, "Test");
        assert_eq!(manifest.display_name, "Test Game");
        assert_eq!(manifest.install_location, "C:\\Test");
        assert_eq!(manifest.launch_executable, "test.exe");
        assert_eq!(manifest.app_version_string, Some("1.0".to_string()));
        assert!(!manifest.is_incomplete_install);
        assert!(manifest.can_run_offline);
        assert_eq!(manifest.install_size, Some(12345));
    }

    #[test]
    fn test_epic_manifest_debug() {
        let manifest = EpicManifest {
            app_name: "Test".to_string(),
            display_name: "Test Game".to_string(),
            install_location: "C:\\Test".to_string(),
            launch_executable: "test.exe".to_string(),
            app_version_string: None,
            is_incomplete_install: false,
            can_run_offline: false,
            install_size: None,
        };
        let debug = format!("{:?}", manifest);
        assert!(debug.contains("EpicManifest"));
    }
}
