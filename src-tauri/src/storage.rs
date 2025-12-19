use crate::launcher_core::{Game, LauncherError};
use crate::stores::steam::api::SteamCredentials;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

use std::collections::HashMap;

const APP_DIR: &str = "tenfoot";
const CREDENTIALS_FILE: &str = "credentials.json";
const GAMES_CACHE_FILE: &str = "games_cache.json";
const PLAY_HISTORY_FILE: &str = "play_history.json";
const SETTINGS_FILE: &str = "settings.json";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StoredCredentials {
    pub steam: Option<SteamCredentials>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GamesCache {
    pub steam_owned: Vec<Game>,
    pub last_sync: Option<u64>,
}

/// Play history entry for a game
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GamePlayEntry {
    pub last_played: Option<u64>,
    pub installed_at: Option<u64>,
}

/// Play history across all games (keyed by unique_key like "steam:123")
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct PlayHistory {
    pub games: HashMap<String, GamePlayEntry>,
}

/// Application settings
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct AppSettings {
    pub launch_on_startup: bool,
    pub launch_fullscreen: bool,
}

pub struct Storage {
    data_dir: PathBuf,
}

impl Storage {
    pub fn new() -> Result<Self, LauncherError> {
        let data_dir = dirs::data_dir()
            .ok_or_else(|| LauncherError::ConfigError("Could not find data directory".to_string()))?
            .join(APP_DIR);

        fs::create_dir_all(&data_dir)
            .map_err(|e| LauncherError::ConfigError(format!("Failed to create data dir: {e}")))?;

        Ok(Self { data_dir })
    }

    fn credentials_path(&self) -> PathBuf {
        self.data_dir.join(CREDENTIALS_FILE)
    }

    fn cache_path(&self) -> PathBuf {
        self.data_dir.join(GAMES_CACHE_FILE)
    }

    fn play_history_path(&self) -> PathBuf {
        self.data_dir.join(PLAY_HISTORY_FILE)
    }

    fn settings_path(&self) -> PathBuf {
        self.data_dir.join(SETTINGS_FILE)
    }

    pub fn load_credentials(&self) -> Result<StoredCredentials, LauncherError> {
        let path = self.credentials_path();
        if !path.exists() {
            return Ok(StoredCredentials::default());
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| LauncherError::ConfigError(format!("Failed to read credentials: {e}")))?;

        serde_json::from_str(&content)
            .map_err(|e| LauncherError::ParseError(format!("Failed to parse credentials: {e}")))
    }

    pub fn save_credentials(&self, credentials: &StoredCredentials) -> Result<(), LauncherError> {
        let path = self.credentials_path();
        let content = serde_json::to_string_pretty(credentials).map_err(|e| {
            LauncherError::ParseError(format!("Failed to serialize credentials: {e}"))
        })?;

        fs::write(&path, content)
            .map_err(|e| LauncherError::ConfigError(format!("Failed to write credentials: {e}")))
    }

    pub fn load_games_cache(&self) -> Result<GamesCache, LauncherError> {
        let path = self.cache_path();
        if !path.exists() {
            return Ok(GamesCache::default());
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| LauncherError::ConfigError(format!("Failed to read cache: {e}")))?;

        serde_json::from_str(&content)
            .map_err(|e| LauncherError::ParseError(format!("Failed to parse cache: {e}")))
    }

    pub fn save_games_cache(&self, cache: &GamesCache) -> Result<(), LauncherError> {
        let path = self.cache_path();
        let content = serde_json::to_string_pretty(cache)
            .map_err(|e| LauncherError::ParseError(format!("Failed to serialize cache: {e}")))?;

        fs::write(&path, content)
            .map_err(|e| LauncherError::ConfigError(format!("Failed to write cache: {e}")))
    }

    pub fn clear_steam_data(&self) -> Result<(), LauncherError> {
        let mut creds = self.load_credentials()?;
        creds.steam = None;
        self.save_credentials(&creds)?;

        let mut cache = self.load_games_cache()?;
        cache.steam_owned = Vec::new();
        cache.last_sync = None;
        self.save_games_cache(&cache)?;

        Ok(())
    }

    pub fn load_play_history(&self) -> Result<PlayHistory, LauncherError> {
        let path = self.play_history_path();
        if !path.exists() {
            return Ok(PlayHistory::default());
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| LauncherError::ConfigError(format!("Failed to read play history: {e}")))?;

        serde_json::from_str(&content)
            .map_err(|e| LauncherError::ParseError(format!("Failed to parse play history: {e}")))
    }

    pub fn save_play_history(&self, history: &PlayHistory) -> Result<(), LauncherError> {
        let path = self.play_history_path();
        let content = serde_json::to_string_pretty(history).map_err(|e| {
            LauncherError::ParseError(format!("Failed to serialize play history: {e}"))
        })?;

        fs::write(&path, content)
            .map_err(|e| LauncherError::ConfigError(format!("Failed to write play history: {e}")))
    }

    /// Record that a game was launched (updates last_played timestamp)
    pub fn record_game_launch(&self, game_key: &str) -> Result<(), LauncherError> {
        use std::time::{SystemTime, UNIX_EPOCH};

        let mut history = self.load_play_history()?;
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        let entry = history.games.entry(game_key.to_string()).or_default();
        entry.last_played = Some(now);

        self.save_play_history(&history)
    }

    /// Record when a game was first detected as installed
    pub fn record_game_installed(&self, game_key: &str) -> Result<(), LauncherError> {
        use std::time::{SystemTime, UNIX_EPOCH};

        let mut history = self.load_play_history()?;

        let entry = history.games.entry(game_key.to_string()).or_default();
        // Only set installed_at if not already set
        if entry.installed_at.is_none() {
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            entry.installed_at = Some(now);
            self.save_play_history(&history)?;
        }

        Ok(())
    }

    /// Get play entry for a game
    pub fn get_game_play_entry(
        &self,
        game_key: &str,
    ) -> Result<Option<GamePlayEntry>, LauncherError> {
        let history = self.load_play_history()?;
        Ok(history.games.get(game_key).cloned())
    }

    pub fn load_settings(&self) -> Result<AppSettings, LauncherError> {
        let path = self.settings_path();
        if !path.exists() {
            return Ok(AppSettings::default());
        }

        let content = fs::read_to_string(&path)
            .map_err(|e| LauncherError::ConfigError(format!("Failed to read settings: {e}")))?;

        serde_json::from_str(&content)
            .map_err(|e| LauncherError::ParseError(format!("Failed to parse settings: {e}")))
    }

    pub fn save_settings(&self, settings: &AppSettings) -> Result<(), LauncherError> {
        let path = self.settings_path();
        let content = serde_json::to_string_pretty(settings)
            .map_err(|e| LauncherError::ParseError(format!("Failed to serialize settings: {e}")))?;

        fs::write(&path, content)
            .map_err(|e| LauncherError::ConfigError(format!("Failed to write settings: {e}")))
    }
}

impl Default for Storage {
    fn default() -> Self {
        Self::new().expect("Failed to initialize storage")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_storage() -> (TempDir, Storage) {
        let temp = TempDir::new().unwrap();
        let storage = Storage {
            data_dir: temp.path().to_path_buf(),
        };
        (temp, storage)
    }

    #[test]
    fn test_storage_new() {
        let result = Storage::new();
        assert!(result.is_ok());
    }

    #[test]
    fn test_load_empty_credentials() {
        let (_temp, storage) = create_test_storage();
        let creds = storage.load_credentials().unwrap();
        assert!(creds.steam.is_none());
    }

    #[test]
    fn test_save_and_load_credentials() {
        let (_temp, storage) = create_test_storage();

        let creds = StoredCredentials {
            steam: Some(SteamCredentials {
                api_key: "test_key".to_string(),
                steam_id: "12345".to_string(),
            }),
        };

        storage.save_credentials(&creds).unwrap();
        let loaded = storage.load_credentials().unwrap();

        assert!(loaded.steam.is_some());
        let steam = loaded.steam.unwrap();
        assert_eq!(steam.api_key, "test_key");
        assert_eq!(steam.steam_id, "12345");
    }

    #[test]
    fn test_load_empty_cache() {
        let (_temp, storage) = create_test_storage();
        let cache = storage.load_games_cache().unwrap();
        assert!(cache.steam_owned.is_empty());
        assert!(cache.last_sync.is_none());
    }

    #[test]
    fn test_save_and_load_cache() {
        let (_temp, storage) = create_test_storage();

        let mut cache = GamesCache::default();
        cache.steam_owned.push(Game::new(
            "123",
            "Test Game",
            crate::launcher_core::StoreType::Steam,
        ));
        cache.last_sync = Some(1234567890);

        storage.save_games_cache(&cache).unwrap();
        let loaded = storage.load_games_cache().unwrap();

        assert_eq!(loaded.steam_owned.len(), 1);
        assert_eq!(loaded.steam_owned[0].name, "Test Game");
        assert_eq!(loaded.last_sync, Some(1234567890));
    }

    #[test]
    fn test_clear_steam_data() {
        let (_temp, storage) = create_test_storage();

        // Set up some data
        let creds = StoredCredentials {
            steam: Some(SteamCredentials {
                api_key: "key".to_string(),
                steam_id: "id".to_string(),
            }),
        };
        storage.save_credentials(&creds).unwrap();

        let mut cache = GamesCache::default();
        cache.steam_owned.push(Game::new(
            "1",
            "Game",
            crate::launcher_core::StoreType::Steam,
        ));
        storage.save_games_cache(&cache).unwrap();

        // Clear
        storage.clear_steam_data().unwrap();

        // Verify cleared
        let loaded_creds = storage.load_credentials().unwrap();
        assert!(loaded_creds.steam.is_none());

        let loaded_cache = storage.load_games_cache().unwrap();
        assert!(loaded_cache.steam_owned.is_empty());
    }
}
