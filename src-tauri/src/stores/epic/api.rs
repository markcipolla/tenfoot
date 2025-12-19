use crate::launcher_core::{Game, LauncherError, StoreType};
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Epic Games OAuth credentials (from Legendary launcher)
const EPIC_CLIENT_ID: &str = "34a02cf8f4414e29b15921876da36f9a";
const EPIC_CLIENT_SECRET: &str = "daafbccc737745039dffe53d94fc76cf";

// API hosts
const OAUTH_HOST: &str = "account-public-service-prod03.ol.epicgames.com";
const LIBRARY_HOST: &str = "library-service.live.use1a.on.epicgames.com";
const CATALOG_HOST: &str = "catalog-public-service-prod06.ol.epicgames.com";

/// Epic Games OAuth tokens
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EpicCredentials {
    pub access_token: String,
    pub refresh_token: String,
    pub account_id: String,
    pub display_name: String,
    pub expires_at: u64, // Unix timestamp when access token expires
}

/// OAuth token response from Epic
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct OAuthTokenResponse {
    access_token: String,
    expires_in: u64,
    expires_at: Option<String>,
    token_type: String,
    refresh_token: Option<String>,
    refresh_expires: Option<u64>,
    account_id: String,
    client_id: String,
    internal_client: bool,
    client_service: String,
    #[serde(default)]
    display_name: String,
    app: Option<String>,
    in_app_id: Option<String>,
}

/// Library item from Epic
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct LibraryItem {
    namespace: String,
    catalog_item_id: String,
    app_name: String,
    #[serde(default)]
    records: Vec<LibraryRecord>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct LibraryRecord {
    catalog_item_id: String,
    #[serde(default)]
    sandbox_name: Option<String>,
}

/// Library response
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LibraryResponse {
    records: Vec<LibraryItem>,
    response_metadata: Option<ResponseMetadata>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ResponseMetadata {
    next_cursor: Option<String>,
}

/// Catalog item info
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct CatalogItem {
    id: String,
    title: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    long_description: Option<String>,
    #[serde(default)]
    key_images: Vec<KeyImage>,
    #[serde(default)]
    namespace: String,
    #[serde(default)]
    developer: Option<String>,
    #[serde(default)]
    developer_display_name: Option<String>,
    #[serde(default)]
    publisher: Option<String>,
    #[serde(default)]
    categories: Vec<Category>,
    #[serde(default)]
    release_info: Vec<ReleaseInfo>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Category {
    path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct ReleaseInfo {
    #[serde(default)]
    platform: Vec<String>,
    #[serde(default)]
    date_added: Option<String>,
}

/// Game details returned to frontend (matches Steam's GameDetails structure)
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EpicGameDetails {
    pub description: Option<String>,
    pub developers: Option<Vec<String>>,
    pub publishers: Option<Vec<String>>,
    pub genres: Option<Vec<String>>,
    pub platforms: Option<Vec<String>>,
    pub release_date: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct KeyImage {
    #[serde(rename = "type")]
    image_type: String,
    url: String,
}

/// Capitalize first letter of a string
fn capitalize_first(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(c) => c.to_uppercase().chain(chars).collect(),
    }
}

pub struct EpicApi {
    client: reqwest::blocking::Client,
}

impl EpicApi {
    pub fn new() -> Self {
        Self {
            client: reqwest::blocking::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .connect_timeout(std::time::Duration::from_secs(10))
                .build()
                .unwrap_or_else(|_| reqwest::blocking::Client::new()),
        }
    }

    /// Generate the login URL for browser authentication
    pub fn get_login_url() -> String {
        let redirect_url = format!(
            "https://www.epicgames.com/id/api/redirect?clientId={EPIC_CLIENT_ID}&responseType=code"
        );
        let encoded_redirect = urlencoding::encode(&redirect_url);
        format!("https://www.epicgames.com/id/login?redirectUrl={encoded_redirect}")
    }

    /// Get Basic auth header value
    fn get_basic_auth() -> String {
        let credentials = format!("{EPIC_CLIENT_ID}:{EPIC_CLIENT_SECRET}");
        let encoded = base64::engine::general_purpose::STANDARD.encode(credentials);
        format!("Basic {encoded}")
    }

    /// Exchange authorization code for OAuth tokens
    pub fn exchange_code(&self, auth_code: &str) -> Result<EpicCredentials, LauncherError> {
        let url = format!("https://{OAUTH_HOST}/account/api/oauth/token");

        let response = self
            .client
            .post(&url)
            .header("Authorization", Self::get_basic_auth())
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(format!(
                "grant_type=authorization_code&code={auth_code}&token_type=eg1"
            ))
            .send()
            .map_err(|e| LauncherError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().unwrap_or_default();
            return Err(LauncherError::AuthRequired(format!(
                "OAuth failed ({status}): {body}"
            )));
        }

        let token: OAuthTokenResponse = response
            .json()
            .map_err(|e| LauncherError::ParseError(e.to_string()))?;

        let expires_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() + token.expires_in)
            .unwrap_or(0);

        Ok(EpicCredentials {
            access_token: token.access_token,
            refresh_token: token.refresh_token.unwrap_or_default(),
            account_id: token.account_id,
            display_name: token.display_name,
            expires_at,
        })
    }

    /// Refresh OAuth tokens using refresh token
    pub fn refresh_token(&self, refresh_token: &str) -> Result<EpicCredentials, LauncherError> {
        let url = format!("https://{OAUTH_HOST}/account/api/oauth/token");

        let response = self
            .client
            .post(&url)
            .header("Authorization", Self::get_basic_auth())
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body(format!(
                "grant_type=refresh_token&refresh_token={refresh_token}&token_type=eg1"
            ))
            .send()
            .map_err(|e| LauncherError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().unwrap_or_default();
            return Err(LauncherError::AuthRequired(format!(
                "Token refresh failed ({status}): {body}"
            )));
        }

        let token: OAuthTokenResponse = response
            .json()
            .map_err(|e| LauncherError::ParseError(e.to_string()))?;

        let expires_at = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs() + token.expires_in)
            .unwrap_or(0);

        Ok(EpicCredentials {
            access_token: token.access_token,
            refresh_token: token.refresh_token.unwrap_or_default(),
            account_id: token.account_id,
            display_name: token.display_name,
            expires_at,
        })
    }

    /// Check if credentials are expired and refresh if needed
    pub fn ensure_valid_token(
        &self,
        credentials: &EpicCredentials,
    ) -> Result<EpicCredentials, LauncherError> {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0);

        // Refresh if less than 5 minutes until expiry
        if credentials.expires_at > now + 300 {
            return Ok(credentials.clone());
        }

        self.refresh_token(&credentials.refresh_token)
    }

    /// Fetch user's game library from Epic - returns games and their metadata
    pub fn get_library(
        &self,
        credentials: &EpicCredentials,
    ) -> Result<(Vec<Game>, HashMap<String, EpicGameDetails>), LauncherError> {
        let mut games = Vec::new();
        let mut metadata = HashMap::new();
        let mut cursor: Option<String> = None;

        loop {
            let url = match &cursor {
                Some(c) => {
                    format!("https://{LIBRARY_HOST}/library/api/public/items?includeMetadata=true&cursor={c}")
                }
                None => {
                    format!("https://{LIBRARY_HOST}/library/api/public/items?includeMetadata=true")
                }
            };

            let access_token = &credentials.access_token;
            let response = self
                .client
                .get(&url)
                .header("Authorization", format!("Bearer {access_token}"))
                .send()
                .map_err(|e| LauncherError::NetworkError(e.to_string()))?;

            if !response.status().is_success() {
                let status = response.status();
                if status.as_u16() == 401 {
                    return Err(LauncherError::AuthRequired(
                        "Epic token expired".to_string(),
                    ));
                }
                let body = response.text().unwrap_or_default();
                return Err(LauncherError::NetworkError(format!(
                    "Library fetch failed ({status}): {body}"
                )));
            }

            let library: LibraryResponse = response
                .json()
                .map_err(|e| LauncherError::ParseError(e.to_string()))?;

            // Collect namespace -> catalog_item_ids for batch lookup
            let mut namespace_items: HashMap<String, Vec<String>> = HashMap::new();
            for item in &library.records {
                namespace_items
                    .entry(item.namespace.clone())
                    .or_default()
                    .push(item.catalog_item_id.clone());
            }

            // Fetch catalog info for each namespace
            for (namespace, item_ids) in namespace_items {
                if let Ok(catalog_results) =
                    self.get_catalog_items(credentials, &namespace, &item_ids)
                {
                    for (game, details) in catalog_results {
                        metadata.insert(game.id.clone(), details);
                        games.push(game);
                    }
                }
            }

            // Check for more pages
            cursor = library.response_metadata.and_then(|m| m.next_cursor);
            if cursor.is_none() {
                break;
            }
        }

        Ok((games, metadata))
    }

    /// Fetch catalog info for items - returns both games and metadata
    fn get_catalog_items(
        &self,
        credentials: &EpicCredentials,
        namespace: &str,
        item_ids: &[String],
    ) -> Result<Vec<(Game, EpicGameDetails)>, LauncherError> {
        if item_ids.is_empty() {
            return Ok(Vec::new());
        }

        let ids_param = item_ids.join(",");
        let url = format!(
            "https://{CATALOG_HOST}/catalog/api/shared/namespace/{namespace}/bulk/items?id={ids_param}&includeDLCDetails=true&includeMainGameDetails=true&country=US&locale=en"
        );

        let access_token = &credentials.access_token;
        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {access_token}"))
            .send()
            .map_err(|e| LauncherError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Ok(Vec::new()); // Don't fail on catalog errors
        }

        let catalog: HashMap<String, CatalogItem> = response
            .json()
            .map_err(|e| LauncherError::ParseError(e.to_string()))?;

        Ok(catalog
            .into_values()
            .map(|item| {
                let mut game = Game::new(item.id.clone(), item.title, StoreType::Epic);
                game.installed = false;

                // Set artwork URLs
                for image in &item.key_images {
                    match image.image_type.as_str() {
                        "DieselGameBox" | "DieselGameBoxTall" => {
                            game.set_cover_url(image.url.clone());
                        }
                        "DieselGameBoxLogo" => {
                            game.set_icon_url(image.url.clone());
                            game.set_hero_url(image.url.clone());
                        }
                        _ => {}
                    }
                }

                // Extract metadata
                let developer = item
                    .developer_display_name
                    .clone()
                    .or_else(|| item.developer.clone());
                let developers = developer.map(|d| vec![d]);

                let publishers = item.publisher.clone().map(|p| vec![p]);

                // Extract genres from categories (e.g., "games/genre/action" -> "Action")
                let genres: Vec<String> = item
                    .categories
                    .iter()
                    .filter_map(|cat| {
                        if cat.path.starts_with("games/genre/") {
                            let genre = cat.path.strip_prefix("games/genre/")?;
                            Some(capitalize_first(genre))
                        } else {
                            None
                        }
                    })
                    .collect();

                // Extract platforms from release_info
                let platforms: Vec<String> = item
                    .release_info
                    .iter()
                    .flat_map(|r| r.platform.iter())
                    .map(|p| match p.as_str() {
                        "Windows" => "Windows".to_string(),
                        "Mac" => "macOS".to_string(),
                        "Linux" => "Linux".to_string(),
                        other => other.to_string(),
                    })
                    .collect::<std::collections::HashSet<_>>()
                    .into_iter()
                    .collect();

                // Get release date from first release_info
                let release_date = item.release_info.first().and_then(|r| r.date_added.clone());

                let details = EpicGameDetails {
                    description: item.description.or(item.long_description),
                    developers,
                    publishers,
                    genres: if genres.is_empty() {
                        None
                    } else {
                        Some(genres)
                    },
                    platforms: if platforms.is_empty() {
                        None
                    } else {
                        Some(platforms)
                    },
                    release_date,
                };

                (game, details)
            })
            .collect())
    }

    /// Verify that credentials are still valid
    pub fn verify_credentials(&self, credentials: &EpicCredentials) -> Result<bool, LauncherError> {
        let url = format!("https://{OAUTH_HOST}/account/api/oauth/verify");

        let access_token = &credentials.access_token;
        let response = self
            .client
            .get(&url)
            .header("Authorization", format!("Bearer {access_token}"))
            .send()
            .map_err(|e| LauncherError::NetworkError(e.to_string()))?;

        Ok(response.status().is_success())
    }
}

impl Default for EpicApi {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_epic_api_new() {
        let api = EpicApi::new();
        let _ = api;
    }

    #[test]
    fn test_epic_api_default() {
        let api = EpicApi::default();
        let _ = api;
    }

    #[test]
    fn test_get_login_url() {
        let url = EpicApi::get_login_url();
        assert!(url.contains("epicgames.com/id/login"));
        assert!(url.contains("redirectUrl"));
        assert!(url.contains(EPIC_CLIENT_ID));
    }

    #[test]
    fn test_get_basic_auth() {
        let auth = EpicApi::get_basic_auth();
        assert!(auth.starts_with("Basic "));
        // Verify it's valid base64
        let encoded = auth.strip_prefix("Basic ").unwrap();
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(encoded)
            .unwrap();
        let decoded_str = String::from_utf8(decoded).unwrap();
        assert!(decoded_str.contains(EPIC_CLIENT_ID));
        assert!(decoded_str.contains(EPIC_CLIENT_SECRET));
    }

    #[test]
    fn test_credentials_serialization() {
        let creds = EpicCredentials {
            access_token: "test_token".to_string(),
            refresh_token: "test_refresh".to_string(),
            account_id: "12345".to_string(),
            display_name: "TestUser".to_string(),
            expires_at: 1234567890,
        };
        let json = serde_json::to_string(&creds).unwrap();
        assert!(json.contains("test_token"));
        assert!(json.contains("test_refresh"));
        assert!(json.contains("12345"));
        assert!(json.contains("TestUser"));
    }

    #[test]
    fn test_credentials_deserialization() {
        let json = r#"{
            "access_token": "mytoken",
            "refresh_token": "myrefresh",
            "account_id": "acc123",
            "display_name": "Player1",
            "expires_at": 9999999999
        }"#;
        let creds: EpicCredentials = serde_json::from_str(json).unwrap();
        assert_eq!(creds.access_token, "mytoken");
        assert_eq!(creds.refresh_token, "myrefresh");
        assert_eq!(creds.account_id, "acc123");
        assert_eq!(creds.display_name, "Player1");
        assert_eq!(creds.expires_at, 9999999999);
    }
}
