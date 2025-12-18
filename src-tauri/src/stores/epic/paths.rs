use std::path::PathBuf;

/// Epic Games Store installation paths
#[derive(Debug, Clone)]
pub struct EpicPaths {
    /// Path to Epic Games Launcher installation
    pub launcher_path: Option<PathBuf>,
    /// Path to Epic Games Launcher executable
    pub launcher_exe: Option<PathBuf>,
    /// Path to game manifests directory
    pub manifests_path: Option<PathBuf>,
}

impl EpicPaths {
    /// Detect Epic Games installation on the current platform
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
            // Epic doesn't officially support Linux
            Self::empty()
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            Self::empty()
        }
    }

    /// Create paths with no Epic installation
    pub fn empty() -> Self {
        Self {
            launcher_path: None,
            launcher_exe: None,
            manifests_path: None,
        }
    }

    #[cfg(target_os = "windows")]
    fn detect_windows() -> Self {
        use winreg::enums::*;
        use winreg::RegKey;

        // Try to get Epic path from registry
        let launcher_path = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey(r"SOFTWARE\WOW6432Node\Epic Games\EpicGamesLauncher")
            .ok()
            .and_then(|key| key.get_value::<String, _>("AppDataPath").ok())
            .map(PathBuf::from);

        // Default manifests location
        let manifests_path = Some(PathBuf::from(
            r"C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests",
        ))
        .filter(|p| p.exists())
        .or_else(|| {
            launcher_path
                .as_ref()
                .map(|p| p.join("Manifests"))
                .filter(|p| p.exists())
        });

        // Find launcher executable
        let launcher_exe = RegKey::predef(HKEY_LOCAL_MACHINE)
            .open_subkey(r"SOFTWARE\WOW6432Node\Epic Games\EpicGamesLauncher")
            .ok()
            .and_then(|key| key.get_value::<String, _>("AppDataPath").ok())
            .map(|p| PathBuf::from(p).join("Launcher").join("Portal").join("Binaries").join("Win64").join("EpicGamesLauncher.exe"))
            .filter(|p| p.exists())
            .or_else(|| {
                let common_paths = [
                    r"C:\Program Files (x86)\Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe",
                    r"C:\Program Files\Epic Games\Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe",
                ];
                common_paths.iter().map(PathBuf::from).find(|p| p.exists())
            });

        let launcher_path = launcher_path.or_else(|| {
            launcher_exe.as_ref().and_then(|p| {
                p.parent()
                    .and_then(|p| p.parent())
                    .and_then(|p| p.parent())
                    .and_then(|p| p.parent())
                    .map(PathBuf::from)
            })
        });

        Self {
            launcher_path,
            launcher_exe,
            manifests_path,
        }
    }

    #[cfg(target_os = "macos")]
    fn detect_macos() -> Self {
        let launcher_exe =
            Some(PathBuf::from("/Applications/Epic Games Launcher.app")).filter(|p| p.exists());

        let launcher_path = launcher_exe.as_ref().map(|_| {
            dirs::home_dir()
                .map(|h| h.join("Library/Application Support/Epic"))
                .unwrap_or_default()
        });

        let manifests_path = launcher_path
            .as_ref()
            .map(|p| p.join("EpicGamesLauncher/Data/Manifests"))
            .filter(|p| p.exists());

        Self {
            launcher_path,
            launcher_exe,
            manifests_path,
        }
    }
}

impl Default for EpicPaths {
    fn default() -> Self {
        Self::detect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_epic_paths_empty() {
        let paths = EpicPaths::empty();
        assert!(paths.launcher_path.is_none());
        assert!(paths.launcher_exe.is_none());
        assert!(paths.manifests_path.is_none());
    }

    #[test]
    fn test_epic_paths_clone() {
        let paths = EpicPaths {
            launcher_path: Some(PathBuf::from("/test")),
            launcher_exe: Some(PathBuf::from("/test/epic.exe")),
            manifests_path: Some(PathBuf::from("/test/manifests")),
        };
        let cloned = paths.clone();
        assert_eq!(paths.launcher_path, cloned.launcher_path);
        assert_eq!(paths.launcher_exe, cloned.launcher_exe);
        assert_eq!(paths.manifests_path, cloned.manifests_path);
    }

    #[test]
    fn test_epic_paths_debug() {
        let paths = EpicPaths::empty();
        let debug = format!("{:?}", paths);
        assert!(debug.contains("EpicPaths"));
    }

    #[test]
    fn test_epic_paths_default() {
        // This test just ensures Default works; actual detection depends on system
        let _paths = EpicPaths::default();
    }

    #[test]
    fn test_epic_paths_detect() {
        // This test just ensures detect() doesn't panic
        let _paths = EpicPaths::detect();
    }

    #[test]
    fn test_epic_paths_custom() {
        let paths = EpicPaths {
            launcher_path: Some(PathBuf::from("/custom/epic")),
            launcher_exe: Some(PathBuf::from("/custom/epic/launcher.exe")),
            manifests_path: Some(PathBuf::from("/custom/manifests")),
        };
        assert_eq!(paths.launcher_path.unwrap(), PathBuf::from("/custom/epic"));
        assert_eq!(
            paths.launcher_exe.unwrap(),
            PathBuf::from("/custom/epic/launcher.exe")
        );
        assert_eq!(
            paths.manifests_path.unwrap(),
            PathBuf::from("/custom/manifests")
        );
    }
}
