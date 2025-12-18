use crate::launcher_core::{Game, GameStore, LauncherError};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};

/// Central game library that aggregates games from all stores
pub struct GameLibrary {
    stores: HashMap<&'static str, Arc<RwLock<Box<dyn GameStore>>>>,
    games: RwLock<Vec<Game>>,
}

impl GameLibrary {
    /// Create a new empty game library
    pub fn new() -> Self {
        Self {
            stores: HashMap::new(),
            games: RwLock::new(Vec::new()),
        }
    }

    /// Register a store with the library
    pub fn register_store(&mut self, store: Box<dyn GameStore>) {
        let store_id = store.store_id();
        self.stores.insert(store_id, Arc::new(RwLock::new(store)));
    }

    /// Refresh games from all registered stores
    pub fn refresh_all(&self) -> Result<Vec<Game>, LauncherError> {
        let mut all_games = Vec::new();

        for (store_id, store) in &self.stores {
            let store_guard = store.read().map_err(|_| {
                LauncherError::StoreNotFound(format!("Failed to lock store: {store_id}"))
            })?;

            if store_guard.is_available() {
                match store_guard.get_installed_games() {
                    Ok(games) => all_games.extend(games),
                    Err(e) => {
                        log::warn!("Failed to get games from {store_id}: {e}");
                    }
                }
            }
        }

        // Sort by name
        all_games.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

        // Update cached games
        let mut games_guard = self
            .games
            .write()
            .map_err(|_| LauncherError::ParseError("Failed to acquire write lock".to_string()))?;
        *games_guard = all_games.clone();

        Ok(all_games)
    }

    /// Get all cached games
    pub fn get_games(&self) -> Vec<Game> {
        self.games.read().map(|g| g.clone()).unwrap_or_default()
    }

    /// Get only installed games
    pub fn get_installed_games(&self) -> Vec<Game> {
        self.games
            .read()
            .map(|games| games.iter().filter(|g| g.installed).cloned().collect())
            .unwrap_or_default()
    }

    /// Find a game by its unique key (store:id)
    pub fn find_game(&self, unique_key: &str) -> Option<Game> {
        self.games
            .read()
            .ok()?
            .iter()
            .find(|g| g.unique_key() == unique_key)
            .cloned()
    }

    /// Launch a game by its unique key
    pub fn launch_game(&self, unique_key: &str) -> Result<(), LauncherError> {
        let parts: Vec<&str> = unique_key.splitn(2, ':').collect();
        if parts.len() != 2 {
            return Err(LauncherError::GameNotFound(unique_key.to_string()));
        }

        let store_id = parts[0];
        let game_id = parts[1];

        let store = self
            .stores
            .get(store_id)
            .ok_or_else(|| LauncherError::StoreNotFound(store_id.to_string()))?;

        let store_guard = store.read().map_err(|_| {
            LauncherError::StoreNotFound(format!("Failed to lock store: {store_id}"))
        })?;

        store_guard.launch_game(game_id)
    }

    /// Get list of available stores
    pub fn get_available_stores(&self) -> Vec<&'static str> {
        self.stores
            .iter()
            .filter_map(|(id, store)| {
                store
                    .read()
                    .ok()
                    .and_then(|s| if s.is_available() { Some(*id) } else { None })
            })
            .collect()
    }

    /// Get count of registered stores
    pub fn store_count(&self) -> usize {
        self.stores.len()
    }
}

impl Default for GameLibrary {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::launcher_core::{store::ArtworkType, StoreType};
    use std::path::PathBuf;

    // Mock store for testing
    struct MockStore {
        available: bool,
        games: Vec<Game>,
        launch_result: Result<(), LauncherError>,
    }

    impl MockStore {
        fn new(available: bool) -> Self {
            Self {
                available,
                games: Vec::new(),
                launch_result: Ok(()),
            }
        }

        fn with_games(mut self, games: Vec<Game>) -> Self {
            self.games = games;
            self
        }

        fn with_launch_error(mut self, err: LauncherError) -> Self {
            self.launch_result = Err(err);
            self
        }
    }

    impl GameStore for MockStore {
        fn store_id(&self) -> &'static str {
            "mock"
        }

        fn display_name(&self) -> &'static str {
            "Mock Store"
        }

        fn is_available(&self) -> bool {
            self.available
        }

        fn get_client_path(&self) -> Option<PathBuf> {
            if self.available {
                Some(PathBuf::from("/mock/path"))
            } else {
                None
            }
        }

        fn get_installed_games(&self) -> Result<Vec<Game>, LauncherError> {
            Ok(self.games.clone())
        }

        fn launch_game(&self, _game_id: &str) -> Result<(), LauncherError> {
            self.launch_result.clone()
        }

        fn get_artwork_url(&self, game_id: &str, art_type: ArtworkType) -> Option<String> {
            match art_type {
                ArtworkType::Cover => Some(format!("https://mock.com/{game_id}/cover.jpg")),
                _ => None,
            }
        }
    }

    #[test]
    fn test_new_library() {
        let lib = GameLibrary::new();
        assert_eq!(lib.store_count(), 0);
        assert!(lib.get_games().is_empty());
    }

    #[test]
    fn test_default_library() {
        let lib = GameLibrary::default();
        assert_eq!(lib.store_count(), 0);
    }

    #[test]
    fn test_register_store() {
        let mut lib = GameLibrary::new();
        lib.register_store(Box::new(MockStore::new(true)));
        assert_eq!(lib.store_count(), 1);
    }

    #[test]
    fn test_get_available_stores() {
        let mut lib = GameLibrary::new();
        lib.register_store(Box::new(MockStore::new(true)));
        let stores = lib.get_available_stores();
        assert_eq!(stores.len(), 1);
        assert_eq!(stores[0], "mock");
    }

    #[test]
    fn test_get_available_stores_unavailable() {
        let mut lib = GameLibrary::new();
        lib.register_store(Box::new(MockStore::new(false)));
        let stores = lib.get_available_stores();
        assert!(stores.is_empty());
    }

    #[test]
    fn test_refresh_all_empty() {
        let mut lib = GameLibrary::new();
        lib.register_store(Box::new(MockStore::new(true)));
        let games = lib.refresh_all().unwrap();
        assert!(games.is_empty());
    }

    #[test]
    fn test_refresh_all_with_games() {
        let mut lib = GameLibrary::new();
        let game = Game::new("123", "Test Game", StoreType::Steam);
        lib.register_store(Box::new(MockStore::new(true).with_games(vec![game])));

        let games = lib.refresh_all().unwrap();
        assert_eq!(games.len(), 1);
        assert_eq!(games[0].name, "Test Game");
    }

    #[test]
    fn test_refresh_sorts_by_name() {
        let mut lib = GameLibrary::new();
        let game1 = Game::new("1", "Zelda", StoreType::Steam);
        let game2 = Game::new("2", "Apex", StoreType::Steam);
        lib.register_store(Box::new(
            MockStore::new(true).with_games(vec![game1, game2]),
        ));

        let games = lib.refresh_all().unwrap();
        assert_eq!(games[0].name, "Apex");
        assert_eq!(games[1].name, "Zelda");
    }

    #[test]
    fn test_get_games_returns_cached() {
        let mut lib = GameLibrary::new();
        let game = Game::new("123", "Test Game", StoreType::Steam);
        lib.register_store(Box::new(MockStore::new(true).with_games(vec![game])));

        lib.refresh_all().unwrap();
        let games = lib.get_games();
        assert_eq!(games.len(), 1);
    }

    #[test]
    fn test_get_installed_games() {
        let mut lib = GameLibrary::new();
        let mut game1 = Game::new("1", "Installed", StoreType::Steam);
        game1.installed = true;
        let game2 = Game::new("2", "Not Installed", StoreType::Steam);

        lib.register_store(Box::new(
            MockStore::new(true).with_games(vec![game1, game2]),
        ));
        lib.refresh_all().unwrap();

        let installed = lib.get_installed_games();
        assert_eq!(installed.len(), 1);
        assert_eq!(installed[0].name, "Installed");
    }

    #[test]
    fn test_find_game() {
        let mut lib = GameLibrary::new();
        let game = Game::new("123", "Test Game", StoreType::Steam);
        lib.register_store(Box::new(MockStore::new(true).with_games(vec![game])));
        lib.refresh_all().unwrap();

        // Note: MockStore uses "mock" as store_id, but game has StoreType::Steam
        // so unique_key would be "steam:123"
        let found = lib.find_game("steam:123");
        assert!(found.is_some());
        assert_eq!(found.unwrap().name, "Test Game");
    }

    #[test]
    fn test_find_game_not_found() {
        let lib = GameLibrary::new();
        let found = lib.find_game("steam:nonexistent");
        assert!(found.is_none());
    }

    #[test]
    fn test_launch_game_invalid_key() {
        let lib = GameLibrary::new();
        let result = lib.launch_game("invalid_key");
        assert!(result.is_err());
    }

    #[test]
    fn test_launch_game_store_not_found() {
        let lib = GameLibrary::new();
        let result = lib.launch_game("unknown:123");
        assert!(matches!(result, Err(LauncherError::StoreNotFound(_))));
    }

    #[test]
    fn test_launch_game_success() {
        let mut lib = GameLibrary::new();
        lib.register_store(Box::new(MockStore::new(true)));

        let result = lib.launch_game("mock:123");
        assert!(result.is_ok());
    }

    #[test]
    fn test_launch_game_failure() {
        let mut lib = GameLibrary::new();
        lib.register_store(Box::new(
            MockStore::new(true).with_launch_error(LauncherError::LaunchError("Failed".into())),
        ));

        let result = lib.launch_game("mock:123");
        assert!(matches!(result, Err(LauncherError::LaunchError(_))));
    }

    #[test]
    fn test_unavailable_store_skipped_in_refresh() {
        let mut lib = GameLibrary::new();
        let game = Game::new("123", "Test", StoreType::Steam);
        lib.register_store(Box::new(MockStore::new(false).with_games(vec![game])));

        let games = lib.refresh_all().unwrap();
        assert!(games.is_empty());
    }
}
