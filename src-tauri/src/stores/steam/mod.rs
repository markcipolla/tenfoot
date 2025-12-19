pub mod api;
mod parser;
mod paths;

use crate::launcher_core::store::ArtworkType;
use crate::launcher_core::{Game, GameStore, LauncherError};
use std::path::PathBuf;
use std::process::Command;

pub use api::{GameDetails, SteamApi, SteamCredentials};
pub use parser::{parse_acf_file, parse_library_folders};
pub use paths::SteamPaths;

/// Steam store integration
pub struct SteamStore {
    paths: SteamPaths,
}

impl SteamStore {
    /// Create a new Steam store instance
    pub fn new() -> Self {
        Self {
            paths: SteamPaths::detect(),
        }
    }

    /// Create a Steam store with custom paths (for testing)
    pub fn with_paths(paths: SteamPaths) -> Self {
        Self { paths }
    }

    /// Scan Steam library folders for installed games
    fn scan_installed_games(&self) -> Result<Vec<Game>, LauncherError> {
        let mut games = Vec::new();

        // Get library folders
        let library_folders = match &self.paths.steam_path {
            Some(steam_path) => {
                let vdf_path = steam_path.join("steamapps").join("libraryfolders.vdf");
                if vdf_path.exists() {
                    parse_library_folders(&vdf_path)?
                } else {
                    vec![steam_path.clone()]
                }
            }
            None => return Ok(games),
        };

        // Scan each library folder for installed games
        for library_path in library_folders {
            let steamapps = library_path.join("steamapps");
            if !steamapps.exists() {
                continue;
            }

            // Find all appmanifest files
            if let Ok(entries) = std::fs::read_dir(&steamapps) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if let Some(filename) = path.file_name().and_then(|n| n.to_str()) {
                        if filename.starts_with("appmanifest_") && filename.ends_with(".acf") {
                            if let Ok(game) = parse_acf_file(&path) {
                                games.push(game);
                            }
                        }
                    }
                }
            }
        }

        Ok(games)
    }

    /// Get Steam CDN URL for game artwork
    fn get_steam_cdn_url(app_id: &str, art_type: ArtworkType) -> String {
        match art_type {
            ArtworkType::Cover => {
                format!("https://steamcdn-a.akamaihd.net/steam/apps/{app_id}/library_600x900.jpg")
            }
            ArtworkType::Hero => {
                format!("https://steamcdn-a.akamaihd.net/steam/apps/{app_id}/library_hero.jpg")
            }
            ArtworkType::Logo => {
                format!("https://steamcdn-a.akamaihd.net/steam/apps/{app_id}/logo.png")
            }
            ArtworkType::Icon => {
                format!("https://steamcdn-a.akamaihd.net/steam/apps/{app_id}/header.jpg")
            }
        }
    }

    /// Trigger Steam to install a game
    pub fn install_game(&self, game_id: &str) -> Result<(), LauncherError> {
        // Use Steam's protocol handler to trigger installation
        #[cfg(target_os = "windows")]
        {
            Command::new("cmd")
                .args(["/C", "start", "", &format!("steam://install/{game_id}")])
                .spawn()
                .map_err(|e| LauncherError::LaunchError(e.to_string()))?;
        }

        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg(format!("steam://install/{game_id}"))
                .spawn()
                .map_err(|e| LauncherError::LaunchError(e.to_string()))?;
        }

        #[cfg(target_os = "linux")]
        {
            Command::new("xdg-open")
                .arg(format!("steam://install/{game_id}"))
                .spawn()
                .map_err(|e| LauncherError::LaunchError(e.to_string()))?;
        }

        Ok(())
    }
}

impl Default for SteamStore {
    fn default() -> Self {
        Self::new()
    }
}

impl GameStore for SteamStore {
    fn store_id(&self) -> &'static str {
        "steam"
    }

    fn display_name(&self) -> &'static str {
        "Steam"
    }

    fn is_available(&self) -> bool {
        self.paths.steam_path.is_some()
    }

    fn get_client_path(&self) -> Option<PathBuf> {
        self.paths.steam_exe.clone()
    }

    fn get_installed_games(&self) -> Result<Vec<Game>, LauncherError> {
        self.scan_installed_games()
    }

    fn launch_game(&self, game_id: &str) -> Result<(), LauncherError> {
        let steam_exe =
            self.paths.steam_exe.as_ref().ok_or_else(|| {
                LauncherError::LaunchError("Steam executable not found".to_string())
            })?;

        #[cfg(target_os = "windows")]
        {
            Command::new(steam_exe)
                .arg("-applaunch")
                .arg(game_id)
                .spawn()
                .map_err(|e| LauncherError::LaunchError(e.to_string()))?;
        }

        #[cfg(target_os = "macos")]
        {
            Command::new("open")
                .arg("-a")
                .arg(steam_exe)
                .arg("--args")
                .arg("-applaunch")
                .arg(game_id)
                .spawn()
                .map_err(|e| LauncherError::LaunchError(e.to_string()))?;
        }

        #[cfg(target_os = "linux")]
        {
            Command::new(steam_exe)
                .arg("-applaunch")
                .arg(game_id)
                .spawn()
                .map_err(|e| LauncherError::LaunchError(e.to_string()))?;
        }

        Ok(())
    }

    fn get_artwork_url(&self, game_id: &str, art_type: ArtworkType) -> Option<String> {
        Some(Self::get_steam_cdn_url(game_id, art_type))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn create_test_steam_dir() -> (TempDir, SteamPaths) {
        let temp = TempDir::new().unwrap();
        let steam_path = temp.path().to_path_buf();
        let steamapps = steam_path.join("steamapps");
        fs::create_dir_all(&steamapps).unwrap();

        let paths = SteamPaths {
            steam_path: Some(steam_path),
            steam_exe: Some(temp.path().join("steam")),
        };

        (temp, paths)
    }

    #[test]
    fn test_steam_store_new() {
        let store = SteamStore::new();
        assert_eq!(store.store_id(), "steam");
        assert_eq!(store.display_name(), "Steam");
    }

    #[test]
    fn test_steam_store_default() {
        let store = SteamStore::default();
        assert_eq!(store.store_id(), "steam");
    }

    #[test]
    fn test_steam_store_with_paths() {
        let paths = SteamPaths {
            steam_path: Some(PathBuf::from("/test/steam")),
            steam_exe: Some(PathBuf::from("/test/steam/steam.exe")),
        };
        let store = SteamStore::with_paths(paths);
        assert!(store.is_available());
    }

    #[test]
    fn test_steam_store_not_available() {
        let paths = SteamPaths {
            steam_path: None,
            steam_exe: None,
        };
        let store = SteamStore::with_paths(paths);
        assert!(!store.is_available());
    }

    #[test]
    fn test_steam_store_get_client_path() {
        let paths = SteamPaths {
            steam_path: Some(PathBuf::from("/test")),
            steam_exe: Some(PathBuf::from("/test/steam.exe")),
        };
        let store = SteamStore::with_paths(paths);
        assert_eq!(
            store.get_client_path(),
            Some(PathBuf::from("/test/steam.exe"))
        );
    }

    #[test]
    fn test_steam_store_get_client_path_none() {
        let paths = SteamPaths {
            steam_path: None,
            steam_exe: None,
        };
        let store = SteamStore::with_paths(paths);
        assert!(store.get_client_path().is_none());
    }

    #[test]
    fn test_get_installed_games_empty() {
        let (_temp, paths) = create_test_steam_dir();
        let store = SteamStore::with_paths(paths);
        let games = store.get_installed_games().unwrap();
        assert!(games.is_empty());
    }

    #[test]
    fn test_get_installed_games_with_manifest() {
        let (temp, paths) = create_test_steam_dir();

        // Create a test appmanifest file
        let steamapps = temp.path().join("steamapps");
        let manifest_content = r#"
"AppState"
{
    "appid"        "12345"
    "name"         "Test Game"
    "installdir"   "TestGame"
    "SizeOnDisk"   "1073741824"
}
"#;
        fs::write(steamapps.join("appmanifest_12345.acf"), manifest_content).unwrap();

        let store = SteamStore::with_paths(paths);
        let games = store.get_installed_games().unwrap();
        assert_eq!(games.len(), 1);
        assert_eq!(games[0].id, "12345");
        assert_eq!(games[0].name, "Test Game");
        assert!(games[0].installed);
    }

    #[test]
    fn test_get_installed_games_multiple() {
        let (temp, paths) = create_test_steam_dir();
        let steamapps = temp.path().join("steamapps");

        let manifest1 = r#"
"AppState"
{
    "appid"        "111"
    "name"         "Game One"
    "installdir"   "GameOne"
}
"#;
        let manifest2 = r#"
"AppState"
{
    "appid"        "222"
    "name"         "Game Two"
    "installdir"   "GameTwo"
}
"#;

        fs::write(steamapps.join("appmanifest_111.acf"), manifest1).unwrap();
        fs::write(steamapps.join("appmanifest_222.acf"), manifest2).unwrap();

        let store = SteamStore::with_paths(paths);
        let games = store.get_installed_games().unwrap();
        assert_eq!(games.len(), 2);
    }

    #[test]
    fn test_get_installed_games_no_steam_path() {
        let paths = SteamPaths {
            steam_path: None,
            steam_exe: None,
        };
        let store = SteamStore::with_paths(paths);
        let games = store.get_installed_games().unwrap();
        assert!(games.is_empty());
    }

    #[test]
    fn test_get_artwork_url_cover() {
        let store = SteamStore::new();
        let url = store.get_artwork_url("12345", ArtworkType::Cover);
        assert!(url.is_some());
        assert!(url.unwrap().contains("library_600x900.jpg"));
    }

    #[test]
    fn test_get_artwork_url_hero() {
        let store = SteamStore::new();
        let url = store.get_artwork_url("12345", ArtworkType::Hero);
        assert!(url.is_some());
        assert!(url.unwrap().contains("library_hero.jpg"));
    }

    #[test]
    fn test_get_artwork_url_logo() {
        let store = SteamStore::new();
        let url = store.get_artwork_url("12345", ArtworkType::Logo);
        assert!(url.is_some());
        assert!(url.unwrap().contains("logo.png"));
    }

    #[test]
    fn test_get_artwork_url_icon() {
        let store = SteamStore::new();
        let url = store.get_artwork_url("12345", ArtworkType::Icon);
        assert!(url.is_some());
        assert!(url.unwrap().contains("header.jpg"));
    }

    #[test]
    fn test_launch_game_no_steam() {
        let paths = SteamPaths {
            steam_path: None,
            steam_exe: None,
        };
        let store = SteamStore::with_paths(paths);
        let result = store.launch_game("12345");
        assert!(matches!(result, Err(LauncherError::LaunchError(_))));
    }

    #[test]
    fn test_steam_cdn_url_cover() {
        let url = SteamStore::get_steam_cdn_url("440", ArtworkType::Cover);
        assert_eq!(
            url,
            "https://steamcdn-a.akamaihd.net/steam/apps/440/library_600x900.jpg"
        );
    }

    #[test]
    fn test_steam_cdn_url_hero() {
        let url = SteamStore::get_steam_cdn_url("440", ArtworkType::Hero);
        assert_eq!(
            url,
            "https://steamcdn-a.akamaihd.net/steam/apps/440/library_hero.jpg"
        );
    }

    #[test]
    fn test_steam_cdn_url_logo() {
        let url = SteamStore::get_steam_cdn_url("440", ArtworkType::Logo);
        assert_eq!(
            url,
            "https://steamcdn-a.akamaihd.net/steam/apps/440/logo.png"
        );
    }

    #[test]
    fn test_steam_cdn_url_icon() {
        let url = SteamStore::get_steam_cdn_url("440", ArtworkType::Icon);
        assert_eq!(
            url,
            "https://steamcdn-a.akamaihd.net/steam/apps/440/header.jpg"
        );
    }
}
