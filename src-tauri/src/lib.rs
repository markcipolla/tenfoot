pub mod launcher_core;
pub mod storage;
pub mod stores;

use crate::launcher_core::{Game, GameLibrary, GameStore};
use crate::storage::{AppSettings, Storage};
use crate::stores::epic::{EpicApi, EpicCredentials, EpicGameDetails};
use crate::stores::steam::{GameDetails, SteamApi, SteamCredentials};
use crate::stores::{EpicStore, GogStore, SteamStore};
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Manager, State};

/// Type alias for play history data: (last_played, installed_at)
type PlayHistoryMap = HashMap<String, (Option<u64>, Option<u64>)>;

/// Application state containing the game library
pub struct AppState {
    pub library: Mutex<GameLibrary>,
    pub storage: Mutex<Storage>,
    pub steam_api: Mutex<SteamApi>,
    pub epic_api: Mutex<EpicApi>,
}

impl AppState {
    /// Create a new app state with all stores registered
    pub fn new() -> Self {
        let mut library = GameLibrary::new();

        // Register available stores
        library.register_store(Box::new(SteamStore::new()));
        library.register_store(Box::new(EpicStore::new()));
        library.register_store(Box::new(GogStore::new()));

        let storage = Storage::new().expect("Failed to initialize storage");

        Self {
            library: Mutex::new(library),
            storage: Mutex::new(storage),
            steam_api: Mutex::new(SteamApi::new()),
            epic_api: Mutex::new(EpicApi::new()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

/// Get all installed games from all registered stores
#[tauri::command]
fn get_installed_games(state: State<AppState>) -> Result<Vec<Game>, String> {
    let library = state.library.lock().map_err(|e| e.to_string())?;
    library.refresh_all().map_err(|e| e.to_string())
}

/// Get cached games (without refreshing)
#[tauri::command]
fn get_games(state: State<AppState>) -> Result<Vec<Game>, String> {
    let library = state.library.lock().map_err(|e| e.to_string())?;
    Ok(library.get_games())
}

/// Launch a game by its unique key (store:id)
/// Returns the timestamp when the game was launched (for immediate UI update)
#[tauri::command]
fn launch_game(state: State<AppState>, game_key: String) -> Result<u64, String> {
    let library = state.library.lock().map_err(|e| e.to_string())?;
    let storage = state.storage.lock().map_err(|e| e.to_string())?;

    // Record the launch time before launching and get the timestamp
    let timestamp = storage
        .record_game_launch_with_timestamp(&game_key)
        .map_err(|e| e.to_string())?;

    library.launch_game(&game_key).map_err(|e| e.to_string())?;

    Ok(timestamp)
}

/// Get list of available stores
#[tauri::command]
fn get_available_stores(state: State<AppState>) -> Result<Vec<String>, String> {
    let library = state.library.lock().map_err(|e| e.to_string())?;
    Ok(library
        .get_available_stores()
        .into_iter()
        .map(|s| s.to_string())
        .collect())
}

/// Find a specific game by its unique key
#[tauri::command]
fn find_game(state: State<AppState>, game_key: String) -> Result<Option<Game>, String> {
    let library = state.library.lock().map_err(|e| e.to_string())?;
    Ok(library.find_game(&game_key))
}

/// Save Steam credentials
#[tauri::command]
fn save_steam_credentials(
    state: State<AppState>,
    api_key: String,
    steam_id: String,
) -> Result<(), String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let mut creds = storage.load_credentials().map_err(|e| e.to_string())?;
    creds.steam = Some(SteamCredentials { api_key, steam_id });
    storage.save_credentials(&creds).map_err(|e| e.to_string())
}

/// Get Steam credentials (returns None if not set)
#[tauri::command]
fn get_steam_credentials(state: State<AppState>) -> Result<Option<SteamCredentials>, String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let creds = storage.load_credentials().map_err(|e| e.to_string())?;
    Ok(creds.steam)
}

/// Check if Steam is connected (has credentials)
#[tauri::command]
fn is_steam_connected(state: State<AppState>) -> Result<bool, String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let creds = storage.load_credentials().map_err(|e| e.to_string())?;
    Ok(creds.steam.is_some())
}

/// Sync Steam library (fetch owned games from API and merge with installed)
#[tauri::command]
async fn sync_steam_library(state: State<'_, AppState>) -> Result<Vec<Game>, String> {
    // Step 1: Load credentials (release lock immediately)
    let steam_creds = {
        let storage = state.storage.lock().map_err(|e| e.to_string())?;
        let creds = storage.load_credentials().map_err(|e| e.to_string())?;
        creds.steam.ok_or("Steam credentials not set")?
    };

    // Step 2: Make network call on blocking thread pool (no lock needed - create fresh API instance)
    let owned_games = tauri::async_runtime::spawn_blocking(move || {
        let api = SteamApi::new();
        api.get_owned_games(&steam_creds)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    // Step 3: Get installed games
    let installed_games = {
        let library = state.library.lock().map_err(|e| e.to_string())?;
        library.refresh_all().map_err(|e| e.to_string())?
    };

    // Create a map of installed Steam games by ID
    let installed_map: HashMap<String, Game> = installed_games
        .into_iter()
        .filter(|g| matches!(g.store, crate::launcher_core::StoreType::Steam))
        .map(|g| (g.id.clone(), g))
        .collect();

    // Merge: mark owned games as installed if they are
    let merged_games: Vec<Game> = owned_games
        .into_iter()
        .map(|mut game| {
            if let Some(installed) = installed_map.get(&game.id) {
                game.installed = true;
                game.install_path = installed.install_path.clone();
                game.executable = installed.executable.clone();
                game.size_bytes = installed.size_bytes;
                // Use name from installed game if API didn't provide one
                if game.name.starts_with("App ") {
                    game.name = installed.name.clone();
                }
            }
            game
        })
        .collect();

    // Step 4: Cache the results
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    {
        let storage = state.storage.lock().map_err(|e| e.to_string())?;
        let mut cache = storage.load_games_cache().map_err(|e| e.to_string())?;
        cache.steam_owned = merged_games.clone();
        cache.last_sync = Some(now);
        storage
            .save_games_cache(&cache)
            .map_err(|e| e.to_string())?;
    }

    Ok(merged_games)
}

/// Get cached Steam games (without making API call)
#[tauri::command]
fn get_steam_games_cached(state: State<AppState>) -> Result<Vec<Game>, String> {
    // Load cache first
    let cache = {
        let storage = state.storage.lock().map_err(|e| e.to_string())?;
        storage.load_games_cache().map_err(|e| e.to_string())?
    };

    // Get installed games
    let installed_games = {
        let library = state.library.lock().map_err(|e| e.to_string())?;
        library.refresh_all().map_err(|e| e.to_string())?
    };

    if cache.steam_owned.is_empty() {
        // No cache, return installed games only
        return Ok(installed_games
            .into_iter()
            .filter(|g| matches!(g.store, crate::launcher_core::StoreType::Steam))
            .collect());
    }

    // Create a map of installed Steam games
    let installed_map: HashMap<String, Game> = installed_games
        .into_iter()
        .filter(|g| matches!(g.store, crate::launcher_core::StoreType::Steam))
        .map(|g| (g.id.clone(), g))
        .collect();

    let updated_games: Vec<Game> = cache
        .steam_owned
        .into_iter()
        .map(|mut game| {
            if let Some(installed) = installed_map.get(&game.id) {
                game.installed = true;
                game.install_path = installed.install_path.clone();
                game.size_bytes = installed.size_bytes;
                // Use name from installed game if API didn't provide one
                if game.name.starts_with("App ") {
                    game.name = installed.name.clone();
                }
            } else {
                game.installed = false;
            }
            game
        })
        .collect();

    Ok(updated_games)
}

/// Get last sync timestamp
#[tauri::command]
fn get_last_sync_time(state: State<AppState>) -> Result<Option<u64>, String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let cache = storage.load_games_cache().map_err(|e| e.to_string())?;
    Ok(cache.last_sync)
}

/// Install a Steam game (opens Steam to download)
#[tauri::command]
fn install_steam_game(game_id: String) -> Result<(), String> {
    let store = SteamStore::new();
    store.install_game(&game_id).map_err(|e| e.to_string())
}

/// Disconnect Steam (clear credentials and cache)
#[tauri::command]
fn disconnect_steam(state: State<AppState>) -> Result<(), String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    storage.clear_steam_data().map_err(|e| e.to_string())
}

// ============================================================================
// Epic Games Commands
// ============================================================================

/// Get Epic Games login URL for OAuth flow
#[tauri::command]
fn get_epic_login_url() -> String {
    EpicApi::get_login_url()
}

/// Exchange Epic authorization code for OAuth tokens
#[tauri::command]
async fn exchange_epic_code(
    state: State<'_, AppState>,
    auth_code: String,
) -> Result<String, String> {
    // Step 1: Exchange code for tokens on blocking thread pool
    let credentials = tauri::async_runtime::spawn_blocking(move || {
        let api = EpicApi::new();
        api.exchange_code(&auth_code)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    let display_name = credentials.display_name.clone();

    // Step 2: Save credentials (separate lock scope)
    {
        let storage = state.storage.lock().map_err(|e| e.to_string())?;
        let mut stored_creds = storage.load_credentials().map_err(|e| e.to_string())?;
        stored_creds.epic = Some(credentials);
        storage
            .save_credentials(&stored_creds)
            .map_err(|e| e.to_string())?;
    }

    Ok(display_name)
}

/// Get Epic credentials (for checking connection status)
#[tauri::command]
fn get_epic_credentials(state: State<AppState>) -> Result<Option<EpicCredentials>, String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let creds = storage.load_credentials().map_err(|e| e.to_string())?;
    Ok(creds.epic)
}

/// Check if Epic is connected (has credentials)
#[tauri::command]
fn is_epic_connected(state: State<AppState>) -> Result<bool, String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let creds = storage.load_credentials().map_err(|e| e.to_string())?;
    Ok(creds.epic.is_some())
}

/// Sync Epic library (fetch owned games from API and merge with installed)
#[tauri::command]
async fn sync_epic_library(state: State<'_, AppState>) -> Result<Vec<Game>, String> {
    // Load credentials (release lock immediately)
    let epic_creds = {
        let storage = state.storage.lock().map_err(|e| e.to_string())?;
        let creds = storage.load_credentials().map_err(|e| e.to_string())?;
        creds.epic.ok_or("Epic credentials not set")?
    };

    // Check and refresh token if needed (on blocking thread pool)
    let creds_for_refresh = epic_creds.clone();
    let valid_creds = tauri::async_runtime::spawn_blocking(move || {
        let api = EpicApi::new();
        api.ensure_valid_token(&creds_for_refresh)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    // Save refreshed credentials if they changed
    if valid_creds.access_token != epic_creds.access_token {
        let storage = state.storage.lock().map_err(|e| e.to_string())?;
        let mut stored_creds = storage.load_credentials().map_err(|e| e.to_string())?;
        stored_creds.epic = Some(valid_creds.clone());
        storage
            .save_credentials(&stored_creds)
            .map_err(|e| e.to_string())?;
    }

    // Fetch owned games from Epic API (on blocking thread pool)
    let creds_for_library = valid_creds.clone();
    let (owned_games, metadata) = tauri::async_runtime::spawn_blocking(move || {
        let api = EpicApi::new();
        api.get_library(&creds_for_library)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())?;

    // Get installed games
    let installed_games = {
        let library = state.library.lock().map_err(|e| e.to_string())?;
        library.refresh_all().map_err(|e| e.to_string())?
    };

    // Create a map of installed Epic games by ID
    let installed_map: HashMap<String, Game> = installed_games
        .into_iter()
        .filter(|g| matches!(g.store, crate::launcher_core::StoreType::Epic))
        .map(|g| (g.id.clone(), g))
        .collect();

    // Merge: mark owned games as installed if they are
    let merged_games: Vec<Game> = owned_games
        .into_iter()
        .map(|mut game| {
            if let Some(installed) = installed_map.get(&game.id) {
                game.installed = true;
                game.install_path = installed.install_path.clone();
                game.executable = installed.executable.clone();
                game.size_bytes = installed.size_bytes;
            }
            game
        })
        .collect();

    // Cache the results including metadata
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    // Convert EpicGameDetails to EpicGameMetadata for storage
    let storage_metadata: HashMap<String, crate::storage::EpicGameMetadata> = metadata
        .into_iter()
        .map(|(id, details)| {
            (
                id,
                crate::storage::EpicGameMetadata {
                    description: details.description,
                    developers: details.developers,
                    publishers: details.publishers,
                    genres: details.genres,
                    platforms: details.platforms,
                    release_date: details.release_date,
                },
            )
        })
        .collect();

    {
        let storage = state.storage.lock().map_err(|e| e.to_string())?;
        let mut cache = storage.load_games_cache().map_err(|e| e.to_string())?;
        cache.epic_owned = merged_games.clone();
        cache.epic_last_sync = Some(now);
        cache.epic_metadata = storage_metadata;
        storage
            .save_games_cache(&cache)
            .map_err(|e| e.to_string())?;
    }

    Ok(merged_games)
}

/// Get cached Epic games (without making API call)
#[tauri::command]
fn get_epic_games_cached(state: State<AppState>) -> Result<Vec<Game>, String> {
    // Load cache first
    let cache = {
        let storage = state.storage.lock().map_err(|e| e.to_string())?;
        storage.load_games_cache().map_err(|e| e.to_string())?
    };

    // Get installed games
    let installed_games = {
        let library = state.library.lock().map_err(|e| e.to_string())?;
        library.refresh_all().map_err(|e| e.to_string())?
    };

    if cache.epic_owned.is_empty() {
        // No cache, return installed games only
        return Ok(installed_games
            .into_iter()
            .filter(|g| matches!(g.store, crate::launcher_core::StoreType::Epic))
            .collect());
    }

    // Create a map of installed Epic games
    let installed_map: HashMap<String, Game> = installed_games
        .into_iter()
        .filter(|g| matches!(g.store, crate::launcher_core::StoreType::Epic))
        .map(|g| (g.id.clone(), g))
        .collect();

    let updated_games: Vec<Game> = cache
        .epic_owned
        .into_iter()
        .map(|mut game| {
            if let Some(installed) = installed_map.get(&game.id) {
                game.installed = true;
                game.install_path = installed.install_path.clone();
                game.size_bytes = installed.size_bytes;
            } else {
                game.installed = false;
            }
            game
        })
        .collect();

    Ok(updated_games)
}

/// Get Epic last sync timestamp
#[tauri::command]
fn get_epic_last_sync_time(state: State<AppState>) -> Result<Option<u64>, String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let cache = storage.load_games_cache().map_err(|e| e.to_string())?;
    Ok(cache.epic_last_sync)
}

/// Disconnect Epic (clear credentials and cache)
#[tauri::command]
fn disconnect_epic(state: State<AppState>) -> Result<(), String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    storage.clear_epic_data().map_err(|e| e.to_string())
}

/// Get Epic game details from cache
#[tauri::command]
fn get_epic_game_details(
    state: State<AppState>,
    game_id: String,
) -> Result<Option<EpicGameDetails>, String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let cache = storage.load_games_cache().map_err(|e| e.to_string())?;

    // Look up metadata from cache
    let metadata = cache.epic_metadata.get(&game_id);

    Ok(metadata.map(|m| EpicGameDetails {
        description: m.description.clone(),
        developers: m.developers.clone(),
        publishers: m.publishers.clone(),
        genres: m.genres.clone(),
        platforms: m.platforms.clone(),
        release_date: m.release_date.clone(),
    }))
}

/// Auto-detect Steam ID from local Steam installation
#[tauri::command]
fn detect_steam_id() -> Result<Option<String>, String> {
    let paths = crate::stores::steam::SteamPaths::detect();
    Ok(paths.detect_steam_id())
}

/// Check if Steam is installed locally
#[tauri::command]
fn is_steam_installed() -> Result<bool, String> {
    let store = SteamStore::new();
    Ok(store.is_available())
}

/// Get play history for enriching game data on frontend
#[tauri::command]
fn get_play_history(state: State<AppState>) -> Result<PlayHistoryMap, String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let history = storage.load_play_history().map_err(|e| e.to_string())?;

    // Convert to a simpler format: game_key -> (last_played, installed_at)
    Ok(history
        .games
        .into_iter()
        .map(|(k, v)| (k, (v.last_played, v.installed_at)))
        .collect())
}

/// Check if there's any sync data (to decide initial screen)
#[tauri::command]
fn has_synced_library(state: State<AppState>) -> Result<bool, String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    let cache = storage.load_games_cache().map_err(|e| e.to_string())?;
    Ok(cache.last_sync.is_some()
        || cache.epic_last_sync.is_some()
        || !cache.steam_owned.is_empty()
        || !cache.epic_owned.is_empty())
}

/// Get application settings
#[tauri::command]
fn get_app_settings(state: State<AppState>) -> Result<AppSettings, String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    storage.load_settings().map_err(|e| e.to_string())
}

/// Save application settings
#[tauri::command]
fn save_app_settings(state: State<AppState>, settings: AppSettings) -> Result<(), String> {
    let storage = state.storage.lock().map_err(|e| e.to_string())?;
    storage.save_settings(&settings).map_err(|e| e.to_string())
}

/// Get detailed game information from Steam Store API
#[tauri::command]
fn get_game_details(
    state: State<AppState>,
    game_id: String,
) -> Result<Option<GameDetails>, String> {
    let steam_api = state.steam_api.lock().map_err(|e| e.to_string())?;
    steam_api
        .get_game_details(&game_id)
        .map_err(|e| e.to_string())
}

/// Set auto-launch on startup
#[tauri::command]
fn set_autolaunch(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;

        let app_path =
            std::env::current_exe().map_err(|e| format!("Failed to get app path: {e}"))?;

        if enabled {
            // Add to login items using osascript
            let app_display = app_path.display();
            let script = format!(
                r#"tell application "System Events" to make login item at end with properties {{path:"{app_display}", hidden:false}}"#
            );
            Command::new("osascript")
                .args(["-e", &script])
                .output()
                .map_err(|e| format!("Failed to add login item: {e}"))?;
        } else {
            // Remove from login items
            let app_name = app_path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("TenFoot");
            let script =
                format!(r#"tell application "System Events" to delete login item "{app_name}""#);
            // Ignore errors when removing (might not exist)
            let _ = Command::new("osascript").args(["-e", &script]).output();
        }
        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        use std::process::Command;

        let app_path =
            std::env::current_exe().map_err(|e| format!("Failed to get app path: {e}"))?;

        let reg_path = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run";
        let app_name = "GameLauncher";

        if enabled {
            Command::new("reg")
                .args([
                    "add",
                    reg_path,
                    "/v",
                    app_name,
                    "/t",
                    "REG_SZ",
                    "/d",
                    &app_path.display().to_string(),
                    "/f",
                ])
                .output()
                .map_err(|e| format!("Failed to add registry key: {e}"))?;
        } else {
            let _ = Command::new("reg")
                .args(["delete", reg_path, "/v", app_name, "/f"])
                .output();
        }
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        use std::fs;

        let autostart_dir = dirs::config_dir()
            .ok_or("Could not find config directory")?
            .join("autostart");

        let desktop_file = autostart_dir.join("tenfoot.desktop");

        if enabled {
            let app_path =
                std::env::current_exe().map_err(|e| format!("Failed to get app path: {e}"))?;

            fs::create_dir_all(&autostart_dir)
                .map_err(|e| format!("Failed to create autostart dir: {e}"))?;

            let app_display = app_path.display();
            let content = format!(
                "[Desktop Entry]\nType=Application\nName=TenFoot\nExec={app_display}\nX-GNOME-Autostart-enabled=true"
            );

            fs::write(&desktop_file, content)
                .map_err(|e| format!("Failed to write desktop file: {e}"))?;
        } else {
            let _ = fs::remove_file(&desktop_file);
        }
        Ok(())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState::new())
        .setup(|app| {
            // Load settings and apply fullscreen if enabled
            if let Ok(storage) = Storage::new() {
                if let Ok(settings) = storage.load_settings() {
                    if settings.launch_fullscreen {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.set_fullscreen(true);
                        }
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_installed_games,
            get_games,
            launch_game,
            get_available_stores,
            find_game,
            // Steam commands
            save_steam_credentials,
            get_steam_credentials,
            is_steam_connected,
            sync_steam_library,
            get_steam_games_cached,
            get_last_sync_time,
            install_steam_game,
            disconnect_steam,
            detect_steam_id,
            is_steam_installed,
            // Epic commands
            get_epic_login_url,
            exchange_epic_code,
            get_epic_credentials,
            is_epic_connected,
            sync_epic_library,
            get_epic_games_cached,
            get_epic_last_sync_time,
            disconnect_epic,
            get_epic_game_details,
            // General commands
            get_play_history,
            has_synced_library,
            get_app_settings,
            save_app_settings,
            set_autolaunch,
            get_game_details,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_state_new() {
        let state = AppState::new();
        let library = state.library.lock().unwrap();
        assert!(library.store_count() > 0);
    }

    #[test]
    fn test_app_state_default() {
        let state = AppState::default();
        let library = state.library.lock().unwrap();
        assert!(library.store_count() > 0);
    }

    #[test]
    fn test_app_state_has_stores() {
        let state = AppState::new();
        let library = state.library.lock().unwrap();
        // Should have 3 stores registered (Steam, Epic, GOG)
        assert_eq!(library.store_count(), 3);
    }
}
