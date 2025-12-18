# Game Launcher Research

## Part 1: Cross-Platform Frontend Technology Options

### Option 1: Tauri + Web Frontend (Recommended)

**What it is:** Rust backend with web-based frontend (React, Vue, Svelte, etc.)

**Pros:**
- Tiny binary sizes (~10MB vs 150MB+ for Electron)
- Native system integration via Rust plugins
- Excellent cross-platform support (Windows, macOS, Linux, mobile with Tauri 2.0)
- Use any web framework for UI (React, Vue, Svelte, SolidJS)
- Strong security model with capability-based permissions
- Active development and growing ecosystem
- Can leverage existing web UI libraries for Big Picture Mode style interfaces
- Hot reload during development

**Cons:**
- Relies on system webview (can cause inconsistencies between platforms)
- Less mature than Electron for edge cases
- Some advanced CSS features may behave differently across webviews
- Slightly more complex IPC compared to pure web apps

**Best for:** Production-ready cross-platform apps where bundle size and performance matter

---

### Option 2: Rust + egui (Immediate Mode GUI)

**What it is:** Pure Rust with egui immediate-mode GUI library

**Pros:**
- Pure Rust - no JavaScript, single language stack
- Extremely fast startup and runtime
- Can integrate with game engines (Bevy, wgpu)
- Great for debug UIs and tools
- No external dependencies on webview

**Cons:**
- Immediate mode paradigm has learning curve
- Limited styling options out of the box
- Less polished "app-like" appearance
- Fewer ready-made components for complex UIs
- Accessibility features still maturing

**Best for:** Performance-critical tools, game engine integrations, developers who want pure Rust

---

### Option 3: Rust + Iced

**What it is:** Elm-inspired reactive GUI library for Rust

**Pros:**
- Pure Rust with type-safe reactive architecture
- GPU-accelerated rendering
- Clean, functional programming model
- Good for data-driven UIs

**Cons:**
- Steeper learning curve (Elm architecture)
- Fewer widgets than web-based solutions
- Still maturing ecosystem
- Custom styling requires more effort

**Best for:** Developers who prefer functional/reactive patterns in pure Rust

---

### Option 4: Rust + Dioxus

**What it is:** React-like framework for Rust with multiple renderers

**Pros:**
- React-like syntax with hooks (familiar to web devs)
- Multiple backends: web, desktop, TUI, mobile
- Hot reload support
- Good documentation

**Cons:**
- Younger than Tauri
- Smaller ecosystem of ready-made components
- Still stabilizing API

**Best for:** React developers who want to transition to Rust

---

### Option 5: Electron

**What it is:** Chromium + Node.js for desktop apps

**Pros:**
- Most mature cross-platform solution
- Massive ecosystem of npm packages
- Perfect webview consistency (bundles Chrome)
- Heroic Games Launcher uses this successfully
- Easy to find developers

**Cons:**
- Large binary size (150MB+)
- High memory usage (each app is a Chrome instance)
- Security concerns with Node.js integration
- Slower startup compared to native solutions

**Best for:** Teams prioritizing development speed over resource efficiency

---

### Option 6: Qt (C++ or Python)

**What it is:** Mature cross-platform C++ framework

**Pros:**
- Battle-tested, extremely mature
- Excellent native look and feel
- QML for declarative UI
- Strong gamepad/input support

**Cons:**
- Complex licensing (GPL/LGPL or commercial)
- C++ complexity or Python performance tradeoffs
- Heavier learning curve
- Build system complexity

**Best for:** Enterprise applications, teams with C++ expertise

---

### Option 7: Flutter

**What it is:** Dart-based cross-platform UI framework by Google

**Pros:**
- Beautiful, consistent UI across platforms
- Hot reload
- Strong mobile support
- Growing desktop support

**Cons:**
- Dart is niche language
- Desktop support less mature than mobile
- Binary size still relatively large
- Less system-level integration capabilities

**Best for:** Mobile-first apps that need desktop support

---

## Recommendation: Tauri + React/SolidJS

For a Big Picture Mode style game launcher, I recommend **Tauri 2.0 with a modern web framework** because:

1. **Performance**: Near-native startup and runtime performance
2. **UI Flexibility**: Full access to CSS for custom Big Picture styling
3. **Gamepad Support**: Web Gamepad API + Rust native support
4. **Proven Pattern**: Similar architecture to Heroic Games Launcher
5. **Cross-Platform**: Windows, macOS, Linux from single codebase
6. **System Integration**: Rust plugins for file system, process management
7. **Future-Proof**: Mobile support in Tauri 2.0

---

## Part 2: Store Integration Research

### Steam Integration

#### Getting Owned Games (Web API)
- **Endpoint**: `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/`
- **Requires**: Steam Web API key + user's Steam ID
- **Privacy**: Only works for public profiles or your own account
- **Rate Limit**: 100,000 requests/day

**API Response includes:**
- App ID
- Playtime (total and recent 2 weeks)
- Optional: Game name and icon URLs

#### Detecting Installed Games (Local Files)

**Library Folders VDF:**
```
Location: C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf
Format: Valve KeyValue format
Contains: Paths to all Steam library folders
```

**App Manifest Files:**
```
Location: {library}/steamapps/appmanifest_{appid}.acf
Format: Valve KeyValue format
Contains: Install state, name, install directory, size
```

**Key parsing libraries:**
- Rust: `keyvalues-parser`, `vdf-parser`
- JavaScript: `vdf-parser`

#### Launching Games

**Method 1 - Protocol:**
```
steam://rungameid/{appid}
```

**Method 2 - Command Line (Recommended):**
```
steam.exe -applaunch {appid} [launch_options]
```

---

### Epic Games Integration

#### Getting Owned/Installed Games

**No public API** - must use local file detection or unofficial methods.

**Manifest Files:**
```
Location: C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests\*.item
Format: JSON
```

**Registry Key (for launcher path):**
```
HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Epic Games\EpicGamesLauncher
Key: AppDataPath
```

**Installed Games Data:**
```
Location: C:\ProgramData\Epic\UnrealEngineLauncher\LauncherInstalled.dat
Format: JSON
```

**Manifest fields:**
- `AppName` - Unique identifier
- `DisplayName` - Game title
- `InstallLocation` - Install path
- `LaunchExecutable` - Main executable
- `AppVersionString` - Installed version

#### Launching Games

**Method 1 - Protocol:**
```
com.epicgames.launcher://apps/{AppName}?action=launch
```

**Method 2 - Direct executable with portal bypass:**
```
"{InstallLocation}/{LaunchExecutable}" -epicportal
```

#### Reference Implementation
The open-source [Legendary](https://github.com/derrod/legendary) CLI tool handles Epic authentication and game management. Heroic Games Launcher uses this.

---

### GOG Galaxy Integration

#### Getting Installed Games

**SQLite Database:**
```
Location: C:\ProgramData\GOG.com\Galaxy\storage\galaxy-2.0.db
Format: SQLite3
```

**Key Tables:**
- `InstalledBaseProducts` - Installed game IDs
- `ProductConfiguration` - Game config
- `LibraryReleases` - Game metadata
- `UserReleaseTags` - User tags

**Example Query:**
```sql
SELECT * FROM InstalledBaseProducts;
SELECT * FROM LibraryReleases WHERE releaseKey LIKE 'gog_%';
```

#### Game Detection Requirements
Games need these files in root folder for proper detection:
- `goggame-{gameId}.dll`
- `goggame-{gameId}.hashdb`

#### Launching Games

**Method 1 - Protocol:**
```
goggalaxy://runGame/{gameId}
```

**Method 2 - GalaxyClient:**
```
GalaxyClient.exe /command=runGame /gameId={gameId}
```

#### Reference Implementation
[GOGdl](https://github.com/Heroic-Games-Launcher/heroic-gogdl) - Used by Heroic Games Launcher for GOG integration.

---

## Part 3: Existing Open Source References

### Heroic Games Launcher
- **GitHub**: https://github.com/Heroic-Games-Launcher/HeroicGamesLauncher
- **Stack**: Electron + React + TypeScript
- **Supports**: Epic (via Legendary), GOG (via GOGdl), Amazon Prime Gaming
- **License**: GPLv3
- **Key Insight**: Uses CLI tools (Legendary, GOGdl) for store integration

### Playnite
- **GitHub**: https://github.com/JosefNemworker/Playnite
- **Stack**: C#/.NET + WPF
- **Supports**: Steam, Epic, GOG, Origin, Uplay, itch.io, etc.
- **Has**: Full Screen mode (Big Picture alternative)
- **License**: MIT

### Legendary
- **GitHub**: https://github.com/derrod/legendary
- **Stack**: Python
- **Purpose**: Epic Games Store CLI client
- **Features**: Auth, download, install, launch games
- **License**: GPLv3

---

## Part 4: Architecture Recommendations

### Modular Store Integration Design

```
src/
├── core/
│   ├── game.rs          # Unified Game struct
│   ├── library.rs       # Game library management
│   └── launcher.rs      # Launch coordination
├── stores/
│   ├── mod.rs           # Store trait definition
│   ├── steam/
│   │   ├── mod.rs
│   │   ├── api.rs       # Web API client
│   │   ├── local.rs     # VDF/ACF parsing
│   │   └── launch.rs    # Game launching
│   ├── epic/
│   │   ├── mod.rs
│   │   ├── manifest.rs  # Manifest parsing
│   │   └── launch.rs
│   └── gog/
│       ├── mod.rs
│       ├── database.rs  # SQLite parsing
│       └── launch.rs
└── ui/
    └── ... (Tauri frontend)
```

### Core Trait Design

```rust
pub trait GameStore {
    /// Unique identifier for this store
    fn store_id(&self) -> &'static str;

    /// Get all games (owned + installed status)
    async fn get_games(&self) -> Result<Vec<Game>>;

    /// Check if a specific game is installed
    fn is_installed(&self, game_id: &str) -> bool;

    /// Get install path for a game
    fn get_install_path(&self, game_id: &str) -> Option<PathBuf>;

    /// Launch a game
    async fn launch(&self, game_id: &str) -> Result<()>;

    /// Get game artwork/cover URL
    fn get_artwork_url(&self, game_id: &str) -> Option<String>;
}
```
