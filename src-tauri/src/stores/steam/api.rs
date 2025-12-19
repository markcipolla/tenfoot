use crate::launcher_core::{Game, LauncherError, StoreType};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const STEAM_API_BASE: &str = "https://api.steampowered.com";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SteamCredentials {
    pub api_key: String,
    pub steam_id: String,
}

#[derive(Debug, Deserialize)]
struct OwnedGamesResponse {
    response: OwnedGamesData,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct OwnedGamesData {
    game_count: Option<u32>,
    games: Option<Vec<OwnedGame>>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct OwnedGame {
    appid: u64,
    name: Option<String>,
    playtime_forever: Option<u64>,
    rtime_last_played: Option<u64>,
    img_icon_url: Option<String>,
}

#[derive(Debug, Deserialize)]
struct AppDetailsWrapper {
    success: bool,
    data: Option<AppDetailsData>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct AppDetailsData {
    name: Option<String>,
    #[serde(rename = "type")]
    app_type: Option<String>,
    short_description: Option<String>,
    detailed_description: Option<String>,
    about_the_game: Option<String>,
    header_image: Option<String>,
    developers: Option<Vec<String>>,
    publishers: Option<Vec<String>>,
    platforms: Option<PlatformSupport>,
    genres: Option<Vec<Genre>>,
    release_date: Option<ReleaseDate>,
}

#[derive(Debug, Deserialize)]
struct PlatformSupport {
    windows: Option<bool>,
    mac: Option<bool>,
    linux: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct Genre {
    description: String,
}

#[derive(Debug, Deserialize)]
struct ReleaseDate {
    date: Option<String>,
}

/// Game details returned to frontend
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameDetails {
    pub description: Option<String>,
    pub developers: Option<Vec<String>>,
    pub publishers: Option<Vec<String>>,
    pub genres: Option<Vec<String>>,
    pub platforms: Option<Vec<String>>,
    pub release_date: Option<String>,
}

pub struct SteamApi {
    client: reqwest::blocking::Client,
}

impl SteamApi {
    pub fn new() -> Self {
        Self {
            client: reqwest::blocking::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .connect_timeout(std::time::Duration::from_secs(10))
                .build()
                .unwrap_or_else(|_| reqwest::blocking::Client::new()),
        }
    }

    /// Fetch all owned games for a Steam user
    pub fn get_owned_games(
        &self,
        credentials: &SteamCredentials,
    ) -> Result<Vec<Game>, LauncherError> {
        let url = format!(
            "{}/IPlayerService/GetOwnedGames/v1/?key={}&steamid={}&include_appinfo=1&include_played_free_games=1&format=json",
            STEAM_API_BASE, credentials.api_key, credentials.steam_id
        );

        let response: OwnedGamesResponse = self
            .client
            .get(&url)
            .send()
            .map_err(|e| LauncherError::NetworkError(e.to_string()))?
            .json()
            .map_err(|e| LauncherError::ParseError(e.to_string()))?;

        let games = response
            .response
            .games
            .unwrap_or_default()
            .into_iter()
            .map(|g| {
                // Use name from API, or fallback to app ID if not provided
                let name = g.name.unwrap_or_else(|| format!("App {}", g.appid));
                let mut game = Game::new(g.appid.to_string(), name, StoreType::Steam);
                game.installed = false; // Will be updated when merging with installed games

                if let Some(playtime) = g.playtime_forever {
                    game.set_playtime(playtime);
                }

                if let Some(last_played) = g.rtime_last_played {
                    game.last_played = Some(last_played);
                }

                // Set artwork URLs from Steam CDN
                let app_id = g.appid;
                game.set_cover_url(format!(
                    "https://steamcdn-a.akamaihd.net/steam/apps/{app_id}/library_600x900.jpg"
                ));
                game.set_hero_url(format!(
                    "https://steamcdn-a.akamaihd.net/steam/apps/{app_id}/library_hero.jpg"
                ));
                game.set_icon_url(format!(
                    "https://steamcdn-a.akamaihd.net/steam/apps/{app_id}/header.jpg"
                ));

                game
            })
            .collect();

        Ok(games)
    }

    /// Validate Steam credentials by making a test API call
    pub fn validate_credentials(
        &self,
        credentials: &SteamCredentials,
    ) -> Result<bool, LauncherError> {
        let url = format!(
            "{}/ISteamUser/GetPlayerSummaries/v2/?key={}&steamids={}",
            STEAM_API_BASE, credentials.api_key, credentials.steam_id
        );

        let response = self
            .client
            .get(&url)
            .send()
            .map_err(|e| LauncherError::NetworkError(e.to_string()))?;

        Ok(response.status().is_success())
    }

    /// Fetch detailed game information from Steam Store API
    pub fn get_game_details(&self, app_id: &str) -> Result<Option<GameDetails>, LauncherError> {
        let url = format!("https://store.steampowered.com/api/appdetails?appids={app_id}");

        let response = self
            .client
            .get(&url)
            .send()
            .map_err(|e| LauncherError::NetworkError(e.to_string()))?;

        let text = response
            .text()
            .map_err(|e| LauncherError::ParseError(e.to_string()))?;

        // Parse as generic JSON first since the response is keyed by app ID
        let json: HashMap<String, AppDetailsWrapper> =
            serde_json::from_str(&text).map_err(|e| LauncherError::ParseError(e.to_string()))?;

        let wrapper = match json.get(app_id) {
            Some(w) => w,
            None => return Ok(None),
        };

        if !wrapper.success {
            return Ok(None);
        }

        let data = match &wrapper.data {
            Some(d) => d,
            None => return Ok(None),
        };

        // Build platforms list
        let platforms = data.platforms.as_ref().map(|p| {
            let mut list = Vec::new();
            if p.windows.unwrap_or(false) {
                list.push("Windows".to_string());
            }
            if p.mac.unwrap_or(false) {
                list.push("macOS".to_string());
            }
            if p.linux.unwrap_or(false) {
                list.push("Linux".to_string());
            }
            list
        });

        // Build genres list
        let genres = data
            .genres
            .as_ref()
            .map(|g| g.iter().map(|genre| genre.description.clone()).collect());

        Ok(Some(GameDetails {
            description: data
                .short_description
                .clone()
                .or_else(|| data.about_the_game.clone()),
            developers: data.developers.clone(),
            publishers: data.publishers.clone(),
            genres,
            platforms,
            release_date: data.release_date.as_ref().and_then(|r| r.date.clone()),
        }))
    }
}

impl Default for SteamApi {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_steam_api_new() {
        let api = SteamApi::new();
        // Just verify it creates without panicking
        assert!(true);
        let _ = api;
    }

    #[test]
    fn test_steam_api_default() {
        let api = SteamApi::default();
        let _ = api;
    }

    #[test]
    fn test_credentials_serialization() {
        let creds = SteamCredentials {
            api_key: "test_key".to_string(),
            steam_id: "12345".to_string(),
        };
        let json = serde_json::to_string(&creds).unwrap();
        assert!(json.contains("test_key"));
        assert!(json.contains("12345"));
    }

    #[test]
    fn test_credentials_deserialization() {
        let json = r#"{"api_key":"mykey","steam_id":"67890"}"#;
        let creds: SteamCredentials = serde_json::from_str(json).unwrap();
        assert_eq!(creds.api_key, "mykey");
        assert_eq!(creds.steam_id, "67890");
    }
}
