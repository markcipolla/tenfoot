use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Represents which store a game belongs to
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum StoreType {
    Steam,
    Epic,
    Gog,
}

impl std::fmt::Display for StoreType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StoreType::Steam => write!(f, "Steam"),
            StoreType::Epic => write!(f, "Epic"),
            StoreType::Gog => write!(f, "GOG"),
        }
    }
}

/// Unified game representation across all stores
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Game {
    /// Unique identifier within the store (AppID for Steam, AppName for Epic, etc.)
    pub id: String,

    /// Display name of the game
    pub name: String,

    /// Which store this game belongs to
    pub store: StoreType,

    /// Whether the game is currently installed
    pub installed: bool,

    /// Installation path (if installed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub install_path: Option<PathBuf>,

    /// Main executable path (if known)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executable: Option<PathBuf>,

    /// Total playtime in minutes (if available)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub playtime_minutes: Option<u64>,

    /// Last played timestamp (Unix epoch)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_played: Option<u64>,

    /// URL or path to game cover art
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cover_url: Option<String>,

    /// URL or path to game hero/banner art
    #[serde(skip_serializing_if = "Option::is_none")]
    pub hero_url: Option<String>,

    /// URL or path to game icon
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon_url: Option<String>,

    /// Size on disk in bytes (if installed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub size_bytes: Option<u64>,

    /// Version string (if available)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,

    /// When the game was first detected/installed (Unix epoch)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub installed_at: Option<u64>,
}

impl Game {
    /// Create a new Game with minimal required fields
    pub fn new(id: impl Into<String>, name: impl Into<String>, store: StoreType) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            store,
            installed: false,
            install_path: None,
            executable: None,
            playtime_minutes: None,
            last_played: None,
            cover_url: None,
            hero_url: None,
            icon_url: None,
            size_bytes: None,
            version: None,
            installed_at: None,
        }
    }

    /// Create a unique key for this game across all stores
    pub fn unique_key(&self) -> String {
        format!("{}:{}", self.store.to_string().to_lowercase(), self.id)
    }

    /// Check if this game can be launched
    pub fn can_launch(&self) -> bool {
        self.installed
    }

    /// Set the game as installed with a path
    pub fn set_installed(&mut self, path: PathBuf) {
        self.installed = true;
        self.install_path = Some(path);
    }

    /// Set the executable path
    pub fn set_executable(&mut self, exe: PathBuf) {
        self.executable = Some(exe);
    }

    /// Set playtime in minutes
    pub fn set_playtime(&mut self, minutes: u64) {
        self.playtime_minutes = Some(minutes);
    }

    /// Set the cover artwork URL
    pub fn set_cover_url(&mut self, url: impl Into<String>) {
        self.cover_url = Some(url.into());
    }

    /// Set the hero/banner artwork URL
    pub fn set_hero_url(&mut self, url: impl Into<String>) {
        self.hero_url = Some(url.into());
    }

    /// Set the icon URL
    pub fn set_icon_url(&mut self, url: impl Into<String>) {
        self.icon_url = Some(url.into());
    }

    /// Set the size on disk in bytes
    pub fn set_size(&mut self, bytes: u64) {
        self.size_bytes = Some(bytes);
    }

    /// Set the version string
    pub fn set_version(&mut self, version: impl Into<String>) {
        self.version = Some(version.into());
    }
}

/// Game metadata for artwork fetching
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct GameArtwork {
    pub cover: Option<String>,
    pub hero: Option<String>,
    pub logo: Option<String>,
    pub icon: Option<String>,
}

impl GameArtwork {
    /// Create a new empty GameArtwork
    pub fn new() -> Self {
        Self {
            cover: None,
            hero: None,
            logo: None,
            icon: None,
        }
    }

    /// Check if any artwork is available
    pub fn has_any(&self) -> bool {
        self.cover.is_some() || self.hero.is_some() || self.logo.is_some() || self.icon.is_some()
    }
}

impl Default for GameArtwork {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_store_type_display() {
        assert_eq!(format!("{}", StoreType::Steam), "Steam");
        assert_eq!(format!("{}", StoreType::Epic), "Epic");
        assert_eq!(format!("{}", StoreType::Gog), "GOG");
    }

    #[test]
    fn test_store_type_equality() {
        assert_eq!(StoreType::Steam, StoreType::Steam);
        assert_ne!(StoreType::Steam, StoreType::Epic);
    }

    #[test]
    fn test_store_type_clone() {
        let store = StoreType::Gog;
        let cloned = store.clone();
        assert_eq!(store, cloned);
    }

    #[test]
    fn test_store_type_debug() {
        let debug = format!("{:?}", StoreType::Steam);
        assert_eq!(debug, "Steam");
    }

    #[test]
    fn test_store_type_hash() {
        use std::collections::HashSet;
        let mut set = HashSet::new();
        set.insert(StoreType::Steam);
        set.insert(StoreType::Epic);
        assert!(set.contains(&StoreType::Steam));
        assert!(!set.contains(&StoreType::Gog));
    }

    #[test]
    fn test_store_type_serialization() {
        let store = StoreType::Steam;
        let json = serde_json::to_string(&store).unwrap();
        assert_eq!(json, "\"steam\"");
    }

    #[test]
    fn test_store_type_deserialization() {
        let store: StoreType = serde_json::from_str("\"epic\"").unwrap();
        assert_eq!(store, StoreType::Epic);
    }

    #[test]
    fn test_game_new() {
        let game = Game::new("12345", "Test Game", StoreType::Steam);
        assert_eq!(game.id, "12345");
        assert_eq!(game.name, "Test Game");
        assert_eq!(game.store, StoreType::Steam);
        assert!(!game.installed);
        assert!(game.install_path.is_none());
    }

    #[test]
    fn test_game_unique_key() {
        let game = Game::new("12345", "Test", StoreType::Steam);
        assert_eq!(game.unique_key(), "steam:12345");

        let game = Game::new("abc", "Test", StoreType::Epic);
        assert_eq!(game.unique_key(), "epic:abc");

        let game = Game::new("xyz", "Test", StoreType::Gog);
        assert_eq!(game.unique_key(), "gog:xyz");
    }

    #[test]
    fn test_game_can_launch() {
        let mut game = Game::new("1", "Test", StoreType::Steam);
        assert!(!game.can_launch());

        game.installed = true;
        assert!(game.can_launch());
    }

    #[test]
    fn test_game_set_installed() {
        let mut game = Game::new("1", "Test", StoreType::Steam);
        game.set_installed(PathBuf::from("/games/test"));
        assert!(game.installed);
        assert_eq!(game.install_path, Some(PathBuf::from("/games/test")));
    }

    #[test]
    fn test_game_set_executable() {
        let mut game = Game::new("1", "Test", StoreType::Steam);
        game.set_executable(PathBuf::from("/games/test/game.exe"));
        assert_eq!(game.executable, Some(PathBuf::from("/games/test/game.exe")));
    }

    #[test]
    fn test_game_set_playtime() {
        let mut game = Game::new("1", "Test", StoreType::Steam);
        game.set_playtime(120);
        assert_eq!(game.playtime_minutes, Some(120));
    }

    #[test]
    fn test_game_set_cover_url() {
        let mut game = Game::new("1", "Test", StoreType::Steam);
        game.set_cover_url("https://example.com/cover.jpg");
        assert_eq!(
            game.cover_url,
            Some("https://example.com/cover.jpg".to_string())
        );
    }

    #[test]
    fn test_game_set_hero_url() {
        let mut game = Game::new("1", "Test", StoreType::Steam);
        game.set_hero_url("https://example.com/hero.jpg");
        assert_eq!(
            game.hero_url,
            Some("https://example.com/hero.jpg".to_string())
        );
    }

    #[test]
    fn test_game_set_icon_url() {
        let mut game = Game::new("1", "Test", StoreType::Steam);
        game.set_icon_url("https://example.com/icon.png");
        assert_eq!(
            game.icon_url,
            Some("https://example.com/icon.png".to_string())
        );
    }

    #[test]
    fn test_game_set_size() {
        let mut game = Game::new("1", "Test", StoreType::Steam);
        game.set_size(1024 * 1024 * 1024); // 1GB
        assert_eq!(game.size_bytes, Some(1073741824));
    }

    #[test]
    fn test_game_set_version() {
        let mut game = Game::new("1", "Test", StoreType::Steam);
        game.set_version("1.2.3");
        assert_eq!(game.version, Some("1.2.3".to_string()));
    }

    #[test]
    fn test_game_clone() {
        let game = Game::new("1", "Test", StoreType::Steam);
        let cloned = game.clone();
        assert_eq!(game.id, cloned.id);
        assert_eq!(game.name, cloned.name);
    }

    #[test]
    fn test_game_debug() {
        let game = Game::new("1", "Test", StoreType::Steam);
        let debug = format!("{:?}", game);
        assert!(debug.contains("Test"));
        assert!(debug.contains("Steam"));
    }

    #[test]
    fn test_game_serialization() {
        let game = Game::new("12345", "Test Game", StoreType::Steam);
        let json = serde_json::to_string(&game).unwrap();
        assert!(json.contains("\"id\":\"12345\""));
        assert!(json.contains("\"name\":\"Test Game\""));
        assert!(json.contains("\"store\":\"steam\""));
    }

    #[test]
    fn test_game_deserialization() {
        let json = r#"{"id":"123","name":"Game","store":"epic","installed":true}"#;
        let game: Game = serde_json::from_str(json).unwrap();
        assert_eq!(game.id, "123");
        assert_eq!(game.store, StoreType::Epic);
        assert!(game.installed);
    }

    #[test]
    fn test_game_serialization_skips_none() {
        let game = Game::new("1", "Test", StoreType::Steam);
        let json = serde_json::to_string(&game).unwrap();
        assert!(!json.contains("install_path"));
        assert!(!json.contains("cover_url"));
    }

    #[test]
    fn test_game_artwork_new() {
        let artwork = GameArtwork::new();
        assert!(artwork.cover.is_none());
        assert!(artwork.hero.is_none());
        assert!(artwork.logo.is_none());
        assert!(artwork.icon.is_none());
    }

    #[test]
    fn test_game_artwork_default() {
        let artwork = GameArtwork::default();
        assert!(!artwork.has_any());
    }

    #[test]
    fn test_game_artwork_has_any() {
        let mut artwork = GameArtwork::new();
        assert!(!artwork.has_any());

        artwork.cover = Some("url".to_string());
        assert!(artwork.has_any());
    }

    #[test]
    fn test_game_artwork_has_any_hero() {
        let mut artwork = GameArtwork::new();
        artwork.hero = Some("url".to_string());
        assert!(artwork.has_any());
    }

    #[test]
    fn test_game_artwork_has_any_logo() {
        let mut artwork = GameArtwork::new();
        artwork.logo = Some("url".to_string());
        assert!(artwork.has_any());
    }

    #[test]
    fn test_game_artwork_has_any_icon() {
        let mut artwork = GameArtwork::new();
        artwork.icon = Some("url".to_string());
        assert!(artwork.has_any());
    }

    #[test]
    fn test_game_artwork_clone() {
        let mut artwork = GameArtwork::new();
        artwork.cover = Some("url".to_string());
        let cloned = artwork.clone();
        assert_eq!(artwork, cloned);
    }

    #[test]
    fn test_game_artwork_debug() {
        let artwork = GameArtwork::new();
        let debug = format!("{:?}", artwork);
        assert!(debug.contains("GameArtwork"));
    }

    #[test]
    fn test_game_artwork_serialization() {
        let mut artwork = GameArtwork::new();
        artwork.cover = Some("https://example.com/cover.jpg".to_string());
        let json = serde_json::to_string(&artwork).unwrap();
        assert!(json.contains("cover"));
    }
}
