import { useState, useEffect, useRef, useCallback } from 'react';
import { GamesGrid, PageHeader, LoadingScreen, ErrorMessage } from '../components';
import { GOGIcon } from '../components/icons/StoreIcons';
import { SearchIcon } from '../components/icons/SearchIcon';
import { useGamesByStore, launchGame } from '../hooks';
import type { Game } from '../types';

export interface GOGConnectScreenProps {
  onBack?: () => void;
  onNavigateDown?: () => void;
}

export function GOGConnectScreen({ onBack, onNavigateDown }: GOGConnectScreenProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  const { games, loading, error, refresh, updateGameLastPlayed } = useGamesByStore('gog');

  const handleRefresh = async () => {
    setSyncing(true);
    try {
      await refresh();
    } finally {
      setSyncing(false);
    }
  };

  const handleLaunchGame = async (game: Game) => {
    try {
      const timestamp = await launchGame(`gog:${game.id}`);
      // Update the hook's state with new last_played (triggers re-sort)
      updateGameLastPlayed(`gog:${game.id}`, timestamp);
    } catch (err) {
      console.error('Failed to launch game:', err);
    }
  };

  const handleNavigateUp = useCallback(() => {
    searchButtonRef.current?.focus();
  }, []);

  // Listen for focus event from global keyboard handler
  useEffect(() => {
    const handleFocusGOGConnect = () => {
      searchButtonRef.current?.focus();
    };
    window.addEventListener('focus-gog-connect', handleFocusGOGConnect);
    return () => window.removeEventListener('focus-gog-connect', handleFocusGOGConnect);
  }, []);

  // Handle escape to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSearchOpen) {
        onBack?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, onBack]);

  if (loading && games.length === 0) {
    return (
      <LoadingScreen
        icon={<GOGIcon />}
        iconBgClass="bg-[#4a2a6a]"
        iconTextClass="text-[#ab47bc]"
        spinnerClass="border-t-[#ab47bc]"
        title="Scanning GOG Galaxy"
      />
    );
  }

  const installedCount = games.filter(g => g.installed).length;

  return (
    <div className="flex flex-col items-stretch justify-start text-left h-full overflow-y-auto">
      <PageHeader
        title="GOG Galaxy"
        subtitle={`${installedCount} games installed`}
        actions={
          <>
            <button
              ref={searchButtonRef}
              className="flex items-center gap-sm px-md py-sm bg-surface border-none rounded text-text-secondary cursor-pointer transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              onClick={() => setIsSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                  e.preventDefault();
                  const firstCard = document.querySelector('[data-game-id]') as HTMLButtonElement;
                  firstCard?.focus();
                } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                  e.preventDefault();
                  const next = (e.currentTarget as HTMLElement).nextElementSibling as HTMLButtonElement;
                  next?.focus();
                }
              }}
            >
              <SearchIcon />
              <span>Search</span>
              <kbd className="bg-tertiary px-1.5 py-0.5 rounded-sm font-sans text-xs text-text-muted">/</kbd>
            </button>
            <button
              className="px-md py-sm border-none rounded text-base font-semibold cursor-pointer transition-all duration-fast bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              onClick={handleRefresh}
              disabled={syncing}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                  e.preventDefault();
                  const firstCard = document.querySelector('[data-game-id]') as HTMLButtonElement;
                  firstCard?.focus();
                } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                  e.preventDefault();
                  const prev = (e.currentTarget as HTMLElement).previousElementSibling as HTMLButtonElement;
                  prev?.focus();
                }
              }}
            >
              {syncing ? 'Scanning...' : 'Refresh'}
            </button>
          </>
        }
      />

      {error && <ErrorMessage message={error} className="mx-xl mb-md" />}

      <GamesGrid
        games={games}
        loading={loading}
        error={error}
        onRefresh={handleRefresh}
        onLaunchGame={handleLaunchGame}
        onNavigateDown={onNavigateDown}
        onNavigateUp={handleNavigateUp}
        isSearchOpen={isSearchOpen}
        onSearchOpen={() => setIsSearchOpen(true)}
        onSearchClose={() => setIsSearchOpen(false)}
        emptyMessage="No GOG games found."
        emptySubMessage="Make sure GOG Galaxy is installed and you have games downloaded."
      />
    </div>
  );
}

