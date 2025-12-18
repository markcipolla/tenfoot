use std::path::PathBuf;

/// Steam installation paths
#[derive(Debug, Clone)]
pub struct SteamPaths {
    /// Path to Steam installation directory
    pub steam_path: Option<PathBuf>,
    /// Path to Steam executable
    pub steam_exe: Option<PathBuf>,
}

impl SteamPaths {
    /// Detect Steam installation on the current platform
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
            Self {
                steam_path: None,
                steam_exe: None,
            }
        }
    }

    /// Create paths with no Steam installation
    pub fn empty() -> Self {
        Self {
            steam_path: None,
            steam_exe: None,
        }
    }

    #[cfg(target_os = "windows")]
    fn detect_windows() -> Self {
        use winreg::enums::*;
        use winreg::RegKey;

        // Try to get Steam path from registry
        let steam_path = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey(r"SOFTWARE\WOW6432Node\Valve\Steam")
            .or_else(|_| RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(r"SOFTWARE\Valve\Steam"))
            .ok()
            .and_then(|key| key.get_value::<String, _>("InstallPath").ok())
            .map(PathBuf::from);

        let steam_exe = steam_path
            .as_ref()
            .map(|p| p.join("steam.exe"))
            .filter(|p| p.exists());

        // Fallback to common paths
        let steam_path = steam_path.or_else(|| {
            let common_paths = [r"C:\Program Files (x86)\Steam", r"C:\Program Files\Steam"];
            common_paths.iter().map(PathBuf::from).find(|p| p.exists())
        });

        let steam_exe = steam_exe.or_else(|| {
            steam_path
                .as_ref()
                .map(|p| p.join("steam.exe"))
                .filter(|p| p.exists())
        });

        Self {
            steam_path,
            steam_exe,
        }
    }

    #[cfg(target_os = "macos")]
    fn detect_macos() -> Self {
        let home = dirs::home_dir();

        let steam_path = home
            .as_ref()
            .map(|h| h.join("Library/Application Support/Steam"))
            .filter(|p| p.exists());

        let steam_exe = Some(PathBuf::from("/Applications/Steam.app")).filter(|p| p.exists());

        Self {
            steam_path,
            steam_exe,
        }
    }

    #[cfg(target_os = "linux")]
    fn detect_linux() -> Self {
        let home = dirs::home_dir();

        // Check common Steam paths on Linux
        let steam_paths = home
            .as_ref()
            .map(|h| {
                vec![
                    h.join(".steam/steam"),
                    h.join(".local/share/Steam"),
                    h.join(".steam"),
                ]
            })
            .unwrap_or_default();

        let steam_path = steam_paths
            .into_iter()
            .find(|p| p.exists() && p.join("steamapps").exists());

        // Find steam executable
        let steam_exe = which::which("steam").ok().or_else(|| {
            let common_exes = ["/usr/bin/steam", "/usr/local/bin/steam"];
            common_exes.iter().map(PathBuf::from).find(|p| p.exists())
        });

        Self {
            steam_path,
            steam_exe,
        }
    }
}

impl SteamPaths {
    /// Try to detect the logged-in Steam user's ID from local config files
    pub fn detect_steam_id(&self) -> Option<String> {
        let steam_path = self.steam_path.as_ref()?;
        let loginusers_path = steam_path.join("config").join("loginusers.vdf");

        if !loginusers_path.exists() {
            return None;
        }

        let content = std::fs::read_to_string(&loginusers_path).ok()?;

        // Parse the VDF to find the most recently logged in user
        // Format is:
        // "users"
        // {
        //     "76561198012345678"
        //     {
        //         "AccountName" "username"
        //         "MostRecent" "1"
        //         ...
        //     }
        // }
        let mut current_id: Option<String> = None;
        let mut most_recent_id: Option<String> = None;

        for line in content.lines() {
            let trimmed = line.trim();

            // Check if this is a Steam ID line (starts with a quote and contains 17-digit number)
            if trimmed.starts_with('"') && trimmed.len() > 17 {
                let potential_id = trimmed.trim_matches('"').trim();
                if potential_id.len() == 17 && potential_id.chars().all(|c| c.is_ascii_digit()) {
                    current_id = Some(potential_id.to_string());
                }
            }

            // Check if this user is the most recent
            if trimmed.contains("MostRecent") && trimmed.contains("\"1\"") {
                if let Some(id) = &current_id {
                    most_recent_id = Some(id.clone());
                }
            }
        }

        // Return most recent, or first found
        most_recent_id.or(current_id)
    }
}

impl Default for SteamPaths {
    fn default() -> Self {
        Self::detect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_steam_paths_empty() {
        let paths = SteamPaths::empty();
        assert!(paths.steam_path.is_none());
        assert!(paths.steam_exe.is_none());
    }

    #[test]
    fn test_steam_paths_clone() {
        let paths = SteamPaths {
            steam_path: Some(PathBuf::from("/test")),
            steam_exe: Some(PathBuf::from("/test/steam")),
        };
        let cloned = paths.clone();
        assert_eq!(paths.steam_path, cloned.steam_path);
        assert_eq!(paths.steam_exe, cloned.steam_exe);
    }

    #[test]
    fn test_steam_paths_debug() {
        let paths = SteamPaths::empty();
        let debug = format!("{:?}", paths);
        assert!(debug.contains("SteamPaths"));
    }

    #[test]
    fn test_steam_paths_default() {
        // This test just ensures Default works; actual detection depends on system
        let _paths = SteamPaths::default();
    }

    #[test]
    fn test_steam_paths_detect() {
        // This test just ensures detect() doesn't panic
        let _paths = SteamPaths::detect();
    }

    #[test]
    fn test_steam_paths_custom() {
        let paths = SteamPaths {
            steam_path: Some(PathBuf::from("/custom/steam")),
            steam_exe: Some(PathBuf::from("/custom/steam/steam.exe")),
        };
        assert_eq!(paths.steam_path.unwrap(), PathBuf::from("/custom/steam"));
        assert_eq!(
            paths.steam_exe.unwrap(),
            PathBuf::from("/custom/steam/steam.exe")
        );
    }
}
