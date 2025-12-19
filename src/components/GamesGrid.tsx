import { useState, useRef, useCallback } from 'react';
import { GameCard } from './GameCard';
import { GameInfoPanel } from './GameInfoPanel';
import { SearchPanel } from './SearchPanel';
import { useGridNavigation } from '../hooks/useGridNavigation';
import type { Game } from '../types';

export interface GamesGridProps {
  games: Game[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onLaunchGame?: (game: Game) => Promise<void>;
  onInstallGame?: (game: Game) => Promise<void>;
  onNavigateDown?: () => void;
  onNavigateUp?: () => void;
  isSearchOpen?: boolean;
  onSearchOpen?: () => void;
  onSearchClose?: () => void;
  emptyMessage?: string;
  emptySubMessage?: string;
}

export function GamesGrid({
  games,
  loading = false,
  error = null,
  onRefresh,
  onLaunchGame,
  onInstallGame,
  onNavigateDown,
  onNavigateUp,
  isSearchOpen = false,
  onSearchOpen,
  onSearchClose,
  emptyMessage = 'No games found.',
  emptySubMessage = 'Make sure the store client is installed.',
}: GamesGridProps) {
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const getColumnCount = useCallback(() => {
    if (!gridRef.current) return 5;
    const gridWidth = gridRef.current.offsetWidth;
    const minColWidth = 140;
    return Math.max(1, Math.floor(gridWidth / minColWidth));
  }, []);

  // Find where installed games end and uninstalled begin (for section-aware navigation)
  const sectionBreakIndex = games.findIndex(g => !g.installed);

  const { focusIndex, handleKeyDown: gridHandleKeyDown, setItemRef } = useGridNavigation({
    itemCount: games.length,
    columns: getColumnCount,
    wrapHorizontal: false,
    wrapVertical: false,
    onNavigateUp,
    onNavigateDown,
    enableWASD: true,
    enabled: !isSearchOpen && !selectedGame,
    sectionBreakIndex: sectionBreakIndex > 0 ? sectionBreakIndex : undefined,
  });

  const handleGameSelect = (game: Game) => {
    setSelectedGame(game);
  };

  const handlePlayGame = async () => {
    if (!selectedGame) return;
    if (selectedGame.installed && onLaunchGame) {
      await onLaunchGame(selectedGame);
    }
  };

  const handleInstallGame = async () => {
    if (!selectedGame) return;
    if (onInstallGame) {
      await onInstallGame(selectedGame);
    }
  };

  const handleCloseInfo = () => {
    setSelectedGame(null);
  };

  const handleCardKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    // Handle search shortcut
    if (e.key === '/' || (e.key === 'f' && !e.ctrlKey && !e.metaKey)) {
      e.preventDefault();
      onSearchOpen?.();
      return;
    }
    // Use grid navigation for arrow keys
    gridHandleKeyDown(e, index);
  }, [gridHandleKeyDown, onSearchOpen]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-secondary text-center">
        <div className="w-10 h-10 border-3 border-surface border-t-accent rounded-full animate-spin mb-md" />
        <p>Loading games...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-text-secondary text-center">
        <p>Failed to load games</p>
        <p className="text-[0.85rem] text-text-muted my-sm">{error}</p>
        {onRefresh && (
          <button
            className="mt-md px-lg py-sm bg-accent border-none rounded text-white font-semibold cursor-pointer transition-colors duration-fast hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
            onClick={onRefresh}
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      {isSearchOpen && (
        <SearchPanel
          games={games}
          onGameSelect={handleGameSelect}
          onClose={onSearchClose}
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

      {games.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-2xl text-text-secondary text-center">
          <p className="m-0">{emptyMessage}</p>
          <p className="text-[0.85rem] text-text-muted mt-sm">{emptySubMessage}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div ref={gridRef} className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-0 p-sm px-md pb-md">
            {games.map((game, index) => (
              <GameCard
                key={`${game.store}:${game.id}`}
                ref={setItemRef(index)}
                game={game}
                onClick={() => handleGameSelect(game)}
                onFocus={() => focusIndex(index)}
                onKeyDown={(e) => handleCardKeyDown(e, index)}
                tabIndex={0}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}
