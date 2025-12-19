import { useState, useEffect, useRef, useCallback } from 'react';
import { GamesGrid, PageHeader } from '../components';
import { GOGIcon } from '../components/icons/StoreIcons';
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
      <div className="flex flex-col items-center justify-center min-h-full p-xl text-center overflow-y-auto">
        <div className="flex flex-col items-center gap-lg max-w-[400px]">
          <div className="w-20 h-20 flex items-center justify-center bg-[#4a2a6a] rounded-xl text-[#ab47bc] animate-pulse [&_svg]:w-12 [&_svg]:h-12 [&_img]:w-12 [&_img]:h-12">
            <GOGIcon />
          </div>
          <h1 className="text-[1.75rem] font-bold text-text-primary m-0">Scanning GOG Galaxy</h1>
          <p className="text-base text-text-secondary m-0 leading-relaxed">
            Looking for installed games...
          </p>
          <div className="w-8 h-8 border-3 border-surface border-t-[#ab47bc] rounded-full animate-spin" />
        </div>
      </div>
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
                  // Focus the first game card in the grid
                  const firstCard = document.querySelector('[data-game-id]') as HTMLButtonElement;
                  firstCard?.focus();
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
            >
              {syncing ? 'Scanning...' : 'Refresh'}
            </button>
          </>
        }
      />

      {error && (
        <div className="px-md py-sm mx-xl bg-[rgba(255,100,100,0.1)] border border-[rgba(255,100,100,0.3)] rounded text-[#ff6b6b] text-[0.85rem] mb-md">
          {error}
        </div>
      )}

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

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
