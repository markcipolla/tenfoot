import { useState, useRef, useCallback, useEffect } from 'react';
import { BottomBar, SidePanel, Screen } from './components';
import { StoresScreen, SteamConnectScreen, EpicConnectScreen, GOGConnectScreen, LibraryScreen, SettingsScreen } from './screens';
import { hasSyncedLibrary } from './hooks';
import './styles/global.css';

// Check if running in Tauri environment
const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

async function toggleFullscreen() {
  if (!isTauri()) return;
  try {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const window = getCurrentWindow();
    const isFullscreen = await window.isFullscreen();
    await window.setFullscreen(!isFullscreen);
  } catch (err) {
    console.error('Failed to toggle fullscreen:', err);
  }
}

type AppScreen = Screen | 'steam-connect' | 'epic-connect' | 'gog-connect';

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('stores');
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Load library first if synced data exists
  useEffect(() => {
    const checkSync = async () => {
      const hasSynced = await hasSyncedLibrary();
      if (hasSynced) {
        setCurrentScreen('library');
      }
    };
    checkSync();
  }, []);

  // Global keyboard shortcut for fullscreen (Cmd+Ctrl+F on Mac, F11 on Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
      // Use e.code for reliable key detection with modifiers
      if (isMac && e.metaKey && e.ctrlKey && e.code === 'KeyF') {
        e.preventDefault();
        toggleFullscreen();
      } else if (!isMac && e.code === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  const handleNavigate = (screen: Screen) => {
    setCurrentScreen(screen);
  };

  const handleStoreSelect = (storeId: string) => {
    if (storeId === 'steam') {
      setCurrentScreen('steam-connect');
    } else if (storeId === 'epic') {
      setCurrentScreen('epic-connect');
    } else if (storeId === 'gog') {
      setCurrentScreen('gog-connect');
    }
  };

  const handleStoreBack = () => {
    setCurrentScreen('stores');
  };

  const handleNavigateToBottomBar = useCallback(() => {
    menuButtonRef.current?.focus();
  }, []);

  const handleNavigateToContent = useCallback(() => {
    if (currentScreen === 'library') {
      window.dispatchEvent(new CustomEvent('focus-library'));
    } else if (currentScreen === 'settings') {
      window.dispatchEvent(new CustomEvent('focus-settings'));
    } else if (currentScreen === 'steam-connect') {
      window.dispatchEvent(new CustomEvent('focus-steam-connect'));
    } else if (currentScreen === 'epic-connect') {
      window.dispatchEvent(new CustomEvent('focus-epic-connect'));
    } else if (currentScreen === 'gog-connect') {
      window.dispatchEvent(new CustomEvent('focus-gog-connect'));
    } else {
      window.dispatchEvent(new CustomEvent('focus-stores'));
    }
  }, [currentScreen]);

  // Global keyboard handler to capture nav keys when focus is lost
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Skip if menu is open (SidePanel handles its own keys)
      if (isMenuOpen) return;

      // Skip if focus is on an input or textarea
      const activeElement = document.activeElement;
      if (activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA') return;

      // Skip if focus is on a button or other interactive element
      if (activeElement?.tagName === 'BUTTON') return;

      // Navigation keys
      const navKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'W', 'a', 'A', 's', 'S', 'd', 'D'];

      if (navKeys.includes(e.key)) {
        e.preventDefault();
        // Focus the current screen's content
        handleNavigateToContent();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isMenuOpen, handleNavigateToContent]);

  const renderScreen = () => {
    switch (currentScreen) {
      case 'stores':
        return (
          <StoresScreen
            onStoreSelect={handleStoreSelect}
            onNavigateDown={handleNavigateToBottomBar}
          />
        );
      case 'steam-connect':
        return (
          <SteamConnectScreen
            onBack={handleStoreBack}
            onNavigateDown={handleNavigateToBottomBar}
          />
        );
      case 'epic-connect':
        return (
          <EpicConnectScreen
            onBack={handleStoreBack}
            onNavigateDown={handleNavigateToBottomBar}
          />
        );
      case 'gog-connect':
        return (
          <GOGConnectScreen
            onBack={handleStoreBack}
            onNavigateDown={handleNavigateToBottomBar}
          />
        );
      case 'library':
        return (
          <LibraryScreen
            onNavigateDown={handleNavigateToBottomBar}
          />
        );
      case 'settings':
        return (
          <SettingsScreen
            onNavigateDown={handleNavigateToBottomBar}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-primary">
      <SidePanel
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        currentScreen={currentScreen === 'steam-connect' || currentScreen === 'epic-connect' || currentScreen === 'gog-connect' ? 'stores' : currentScreen}
        onNavigate={handleNavigate}
      />

      <main className="flex-1 overflow-hidden mb-bottom-bar">{renderScreen()}</main>

      <BottomBar
        ref={menuButtonRef}
        onMenuClick={toggleMenu}
        isMenuOpen={isMenuOpen}
        onNavigateUp={handleNavigateToContent}
      />
    </div>
  );
}

export default App;
