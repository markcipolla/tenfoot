mod database;
mod paths;

use crate::launcher_core::store::ArtworkType;
use crate::launcher_core::{Game, GameStore, LauncherError};
use std::path::PathBuf;
use std::process::Command;

pub use database::query_installed_games;
pub use paths::GogPaths;

/// GOG Galaxy store integration
pub struct GogStore {
    paths: GogPaths,
}

impl GogStore {
    /// Create a new GOG store instance
    pub fn new() -> Self {
        Self {
            paths: GogPaths::detect(),
        }
    }

    /// Create a GOG store with custom paths (for testing)
    pub fn with_paths(paths: GogPaths) -> Self {
        Self { paths }
    }

    /// Scan GOG Galaxy database for installed games
    fn scan_installed_games(&self) -> Result<Vec<Game>, LauncherError> {
        let db_path = match &self.paths.database_path {
            Some(path) => path,
            None => return Ok(Vec::new()),
        };

        if !db_path.exists() {
            return Ok(Vec::new());
        }

        query_installed_games(db_path)
    }
}

impl Default for GogStore {
    fn default() -> Self {
        Self::new()
    }
}

impl GameStore for GogStore {
    fn store_id(&self) -> &'static str {
        "gog"
    }

    fn display_name(&self) -> &'static str {
        "GOG Galaxy"
    }

    fn is_available(&self) -> bool {
        self.paths.galaxy_path.is_some()
    }

    fn get_client_path(&self) -> Option<PathBuf> {
        self.paths.galaxy_exe.clone()
    }

    fn get_installed_games(&self) -> Result<Vec<Game>, LauncherError> {
        self.scan_installed_games()
    }

    fn launch_game(&self, game_id: &str) -> Result<(), LauncherError> {
        // GOG games can be launched via protocol URL
        let launch_url = format!("goggalaxy://runGame/{game_id}");

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
            Command::new("xdg-open")
                .arg(&launch_url)
                .spawn()
                .map_err(|e| LauncherError::LaunchError(e.to_string()))?;
        }

        Ok(())
    }

    fn get_artwork_url(&self, game_id: &str, art_type: ArtworkType) -> Option<String> {
        // GOG has a CDN for artwork
        match art_type {
            ArtworkType::Cover => Some(format!(
                "https://images.gog-statics.com/{game_id}_cover.jpg"
            )),
            ArtworkType::Hero => Some(format!(
                "https://images.gog-statics.com/{game_id}_background.jpg"
            )),
            ArtworkType::Icon => Some(format!("https://images.gog-statics.com/{game_id}_icon.png")),
            ArtworkType::Logo => Some(format!("https://images.gog-statics.com/{game_id}_logo.png")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[allow(dead_code)]
    fn create_test_gog_dir() -> (TempDir, GogPaths) {
        let temp = TempDir::new().unwrap();
        let storage = temp.path().join("storage");
        fs::create_dir_all(&storage).unwrap();

        let paths = GogPaths {
            galaxy_path: Some(temp.path().to_path_buf()),
            galaxy_exe: Some(temp.path().join("GalaxyClient.exe")),
            database_path: Some(storage.join("galaxy-2.0.db")),
        };

        (temp, paths)
    }

    #[test]
    fn test_gog_store_new() {
        let store = GogStore::new();
        assert_eq!(store.store_id(), "gog");
        assert_eq!(store.display_name(), "GOG Galaxy");
    }

    #[test]
    fn test_gog_store_default() {
        let store = GogStore::default();
        assert_eq!(store.store_id(), "gog");
    }

    #[test]
    fn test_gog_store_with_paths() {
        let paths = GogPaths {
            galaxy_path: Some(PathBuf::from("/test")),
            galaxy_exe: Some(PathBuf::from("/test/galaxy.exe")),
            database_path: Some(PathBuf::from("/test/db.db")),
        };
        let store = GogStore::with_paths(paths);
        assert!(store.is_available());
    }

    #[test]
    fn test_gog_store_not_available() {
        let paths = GogPaths {
            galaxy_path: None,
            galaxy_exe: None,
            database_path: None,
        };
        let store = GogStore::with_paths(paths);
        assert!(!store.is_available());
    }

    #[test]
    fn test_gog_store_get_client_path() {
        let paths = GogPaths {
            galaxy_path: Some(PathBuf::from("/test")),
            galaxy_exe: Some(PathBuf::from("/test/galaxy.exe")),
            database_path: None,
        };
        let store = GogStore::with_paths(paths);
        assert_eq!(
            store.get_client_path(),
            Some(PathBuf::from("/test/galaxy.exe"))
        );
    }

    #[test]
    fn test_gog_store_get_client_path_none() {
        let paths = GogPaths {
            galaxy_path: None,
            galaxy_exe: None,
            database_path: None,
        };
        let store = GogStore::with_paths(paths);
        assert!(store.get_client_path().is_none());
    }

    #[test]
    fn test_get_installed_games_no_database() {
        let paths = GogPaths {
            galaxy_path: None,
            galaxy_exe: None,
            database_path: None,
        };
        let store = GogStore::with_paths(paths);
        let games = store.get_installed_games().unwrap();
        assert!(games.is_empty());
    }

    #[test]
    fn test_get_installed_games_database_not_exists() {
        let paths = GogPaths {
            galaxy_path: Some(PathBuf::from("/test")),
            galaxy_exe: None,
            database_path: Some(PathBuf::from("/nonexistent/db.db")),
        };
        let store = GogStore::with_paths(paths);
        let games = store.get_installed_games().unwrap();
        assert!(games.is_empty());
    }

    #[test]
    fn test_get_artwork_url_cover() {
        let store = GogStore::new();
        let url = store.get_artwork_url("12345", ArtworkType::Cover);
        assert!(url.is_some());
        let url_str = url.unwrap();
        assert!(url_str.contains("12345"));
        assert!(url_str.contains("cover"));
    }

    #[test]
    fn test_get_artwork_url_hero() {
        let store = GogStore::new();
        let url = store.get_artwork_url("12345", ArtworkType::Hero);
        assert!(url.is_some());
        assert!(url.unwrap().contains("background"));
    }

    #[test]
    fn test_get_artwork_url_icon() {
        let store = GogStore::new();
        let url = store.get_artwork_url("12345", ArtworkType::Icon);
        assert!(url.is_some());
        assert!(url.unwrap().contains("icon"));
    }

    #[test]
    fn test_get_artwork_url_logo() {
        let store = GogStore::new();
        let url = store.get_artwork_url("12345", ArtworkType::Logo);
        assert!(url.is_some());
        assert!(url.unwrap().contains("logo"));
    }
}
