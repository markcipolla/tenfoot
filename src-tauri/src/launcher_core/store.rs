use crate::launcher_core::{Game, LauncherError};
use std::path::PathBuf;

/// Trait that all game store integrations must implement
pub trait GameStore: Send + Sync {
    /// Get the unique identifier for this store
    fn store_id(&self) -> &'static str;

    /// Get the display name for this store
    fn display_name(&self) -> &'static str;

    /// Check if this store is available/installed on the system
    fn is_available(&self) -> bool;

    /// Get the path where the store client is installed
    fn get_client_path(&self) -> Option<PathBuf>;

    /// Scan for all installed games
    fn get_installed_games(&self) -> Result<Vec<Game>, LauncherError>;

    /// Launch a game by its store-specific ID
    fn launch_game(&self, game_id: &str) -> Result<(), LauncherError>;

    /// Get artwork URLs for a game
    fn get_artwork_url(&self, game_id: &str, art_type: ArtworkType) -> Option<String>;
}

/// Types of artwork available for games
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArtworkType {
    /// Cover art (portrait, like a game box)
    Cover,
    /// Hero/banner art (landscape, wide format)
    Hero,
    /// Game logo
    Logo,
    /// Small icon
    Icon,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_artwork_type_equality() {
        assert_eq!(ArtworkType::Cover, ArtworkType::Cover);
        assert_ne!(ArtworkType::Cover, ArtworkType::Hero);
    }

    #[test]
    fn test_artwork_type_clone() {
        let art = ArtworkType::Hero;
        let cloned = art.clone();
        assert_eq!(art, cloned);
    }

    #[test]
    fn test_artwork_type_debug() {
        let art = ArtworkType::Icon;
        let debug = format!("{:?}", art);
        assert_eq!(debug, "Icon");
    }
}
