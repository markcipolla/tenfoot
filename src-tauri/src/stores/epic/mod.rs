mod manifest;
mod paths;

use crate::launcher_core::store::ArtworkType;
use crate::launcher_core::{Game, GameStore, LauncherError};
use std::path::PathBuf;
use std::process::Command;

pub use manifest::parse_manifest_file;
pub use paths::EpicPaths;

/// Epic Games Store integration
pub struct EpicStore {
    paths: EpicPaths,
}

impl EpicStore {
    /// Create a new Epic store instance
    pub fn new() -> Self {
        Self {
            paths: EpicPaths::detect(),
        }
    }

    /// Create an Epic store with custom paths (for testing)
    pub fn with_paths(paths: EpicPaths) -> Self {
        Self { paths }
    }

    /// Scan Epic manifests for installed games
    fn scan_installed_games(&self) -> Result<Vec<Game>, LauncherError> {
        let mut games = Vec::new();

        let manifests_path = match &self.paths.manifests_path {
            Some(path) => path,
            None => return Ok(games),
        };

        if !manifests_path.exists() {
            return Ok(games);
        }

        // Read all .item files in the manifests directory
        if let Ok(entries) = std::fs::read_dir(manifests_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().is_some_and(|ext| ext == "item") {
                    match parse_manifest_file(&path) {
                        Ok(game) => games.push(game),
                        Err(e) => {
                            log::warn!("Failed to parse Epic manifest {path:?}: {e}");
                        }
                    }
                }
            }
        }

        Ok(games)
    }
}

impl Default for EpicStore {
    fn default() -> Self {
        Self::new()
    }
}

impl GameStore for EpicStore {
    fn store_id(&self) -> &'static str {
        "epic"
    }

    fn display_name(&self) -> &'static str {
        "Epic Games Store"
    }

    fn is_available(&self) -> bool {
        self.paths.launcher_path.is_some()
    }

    fn get_client_path(&self) -> Option<PathBuf> {
        self.paths.launcher_exe.clone()
    }

    fn get_installed_games(&self) -> Result<Vec<Game>, LauncherError> {
        self.scan_installed_games()
    }

    fn launch_game(&self, game_id: &str) -> Result<(), LauncherError> {
        // Epic games can be launched via protocol URL
        let launch_url = format!("com.epicgames.launcher://apps/{game_id}?action=launch");

        #[cfg(target_os = "windows")]
        {
            Command::new("cmd")
                .args(["/C", "start", "", &launch_url])
                .spawn()
                .map_err(|e| LauncherError::LaunchError(e.to_string()))?;
        }

        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg(&launch_url)
                .spawn()
                .map_err(|e| LauncherError::LaunchError(e.to_string()))?;
        }

        #[cfg(target_os = "linux")]
        {
            // Epic doesn't officially support Linux, but if running via Wine/Heroic
            Command::new("xdg-open")
                .arg(&launch_url)
                .spawn()
                .map_err(|e| LauncherError::LaunchError(e.to_string()))?;
        }

        Ok(())
    }

    fn get_artwork_url(&self, _game_id: &str, _art_type: ArtworkType) -> Option<String> {
        // Epic doesn't have a public CDN for game artwork
        // Artwork is typically fetched from the manifest or store API
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn create_test_epic_dir() -> (TempDir, EpicPaths) {
        let temp = TempDir::new().unwrap();
        let manifests = temp.path().join("Manifests");
        fs::create_dir_all(&manifests).unwrap();

        let paths = EpicPaths {
            launcher_path: Some(temp.path().to_path_buf()),
            launcher_exe: Some(temp.path().join("EpicGamesLauncher.exe")),
            manifests_path: Some(manifests),
        };

        (temp, paths)
    }

    #[test]
    fn test_epic_store_new() {
        let store = EpicStore::new();
        assert_eq!(store.store_id(), "epic");
        assert_eq!(store.display_name(), "Epic Games Store");
    }

    #[test]
    fn test_epic_store_default() {
        let store = EpicStore::default();
        assert_eq!(store.store_id(), "epic");
    }

    #[test]
    fn test_epic_store_with_paths() {
        let paths = EpicPaths {
            launcher_path: Some(PathBuf::from("/test")),
            launcher_exe: Some(PathBuf::from("/test/epic.exe")),
            manifests_path: Some(PathBuf::from("/test/manifests")),
        };
        let store = EpicStore::with_paths(paths);
        assert!(store.is_available());
    }

    #[test]
    fn test_epic_store_not_available() {
        let paths = EpicPaths {
            launcher_path: None,
            launcher_exe: None,
            manifests_path: None,
        };
        let store = EpicStore::with_paths(paths);
        assert!(!store.is_available());
    }

    #[test]
    fn test_epic_store_get_client_path() {
        let paths = EpicPaths {
            launcher_path: Some(PathBuf::from("/test")),
            launcher_exe: Some(PathBuf::from("/test/epic.exe")),
            manifests_path: None,
        };
        let store = EpicStore::with_paths(paths);
        assert_eq!(
            store.get_client_path(),
            Some(PathBuf::from("/test/epic.exe"))
        );
    }

    #[test]
    fn test_epic_store_get_client_path_none() {
        let paths = EpicPaths {
            launcher_path: None,
            launcher_exe: None,
            manifests_path: None,
        };
        let store = EpicStore::with_paths(paths);
        assert!(store.get_client_path().is_none());
    }

    #[test]
    fn test_get_installed_games_empty() {
        let (_temp, paths) = create_test_epic_dir();
        let store = EpicStore::with_paths(paths);
        let games = store.get_installed_games().unwrap();
        assert!(games.is_empty());
    }

    #[test]
    fn test_get_installed_games_with_manifest() {
        let (temp, paths) = create_test_epic_dir();

        let manifest_content = r#"{
    "AppName": "TestApp",
    "DisplayName": "Test Game",
    "InstallLocation": "C:\\Games\\TestGame",
    "LaunchExecutable": "TestGame.exe",
    "AppVersionString": "1.0.0",
    "bIsIncompleteInstall": false
}"#;
        let manifests = temp.path().join("Manifests");
        fs::write(manifests.join("TestApp.item"), manifest_content).unwrap();

        let store = EpicStore::with_paths(paths);
        let games = store.get_installed_games().unwrap();
        assert_eq!(games.len(), 1);
        assert_eq!(games[0].id, "TestApp");
        assert_eq!(games[0].name, "Test Game");
    }

    #[test]
    fn test_get_installed_games_multiple() {
        let (temp, paths) = create_test_epic_dir();
        let manifests = temp.path().join("Manifests");

        let manifest1 = r#"{"AppName": "App1", "DisplayName": "Game 1", "InstallLocation": "C:\\G1", "LaunchExecutable": "g1.exe", "bIsIncompleteInstall": false}"#;
        let manifest2 = r#"{"AppName": "App2", "DisplayName": "Game 2", "InstallLocation": "C:\\G2", "LaunchExecutable": "g2.exe", "bIsIncompleteInstall": false}"#;

        fs::write(manifests.join("App1.item"), manifest1).unwrap();
        fs::write(manifests.join("App2.item"), manifest2).unwrap();

        let store = EpicStore::with_paths(paths);
        let games = store.get_installed_games().unwrap();
        assert_eq!(games.len(), 2);
    }

    #[test]
    fn test_get_installed_games_skips_incomplete() {
        let (temp, paths) = create_test_epic_dir();
        let manifests = temp.path().join("Manifests");

        let manifest = r#"{"AppName": "IncompleteApp", "DisplayName": "Incomplete Game", "InstallLocation": "C:\\G", "LaunchExecutable": "g.exe", "bIsIncompleteInstall": true}"#;
        fs::write(manifests.join("Incomplete.item"), manifest).unwrap();

        let store = EpicStore::with_paths(paths);
        let games = store.get_installed_games().unwrap();
        assert!(games.is_empty());
    }

    #[test]
    fn test_get_installed_games_no_manifests_path() {
        let paths = EpicPaths {
            launcher_path: None,
            launcher_exe: None,
            manifests_path: None,
        };
        let store = EpicStore::with_paths(paths);
        let games = store.get_installed_games().unwrap();
        assert!(games.is_empty());
    }

    #[test]
    fn test_get_artwork_url_returns_none() {
        let store = EpicStore::new();
        let url = store.get_artwork_url("test", ArtworkType::Cover);
        assert!(url.is_none());
    }

    #[test]
    fn test_get_artwork_url_hero_returns_none() {
        let store = EpicStore::new();
        let url = store.get_artwork_url("test", ArtworkType::Hero);
        assert!(url.is_none());
    }
}
