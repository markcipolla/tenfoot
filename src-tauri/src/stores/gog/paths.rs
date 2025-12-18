use std::path::PathBuf;

/// GOG Galaxy installation paths
#[derive(Debug, Clone)]
pub struct GogPaths {
    /// Path to GOG Galaxy installation
    pub galaxy_path: Option<PathBuf>,
    /// Path to GOG Galaxy executable
    pub galaxy_exe: Option<PathBuf>,
    /// Path to GOG Galaxy database
    pub database_path: Option<PathBuf>,
}

impl GogPaths {
    /// Detect GOG Galaxy installation on the current platform
    pub fn detect() -> Self {
        #[cfg(target_os = "windows")]
        {
            Self::detect_windows()
        }

        #[cfg(target_os = "macos")]
        {
            Self::detect_macos()
        }

        #[cfg(target_os = "linux")]
        {
            Self::detect_linux()
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            Self::empty()
        }
    }

    /// Create paths with no GOG installation
    pub fn empty() -> Self {
        Self {
            galaxy_path: None,
            galaxy_exe: None,
            database_path: None,
        }
    }

    #[cfg(target_os = "windows")]
    fn detect_windows() -> Self {
        use winreg::enums::*;
        use winreg::RegKey;

        // Try to get GOG Galaxy path from registry
        let galaxy_path = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey(r"SOFTWARE\WOW6432Node\GOG.com\GalaxyClient\paths")
            .or_else(|_| {
                RegKey::predef(HKEY_LOCAL_MACHINE)
                    .open_subkey(r"SOFTWARE\GOG.com\GalaxyClient\paths")
            })
            .ok()
            .and_then(|key| key.get_value::<String, _>("client").ok())
            .map(PathBuf::from);

        let galaxy_exe = galaxy_path
            .as_ref()
            .map(|p| p.join("GalaxyClient.exe"))
            .filter(|p| p.exists())
            .or_else(|| {
                let common_paths = [
                    r"C:\Program Files (x86)\GOG Galaxy\GalaxyClient.exe",
                    r"C:\Program Files\GOG Galaxy\GalaxyClient.exe",
                ];
                common_paths.iter().map(PathBuf::from).find(|p| p.exists())
            });

        // GOG Galaxy database is in ProgramData
        let database_path = Some(PathBuf::from(
            r"C:\ProgramData\GOG.com\Galaxy\storage\galaxy-2.0.db",
        ))
        .filter(|p| p.exists());

        let galaxy_path = galaxy_path.or_else(|| {
            galaxy_exe
                .as_ref()
                .and_then(|p| p.parent().map(PathBuf::from))
        });

        Self {
            galaxy_path,
            galaxy_exe,
            database_path,
        }
    }

    #[cfg(target_os = "macos")]
    fn detect_macos() -> Self {
        let galaxy_exe = Some(PathBuf::from("/Applications/GOG Galaxy.app")).filter(|p| p.exists());

        let galaxy_path = galaxy_exe.clone();

        let database_path = dirs::home_dir()
            .map(|h| h.join("Library/Application Support/GOG.com/Galaxy/storage/galaxy-2.0.db"))
            .filter(|p| p.exists());

        Self {
            galaxy_path,
            galaxy_exe,
            database_path,
        }
    }

    #[cfg(target_os = "linux")]
    fn detect_linux() -> Self {
        // GOG Galaxy doesn't officially support Linux, but the database might exist
        // if running via Wine or if GOG games are installed via Heroic

        let database_path = dirs::home_dir()
            .map(|h| {
                // Check Wine prefix locations
                vec![
                    h.join(".wine/drive_c/ProgramData/GOG.com/Galaxy/storage/galaxy-2.0.db"),
                    h.join("Games/gog-galaxy/storage/galaxy-2.0.db"),
                ]
            })
            .unwrap_or_default()
            .into_iter()
            .find(|p| p.exists());

        Self {
            galaxy_path: None,
            galaxy_exe: None,
            database_path,
        }
    }
}

impl Default for GogPaths {
    fn default() -> Self {
        Self::detect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gog_paths_empty() {
        let paths = GogPaths::empty();
        assert!(paths.galaxy_path.is_none());
        assert!(paths.galaxy_exe.is_none());
        assert!(paths.database_path.is_none());
    }

    #[test]
    fn test_gog_paths_clone() {
        let paths = GogPaths {
            galaxy_path: Some(PathBuf::from("/test")),
            galaxy_exe: Some(PathBuf::from("/test/galaxy.exe")),
            database_path: Some(PathBuf::from("/test/db.db")),
        };
        let cloned = paths.clone();
        assert_eq!(paths.galaxy_path, cloned.galaxy_path);
        assert_eq!(paths.galaxy_exe, cloned.galaxy_exe);
        assert_eq!(paths.database_path, cloned.database_path);
    }

    #[test]
    fn test_gog_paths_debug() {
        let paths = GogPaths::empty();
        let debug = format!("{:?}", paths);
        assert!(debug.contains("GogPaths"));
    }

    #[test]
    fn test_gog_paths_default() {
        // This test just ensures Default works; actual detection depends on system
        let _paths = GogPaths::default();
    }

    #[test]
    fn test_gog_paths_detect() {
        // This test just ensures detect() doesn't panic
        let _paths = GogPaths::detect();
    }

    #[test]
    fn test_gog_paths_custom() {
        let paths = GogPaths {
            galaxy_path: Some(PathBuf::from("/custom/gog")),
            galaxy_exe: Some(PathBuf::from("/custom/gog/galaxy.exe")),
            database_path: Some(PathBuf::from("/custom/db.db")),
        };
        assert_eq!(paths.galaxy_path.unwrap(), PathBuf::from("/custom/gog"));
        assert_eq!(
            paths.galaxy_exe.unwrap(),
            PathBuf::from("/custom/gog/galaxy.exe")
        );
        assert_eq!(paths.database_path.unwrap(), PathBuf::from("/custom/db.db"));
    }
}
