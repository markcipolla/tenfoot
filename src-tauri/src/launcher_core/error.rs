use thiserror::Error;

#[derive(Error, Debug, Clone)]
pub enum LauncherError {
    #[error("Store not found: {0}")]
    StoreNotFound(String),

    #[error("Game not found: {0}")]
    GameNotFound(String),

    #[error("Failed to parse configuration: {0}")]
    ParseError(String),

    #[error("IO error: {0}")]
    IoError(String),

    #[error("HTTP request failed: {0}")]
    HttpError(String),

    #[error("JSON parsing failed: {0}")]
    JsonError(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Game launch failed: {0}")]
    LaunchError(String),

    #[error("Authentication required for {0}")]
    AuthRequired(String),

    #[error("Platform not supported: {0}")]
    PlatformNotSupported(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),
}

impl From<std::io::Error> for LauncherError {
    fn from(err: std::io::Error) -> Self {
        LauncherError::IoError(err.to_string())
    }
}

impl From<reqwest::Error> for LauncherError {
    fn from(err: reqwest::Error) -> Self {
        LauncherError::HttpError(err.to_string())
    }
}

impl From<serde_json::Error> for LauncherError {
    fn from(err: serde_json::Error) -> Self {
        LauncherError::JsonError(err.to_string())
    }
}

impl From<rusqlite::Error> for LauncherError {
    fn from(err: rusqlite::Error) -> Self {
        LauncherError::DatabaseError(err.to_string())
    }
}

impl serde::Serialize for LauncherError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_store_not_found_display() {
        let err = LauncherError::StoreNotFound("steam".to_string());
        assert_eq!(err.to_string(), "Store not found: steam");
    }

    #[test]
    fn test_game_not_found_display() {
        let err = LauncherError::GameNotFound("12345".to_string());
        assert_eq!(err.to_string(), "Game not found: 12345");
    }

    #[test]
    fn test_parse_error_display() {
        let err = LauncherError::ParseError("invalid format".to_string());
        assert_eq!(
            err.to_string(),
            "Failed to parse configuration: invalid format"
        );
    }

    #[test]
    fn test_io_error_display() {
        let err = LauncherError::IoError("file not found".to_string());
        assert_eq!(err.to_string(), "IO error: file not found");
    }

    #[test]
    fn test_http_error_display() {
        let err = LauncherError::HttpError("connection refused".to_string());
        assert_eq!(err.to_string(), "HTTP request failed: connection refused");
    }

    #[test]
    fn test_json_error_display() {
        let err = LauncherError::JsonError("unexpected token".to_string());
        assert_eq!(err.to_string(), "JSON parsing failed: unexpected token");
    }

    #[test]
    fn test_database_error_display() {
        let err = LauncherError::DatabaseError("table not found".to_string());
        assert_eq!(err.to_string(), "Database error: table not found");
    }

    #[test]
    fn test_launch_error_display() {
        let err = LauncherError::LaunchError("executable not found".to_string());
        assert_eq!(err.to_string(), "Game launch failed: executable not found");
    }

    #[test]
    fn test_auth_required_display() {
        let err = LauncherError::AuthRequired("Steam".to_string());
        assert_eq!(err.to_string(), "Authentication required for Steam");
    }

    #[test]
    fn test_platform_not_supported_display() {
        let err = LauncherError::PlatformNotSupported("FreeBSD".to_string());
        assert_eq!(err.to_string(), "Platform not supported: FreeBSD");
    }

    #[test]
    fn test_error_debug() {
        let err = LauncherError::StoreNotFound("test".to_string());
        let debug = format!("{:?}", err);
        assert!(debug.contains("StoreNotFound"));
    }

    #[test]
    fn test_error_clone() {
        let err = LauncherError::GameNotFound("123".to_string());
        let cloned = err.clone();
        assert_eq!(err.to_string(), cloned.to_string());
    }

    #[test]
    fn test_error_serialize() {
        let err = LauncherError::LaunchError("failed".to_string());
        let json = serde_json::to_string(&err).unwrap();
        assert_eq!(json, "\"Game launch failed: failed\"");
    }

    #[test]
    fn test_from_io_error() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let err: LauncherError = io_err.into();
        assert!(matches!(err, LauncherError::IoError(_)));
        assert!(err.to_string().contains("not found"));
    }

    #[test]
    fn test_from_json_error() {
        let json_str = "not valid json{";
        let json_err = serde_json::from_str::<serde_json::Value>(json_str).unwrap_err();
        let err: LauncherError = json_err.into();
        assert!(matches!(err, LauncherError::JsonError(_)));
    }

    #[test]
    fn test_result_type_ok() {
        let result: std::result::Result<i32, LauncherError> = Ok(42);
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
    }

    #[test]
    fn test_result_type_err() {
        let result: std::result::Result<i32, LauncherError> =
            Err(LauncherError::GameNotFound("test".to_string()));
        assert!(result.is_err());
    }

    #[test]
    fn test_all_error_variants_are_error_trait() {
        fn check_error<E: std::error::Error>(_: &E) {}

        check_error(&LauncherError::StoreNotFound("".to_string()));
        check_error(&LauncherError::GameNotFound("".to_string()));
        check_error(&LauncherError::ParseError("".to_string()));
        check_error(&LauncherError::IoError("".to_string()));
        check_error(&LauncherError::HttpError("".to_string()));
        check_error(&LauncherError::JsonError("".to_string()));
        check_error(&LauncherError::DatabaseError("".to_string()));
        check_error(&LauncherError::LaunchError("".to_string()));
        check_error(&LauncherError::AuthRequired("".to_string()));
        check_error(&LauncherError::PlatformNotSupported("".to_string()));
    }
}
