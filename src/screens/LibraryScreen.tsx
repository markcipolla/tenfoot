import { useState, useRef, useEffect, useCallback } from 'react';
import { GameCard } from '../components/GameCard';
import { GameInfoPanel } from '../components/GameInfoPanel';
import { PageHeader } from '../components/PageHeader';
import { SearchPanel } from '../components/SearchPanel';
import { useGamesSortedByLastPlayed, launchGame, installSteamGame } from '../hooks';
import type { Game } from '../types';

export interface LibraryScreenProps {
  onNavigateDown?: () => void;
  storeFilter?: 'steam' | 'epic' | 'gog' | null;
}

export function LibraryScreen({ onNavigateDown, storeFilter }: LibraryScreenProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const { games: allGames, loading, error, refresh, updateGameLastPlayed } = useGamesSortedByLastPlayed();

  // Filter games by store if specified
  const games = storeFilter
    ? allGames.filter(g => g.store === storeFilter)
    : allGames;
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const libraryRef = useRef<HTMLDivElement>(null);
  // Track last focused index in each section for better navigation
  const lastInstalledIndex = useRef(0);
  const lastUninstalledIndex = useRef(0);
  // Track counts for event handlers
  const installedCountRef = useRef(0);
  const uninstalledCountRef = useRef(0);

  const handleGameSelect = (game: Game) => {
    setSelectedGame(game);
  };

  const handlePlayGame = async () => {
    if (!selectedGame) return;
    if (selectedGame.installed) {
      try {
        const gameKey = `${selectedGame.store}:${selectedGame.id}`;
        const timestamp = await launchGame(gameKey);
        // Update the hook's state with new last_played (triggers re-sort)
        updateGameLastPlayed(gameKey, timestamp);
        // Update selected game as well
        setSelectedGame(prev => prev ? { ...prev, last_played: timestamp } : null);
      } catch (err) {
        console.error('Failed to launch game:', err);
      }
    }
  };

  const handleInstallGame = async () => {
    if (!selectedGame) return;
    if (selectedGame.store === 'steam') {
      try {
        await installSteamGame(selectedGame.id);
      } catch (err) {
        console.error('Failed to install game:', err);
      }
    }
  };

  const handleCloseInfo = () => {
    setSelectedGame(null);
    // Refocus the card that was selected
    cardRefs.current[focusedIndex]?.focus();
  };

  const focusCard = useCallback((index: number) => {
    const installedCount = games.filter(g => g.installed).length;
    const clampedIndex = Math.max(0, Math.min(index, games.length - 1));
    setFocusedIndex(clampedIndex);

    // Track last position in each section
    if (clampedIndex < installedCount) {
      lastInstalledIndex.current = clampedIndex;
    } else {
      lastUninstalledIndex.current = clampedIndex;
    }

    const card = cardRefs.current[clampedIndex];
    if (card) {
      card.focus();
      // Use 'center' to ensure the full row is visible, accounting for card scale on focus
      card.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [games]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isSearchOpen || selectedGame) return;
    if (games.length === 0) return;

    // Only handle keyboard navigation if focus is within the library screen
    if (!libraryRef.current?.contains(document.activeElement)) return;

    const installedCount = games.filter(g => g.installed).length;
    const cols = 5;
    let nextIndex = focusedIndex;

    switch (e.key) {
      case 'ArrowRight':
      case 'd':
      case 'D':
        // Don't wrap - stay at last game in current section
        if (focusedIndex < installedCount - 1) {
          nextIndex = focusedIndex + 1;
        } else if (focusedIndex >= installedCount && focusedIndex < games.length - 1) {
          nextIndex = focusedIndex + 1;
        }
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        // Don't wrap - stay at first game in current section
        if (focusedIndex > 0 && focusedIndex < installedCount) {
          nextIndex = focusedIndex - 1;
        } else if (focusedIndex > installedCount) {
          nextIndex = focusedIndex - 1;
        }
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        // From installed grid, go to next row or uninstalled section
        if (focusedIndex < installedCount) {
          if (focusedIndex + cols < installedCount) {
            nextIndex = focusedIndex + cols;
          } else if (installedCount < games.length) {
            // Move to first uninstalled game
            nextIndex = installedCount;
          } else {
            // No uninstalled games, navigate to menu
            e.preventDefault();
            onNavigateDown?.();
            return;
          }
        } else {
          // Already in uninstalled row, navigate to menu
          e.preventDefault();
          onNavigateDown?.();
          return;
        }
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        if (focusedIndex >= installedCount) {
          // From uninstalled, go to last focused installed game
          nextIndex = Math.min(lastInstalledIndex.current, installedCount - 1);
        } else if (focusedIndex - cols < 0) {
          // At first row of installed, go to search button
          e.preventDefault();
          searchButtonRef.current?.focus();
          return;
        } else {
          nextIndex = focusedIndex - cols;
        }
        break;
      case '/':
      case 'f':
        if (!e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          setIsSearchOpen(true);
        }
        return;
      default:
        return;
    }

    e.preventDefault();
    focusCard(nextIndex);
  }, [focusedIndex, games, isSearchOpen, selectedGame, focusCard, onNavigateDown]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Only focus first card on initial load, not on every change
  const hasInitialFocus = useRef(false);
  useEffect(() => {
    if (!isSearchOpen && games.length > 0 && !hasInitialFocus.current) {
      hasInitialFocus.current = true;
      const timer = setTimeout(() => focusCard(0), 100);
      return () => clearTimeout(timer);
    }
  }, [isSearchOpen, games.length, focusCard]);

  useEffect(() => {
    const handleFocusLibrary = () => {
      // When coming from menu, focus first game in bottom section
      const installedCount = installedCountRef.current;
      const uninstalledCount = uninstalledCountRef.current;

      if (uninstalledCount > 0) {
        // Has uninstalled games, focus first one (index = installed count)
        focusCard(installedCount);
      } else if (installedCount > 0) {
        // Only installed games, focus first one
        focusCard(0);
      }
    };
    window.addEventListener('focus-library', handleFocusLibrary);
    return () => window.removeEventListener('focus-library', handleFocusLibrary);
  }, [focusCard]);

  const setCardRef = (index: number) => (el: HTMLButtonElement | null) => {
    cardRefs.current[index] = el;
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full pt-md">
        <div className="flex-1 flex flex-col items-center justify-center text-text-secondary text-center">
          <div className="w-10 h-10 border-3 border-surface border-t-accent rounded-full animate-spin mb-md" />
          <p>Loading your library...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full pt-md">
        <div className="flex-1 flex flex-col items-center justify-center text-text-secondary text-center">
          <p>Failed to load games</p>
          <p className="text-[0.85rem] text-text-muted my-sm">{error}</p>
          <button
            className="mt-md px-lg py-sm bg-accent border-none rounded text-white font-semibold cursor-pointer transition-colors duration-fast hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            onClick={refresh}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const installedGames = games.filter(g => g.installed);
  const uninstalledGames = games.filter(g => !g.installed);

  // Update counts refs for event handlers
  installedCountRef.current = installedGames.length;
  uninstalledCountRef.current = uninstalledGames.length;

  return (
    <div className="flex flex-col h-full pt-md" ref={libraryRef}>
      {isSearchOpen && (
        <SearchPanel
          games={games}
          onGameSelect={handleGameSelect}
          onClose={() => setIsSearchOpen(false)}
        />
      )}

      {selectedGame && (
        <GameInfoPanel
          game={selectedGame}
          onPlay={handlePlayGame}
          onInstall={handleInstallGame}
          onClose={handleCloseInfo}
        />
      )}

      <PageHeader
        title={storeFilter
          ? `${storeFilter.charAt(0).toUpperCase() + storeFilter.slice(1)} Games`
          : "Library"}
        subtitle={uninstalledGames.length > 0
          ? `${installedGames.length} of ${games.length} games installed`
          : `${games.length} games`}
        actions={
          <button
            ref={searchButtonRef}
            className="flex items-center gap-sm px-md py-sm bg-surface border-none rounded text-text-secondary cursor-pointer transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            onClick={() => setIsSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                e.preventDefault();
                focusCard(0);
              } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
                e.preventDefault();
                onNavigateDown?.();
              }
            }}
          >
            <SearchIcon />
            <span>Search</span>
            <kbd className="bg-tertiary px-1.5 py-0.5 rounded-sm font-sans text-xs text-text-muted">/</kbd>
          </button>
        }
      />

      {games.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-text-secondary text-center">
          <h2 className="text-xl font-semibold text-text-primary m-0 mb-sm">No games in your library</h2>
          <p className="m-0 text-text-muted">Connect to a store to add games to your library.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {installedGames.length > 0 && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-0 p-sm px-md pb-md">
              {installedGames.map((game, index) => (
                <GameCard
                  key={`${game.store}:${game.id}`}
                  ref={setCardRef(index)}
                  game={game}
                  onClick={() => handleGameSelect(game)}
                  onFocus={() => setFocusedIndex(index)}
                  featured={index === 0 && game.last_played != null}
                />
              ))}
            </div>
          )}

          {uninstalledGames.length > 0 && (
            <div className="mt-lg py-md pl-md border-t border-surface">
              <h3 className="text-[0.85rem] font-semibold text-text-secondary m-0 mb-sm ml-xs pr-md uppercase tracking-wide">Not Installed</h3>
              <div className="flex gap-0 overflow-x-auto overflow-y-visible py-sm scroll-pl-xs [scrollbar-width:thin] [scrollbar-color:var(--color-surface-hover)_transparent] before:content-[''] before:shrink-0 before:w-xs after:content-[''] after:shrink-0 after:w-md [&_.game-card-wrapper]:shrink-0 [&_.game-card-wrapper]:w-[140px]">
                {uninstalledGames.map((game, index) => (
                  <GameCard
                    key={`${game.store}:${game.id}`}
                    ref={setCardRef(installedGames.length + index)}
                    game={game}
                    onClick={() => handleGameSelect(game)}
                    onFocus={() => setFocusedIndex(installedGames.length + index)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
