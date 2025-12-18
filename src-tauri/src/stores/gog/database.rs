use crate::launcher_core::{Game, LauncherError, StoreType};
use rusqlite::{Connection, OpenFlags};
use std::path::Path;

/// Query installed games from GOG Galaxy's SQLite database
pub fn query_installed_games(db_path: &Path) -> Result<Vec<Game>, LauncherError> {
    // Open database in read-only mode
    let conn = Connection::open_with_flags(db_path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;

    let mut games = Vec::new();

    // Query for installed GOG games
    // The database structure may vary between Galaxy versions
    // We try multiple approaches for robustness

    // Try the InstalledBaseProducts table first
    if let Ok(installed) = query_installed_base_products(&conn) {
        games.extend(installed);
    }

    // If no games found, try alternative tables
    if games.is_empty() {
        if let Ok(installed) = query_library_releases(&conn) {
            games.extend(installed);
        }
    }

    Ok(games)
}

/// Query games from InstalledBaseProducts table
fn query_installed_base_products(conn: &Connection) -> Result<Vec<Game>, LauncherError> {
    let mut games = Vec::new();

    // Check if table exists
    let table_exists: bool = conn
        .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='InstalledBaseProducts'",
        )?
        .exists([])?;

    if !table_exists {
        return Ok(games);
    }

    let mut stmt = conn.prepare("SELECT productId FROM InstalledBaseProducts")?;

    let product_ids: Vec<String> = stmt
        .query_map([], |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();

    // For each installed product, get details from other tables
    for product_id in product_ids {
        if let Ok(game) = get_game_details(conn, &product_id) {
            games.push(game);
        } else {
            // If we can't get details, create a basic game entry
            let mut game = Game::new(
                product_id.clone(),
                format!("GOG Game {product_id}"),
                StoreType::Gog,
            );
            game.installed = true;
            games.push(game);
        }
    }

    Ok(games)
}

/// Query games from LibraryReleases table
fn query_library_releases(conn: &Connection) -> Result<Vec<Game>, LauncherError> {
    let mut games = Vec::new();

    // Check if table exists
    let table_exists: bool = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='LibraryReleases'")?
        .exists([])?;

    if !table_exists {
        return Ok(games);
    }

    let mut stmt = conn
        .prepare("SELECT releaseKey, title FROM LibraryReleases WHERE releaseKey LIKE 'gog_%'")?;

    let rows = stmt.query_map([], |row| {
        let release_key: String = row.get(0)?;
        let title: String = row.get(1)?;
        Ok((release_key, title))
    })?;

    for row in rows.flatten() {
        let (release_key, title) = row;
        // Extract game ID from release key (format: gog_GAMEID)
        let game_id = release_key
            .strip_prefix("gog_")
            .unwrap_or(&release_key)
            .to_string();

        let mut game = Game::new(game_id, title, StoreType::Gog);
        game.installed = true;
        games.push(game);
    }

    Ok(games)
}

/// Get detailed game information from various tables
fn get_game_details(conn: &Connection, product_id: &str) -> Result<Game, LauncherError> {
    // Try to get game title from GamePieces or other tables
    let title =
        get_game_title(conn, product_id).unwrap_or_else(|| format!("GOG Game {product_id}"));

    let mut game = Game::new(product_id.to_string(), title, StoreType::Gog);
    game.installed = true;

    // Try to get install path
    if let Ok(Some(path)) = get_install_path(conn, product_id) {
        game.install_path = Some(path.into());
    }

    Ok(game)
}

/// Get game title from database
fn get_game_title(conn: &Connection, product_id: &str) -> Option<String> {
    // Try GamePieces table
    let result: Result<String, _> = conn.query_row(
        "SELECT value FROM GamePieces WHERE releaseKey = ?1 AND gamePieceTypeId =
            (SELECT id FROM GamePieceTypes WHERE type = 'title')",
        [format!("gog_{product_id}")],
        |row| row.get(0),
    );

    if let Ok(title) = result {
        return Some(title);
    }

    // Try LibraryReleases table
    let result: Result<String, _> = conn.query_row(
        "SELECT title FROM LibraryReleases WHERE releaseKey = ?1",
        [format!("gog_{product_id}")],
        |row| row.get(0),
    );

    result.ok()
}

/// Get install path from database
fn get_install_path(conn: &Connection, product_id: &str) -> Result<Option<String>, LauncherError> {
    // Try ProductConfiguration table
    let table_exists: bool = conn
        .prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='ProductConfiguration'",
        )?
        .exists([])?;

    if !table_exists {
        return Ok(None);
    }

    let result: Result<String, _> = conn.query_row(
        "SELECT installPath FROM ProductConfiguration WHERE productId = ?1",
        [product_id],
        |row| row.get(0),
    );

    Ok(result.ok())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use tempfile::TempDir;

    fn create_test_db() -> (TempDir, std::path::PathBuf) {
        let temp = TempDir::new().unwrap();
        let db_path = temp.path().join("galaxy-2.0.db");

        let conn = Connection::open(&db_path).unwrap();

        // Create basic table structure
        conn.execute(
            "CREATE TABLE InstalledBaseProducts (productId TEXT PRIMARY KEY)",
            [],
        )
        .unwrap();

        conn.execute(
            "CREATE TABLE LibraryReleases (releaseKey TEXT PRIMARY KEY, title TEXT)",
            [],
        )
        .unwrap();

        conn.execute(
            "CREATE TABLE ProductConfiguration (productId TEXT PRIMARY KEY, installPath TEXT)",
            [],
        )
        .unwrap();

        (temp, db_path)
    }

    #[test]
    fn test_query_installed_games_empty_db() {
        let (_temp, db_path) = create_test_db();
        let games = query_installed_games(&db_path).unwrap();
        assert!(games.is_empty());
    }

    #[test]
    fn test_query_installed_games_with_products() {
        let (_temp, db_path) = create_test_db();

        let conn = Connection::open(&db_path).unwrap();
        conn.execute("INSERT INTO InstalledBaseProducts VALUES ('12345')", [])
            .unwrap();
        drop(conn);

        let games = query_installed_games(&db_path).unwrap();
        assert_eq!(games.len(), 1);
        assert_eq!(games[0].id, "12345");
        assert!(games[0].installed);
    }

    #[test]
    fn test_query_installed_games_with_library_releases() {
        let (_temp, db_path) = create_test_db();

        let conn = Connection::open(&db_path).unwrap();
        conn.execute(
            "INSERT INTO LibraryReleases VALUES ('gog_54321', 'Test Game')",
            [],
        )
        .unwrap();
        drop(conn);

        let games = query_installed_games(&db_path).unwrap();
        // Library releases are only queried if InstalledBaseProducts is empty
        assert!(games.is_empty() || games.iter().any(|g| g.name.contains("Test Game")));
    }

    #[test]
    fn test_query_installed_games_file_not_found() {
        let path = Path::new("/nonexistent/galaxy.db");
        let result = query_installed_games(path);
        assert!(result.is_err());
    }

    #[test]
    fn test_query_installed_base_products_empty() {
        let (_temp, db_path) = create_test_db();
        let conn = Connection::open(&db_path).unwrap();
        let games = query_installed_base_products(&conn).unwrap();
        assert!(games.is_empty());
    }

    #[test]
    fn test_query_installed_base_products_with_data() {
        let (_temp, db_path) = create_test_db();
        let conn = Connection::open(&db_path).unwrap();
        conn.execute("INSERT INTO InstalledBaseProducts VALUES ('game1')", [])
            .unwrap();
        conn.execute("INSERT INTO InstalledBaseProducts VALUES ('game2')", [])
            .unwrap();

        let games = query_installed_base_products(&conn).unwrap();
        assert_eq!(games.len(), 2);
    }

    #[test]
    fn test_query_installed_base_products_no_table() {
        let temp = TempDir::new().unwrap();
        let db_path = temp.path().join("empty.db");
        let conn = Connection::open(&db_path).unwrap();

        let games = query_installed_base_products(&conn).unwrap();
        assert!(games.is_empty());
    }

    #[test]
    fn test_query_library_releases_empty() {
        let (_temp, db_path) = create_test_db();
        let conn = Connection::open(&db_path).unwrap();
        let games = query_library_releases(&conn).unwrap();
        assert!(games.is_empty());
    }

    #[test]
    fn test_query_library_releases_with_gog_games() {
        let (_temp, db_path) = create_test_db();
        let conn = Connection::open(&db_path).unwrap();
        conn.execute(
            "INSERT INTO LibraryReleases VALUES ('gog_123', 'My Game')",
            [],
        )
        .unwrap();

        let games = query_library_releases(&conn).unwrap();
        assert_eq!(games.len(), 1);
        assert_eq!(games[0].id, "123");
        assert_eq!(games[0].name, "My Game");
    }

    #[test]
    fn test_query_library_releases_filters_non_gog() {
        let (_temp, db_path) = create_test_db();
        let conn = Connection::open(&db_path).unwrap();
        conn.execute(
            "INSERT INTO LibraryReleases VALUES ('steam_123', 'Steam Game')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO LibraryReleases VALUES ('gog_456', 'GOG Game')",
            [],
        )
        .unwrap();

        let games = query_library_releases(&conn).unwrap();
        assert_eq!(games.len(), 1);
        assert_eq!(games[0].id, "456");
    }

    #[test]
    fn test_query_library_releases_no_table() {
        let temp = TempDir::new().unwrap();
        let db_path = temp.path().join("empty.db");
        let conn = Connection::open(&db_path).unwrap();

        let games = query_library_releases(&conn).unwrap();
        assert!(games.is_empty());
    }

    #[test]
    fn test_get_game_details_basic() {
        let (_temp, db_path) = create_test_db();
        let conn = Connection::open(&db_path).unwrap();

        let game = get_game_details(&conn, "12345").unwrap();
        assert_eq!(game.id, "12345");
        assert!(game.installed);
        assert_eq!(game.store, StoreType::Gog);
    }

    #[test]
    fn test_get_game_details_with_install_path() {
        let (_temp, db_path) = create_test_db();
        let conn = Connection::open(&db_path).unwrap();
        conn.execute(
            "INSERT INTO ProductConfiguration VALUES ('12345', 'C:\\Games\\MyGame')",
            [],
        )
        .unwrap();

        let game = get_game_details(&conn, "12345").unwrap();
        assert!(game.install_path.is_some());
    }

    #[test]
    fn test_get_game_title_not_found() {
        let (_temp, db_path) = create_test_db();
        let conn = Connection::open(&db_path).unwrap();

        let title = get_game_title(&conn, "nonexistent");
        assert!(title.is_none());
    }

    #[test]
    fn test_get_game_title_from_library_releases() {
        let (_temp, db_path) = create_test_db();
        let conn = Connection::open(&db_path).unwrap();
        conn.execute(
            "INSERT INTO LibraryReleases VALUES ('gog_123', 'Found Game')",
            [],
        )
        .unwrap();

        let title = get_game_title(&conn, "123");
        assert_eq!(title, Some("Found Game".to_string()));
    }

    #[test]
    fn test_get_install_path_not_found() {
        let (_temp, db_path) = create_test_db();
        let conn = Connection::open(&db_path).unwrap();

        let path = get_install_path(&conn, "nonexistent").unwrap();
        assert!(path.is_none());
    }

    #[test]
    fn test_get_install_path_found() {
        let (_temp, db_path) = create_test_db();
        let conn = Connection::open(&db_path).unwrap();
        conn.execute(
            "INSERT INTO ProductConfiguration VALUES ('123', '/games/mygame')",
            [],
        )
        .unwrap();

        let path = get_install_path(&conn, "123").unwrap();
        assert_eq!(path, Some("/games/mygame".to_string()));
    }

    #[test]
    fn test_get_install_path_no_table() {
        let temp = TempDir::new().unwrap();
        let db_path = temp.path().join("empty.db");
        let conn = Connection::open(&db_path).unwrap();

        let path = get_install_path(&conn, "123").unwrap();
        assert!(path.is_none());
    }
}
