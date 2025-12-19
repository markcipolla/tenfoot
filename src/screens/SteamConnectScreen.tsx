import { useState, useEffect, useRef, useCallback } from 'react';
import { GameCard } from '../components/GameCard';
import { GameInfoPanel } from '../components/GameInfoPanel';
import { PageHeader } from '../components/PageHeader';
import { SearchPanel } from '../components/SearchPanel';
import { SteamIcon } from '../components/icons/StoreIcons';
import { useGridNavigation } from '../hooks/useGridNavigation';
import {
  saveSteamCredentials,
  getSteamCredentials,
  syncSteamLibrary,
  getSteamGamesCached,
  installSteamGame,
  launchGame,
  detectSteamId,
  useGamesByStore,
} from '../hooks';
import type { Game } from '../types';

export interface SteamConnectScreenProps {
  onBack?: () => void;
  onNavigateDown?: () => void;
}

type ConnectionStep = 'scanning' | 'results' | 'api-setup';

export function SteamConnectScreen({ onBack, onNavigateDown }: SteamConnectScreenProps) {
  const [step, setStep] = useState<ConnectionStep>('scanning');
  const [apiKey, setApiKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasApiCredentials, setHasApiCredentials] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);

  const { games: installedGames, refresh: refreshInstalled } = useGamesByStore('steam');
  const apiKeyInputRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const getColumnCount = useCallback(() => {
    if (!gridRef.current) return 5;
    const gridWidth = gridRef.current.offsetWidth;
    const minColWidth = 140;
    return Math.max(1, Math.floor(gridWidth / minColWidth));
  }, []);

  const handleNavigateUp = useCallback(() => {
    searchButtonRef.current?.focus();
  }, []);

  // Find where installed games end and uninstalled begin (for section-aware navigation)
  const sectionBreakIndex = games.findIndex(g => !g.installed);

  const { focusIndex, handleKeyDown: gridHandleKeyDown, setItemRef } = useGridNavigation({
    itemCount: games.length,
    columns: getColumnCount,
    wrapHorizontal: false,
    wrapVertical: false,
    onNavigateUp: handleNavigateUp,
    onNavigateDown,
    enableWASD: true,
    enabled: step === 'results' && !isSearchOpen && !selectedGame,
    sectionBreakIndex: sectionBreakIndex > 0 ? sectionBreakIndex : undefined,
  });

  // Initialize: check for existing credentials or use local scan
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        // Check for existing API credentials
        const creds = await getSteamCredentials();
        if (creds?.api_key && creds?.steam_id) {
          setApiKey(creds.api_key);
          setSteamId(creds.steam_id);
          setHasApiCredentials(true);

          // Load cached games from API sync
          const cached = await getSteamGamesCached();
          if (cached.length > 0) {
            setGames(cached);
            setStep('results');
            setLoading(false);
            return;
          }
          // If cache is empty but credentials exist, try syncing
          try {
            const synced = await syncSteamLibrary();
            if (synced.length > 0) {
              setGames(synced);
              setStep('results');
              setLoading(false);
              return;
            }
          } catch {
            // If sync fails, fall through to installed games
          }
        }

        // Auto-detect Steam ID for later use
        const detectedId = await detectSteamId();
        if (detectedId) {
          setSteamId(detectedId);
        }

        // Use locally installed games
        await refreshInstalled();
      } catch (err) {
        console.error('Init error:', err);
      } finally {
        setLoading(false);
        setStep('results');
      }
    };
    initialize();
  }, []);

  // Update games when installed games change (also fallback when cache is empty)
  useEffect(() => {
    if (installedGames.length > 0 && (!hasApiCredentials || games.length === 0)) {
      setGames(installedGames);
    }
  }, [installedGames, hasApiCredentials, games.length]);

  useEffect(() => {
    if (step === 'api-setup') {
      apiKeyInputRef.current?.focus();
    }
  }, [step]);

  const handleSyncWithApi = async () => {
    if (!apiKey.trim()) {
      setError('Please enter your Steam API Key');
      return;
    }

    // Use detected Steam ID or require user input
    const finalSteamId = steamId.trim();
    if (!finalSteamId) {
      setError('Could not detect Steam ID. Please enter it manually.');
      return;
    }

    setError(null);
    setSyncing(true);

    try {
      await saveSteamCredentials(apiKey.trim(), finalSteamId);
      const syncedGames = await syncSteamLibrary();
      setGames(syncedGames);
      setHasApiCredentials(true);
      setStep('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  const handleRefresh = async () => {
    setSyncing(true);
    setError(null);
    try {
      if (hasApiCredentials) {
        const syncedGames = await syncSteamLibrary();
        setGames(syncedGames);
      } else {
        await refreshInstalled();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  const handleGameSelect = (game: Game) => {
    setSelectedGame(game);
  };

  const handlePlayGame = async () => {
    if (!selectedGame) return;
    if (selectedGame.installed) {
      try {
        const timestamp = await launchGame(`steam:${selectedGame.id}`);
        // Update local games state with new last_played
        setGames(prevGames =>
          prevGames.map(game =>
            game.id === selectedGame.id
              ? { ...game, last_played: timestamp }
              : game
          )
        );
        // Update selected game as well
        setSelectedGame(prev => prev ? { ...prev, last_played: timestamp } : null);
      } catch (err) {
        console.error('Failed to launch game:', err);
      }
    }
  };

  const handleInstallGame = async () => {
    if (!selectedGame) return;
    try {
      await installSteamGame(selectedGame.id);
    } catch (err) {
      console.error('Failed to install game:', err);
    }
  };

  const handleCloseInfo = () => {
    setSelectedGame(null);
  };

  // Listen for focus event from global keyboard handler
  useEffect(() => {
    const handleFocusSteamConnect = () => {
      if (step === 'results' && games.length > 0) {
        focusIndex(0);
      } else if (step === 'api-setup') {
        apiKeyInputRef.current?.focus();
      }
    };
    window.addEventListener('focus-steam-connect', handleFocusSteamConnect);
    return () => window.removeEventListener('focus-steam-connect', handleFocusSteamConnect);
  }, [step, games.length, focusIndex]);

  // Initial focus when games load
  useEffect(() => {
    if (step === 'results' && games.length > 0 && !loading) {
      setTimeout(() => focusIndex(0), 100);
    }
  }, [step, games.length, focusIndex, loading]);

  // Card keyboard handler - wraps grid navigation + select/close
  const handleCardKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    // Handle search shortcut
    if (e.key === '/' || (e.key === 'f' && !e.ctrlKey && !e.metaKey)) {
      e.preventDefault();
      setIsSearchOpen(true);
      return;
    }
    // Handle escape to go back
    if (e.key === 'Escape') {
      e.preventDefault();
      onBack?.();
      return;
    }
    // Use grid navigation for arrow keys
    gridHandleKeyDown(e, index);
  }, [gridHandleKeyDown, onBack]);

  const installedCount = games.filter(g => g.installed).length;

  if (step === 'api-setup') {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-xl text-center overflow-y-auto">
        <div className="flex flex-col items-center gap-lg max-w-[400px]">
          <div className="w-20 h-20 flex items-center justify-center bg-steam rounded-xl text-steam-accent [&_svg]:w-12 [&_svg]:h-12">
            <SteamIcon />
          </div>
          <h1 className="text-[1.75rem] font-bold text-text-primary m-0">Sync Full Library</h1>
          <p className="text-base text-text-secondary m-0 leading-relaxed">
            Add your Steam API Key to see all your purchased games, not just installed ones.
          </p>
        </div>

        <div className="flex flex-col gap-lg w-full max-w-[400px] mt-xl">
          <div className="flex flex-col gap-xs text-left">
            <label htmlFor="apiKey" className="text-[0.9rem] font-semibold text-text-secondary">Steam API Key</label>
            <input
              ref={apiKeyInputRef}
              id="apiKey"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Enter your Steam API key"
              className="px-md py-sm bg-surface border border-surface-hover rounded text-base text-text-primary font-sans transition-colors duration-fast focus:outline-none focus:border-accent placeholder:text-text-muted"
            />
            <span className="text-xs text-text-muted">
              Get one at{' '}
              <a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noopener noreferrer" className="text-accent no-underline hover:underline">
                steamcommunity.com/dev/apikey
              </a>
            </span>
          </div>

          {steamId && (
            <div className="flex flex-col gap-xs text-left opacity-80">
              <label className="text-[0.9rem] font-semibold text-text-secondary">Steam ID</label>
              <div className="px-md py-sm bg-tertiary rounded font-mono text-[0.9rem] text-text-primary">{steamId}</div>
              <span className="text-xs text-text-muted">Auto-detected from Steam</span>
            </div>
          )}

          {!steamId && (
            <div className="flex flex-col gap-xs text-left">
              <label htmlFor="steamId" className="text-[0.9rem] font-semibold text-text-secondary">Steam ID (64-bit)</label>
              <input
                id="steamId"
                type="text"
                value={steamId}
                onChange={e => setSteamId(e.target.value)}
                placeholder="e.g., 76561198012345678"
                className="px-md py-sm bg-surface border border-surface-hover rounded text-base text-text-primary font-sans transition-colors duration-fast focus:outline-none focus:border-accent placeholder:text-text-muted"
              />
              <span className="text-xs text-text-muted">
                Find yours at{' '}
                <a href="https://steamid.io" target="_blank" rel="noopener noreferrer" className="text-accent no-underline hover:underline">
                  steamid.io
                </a>
              </span>
            </div>
          )}

          {error && (
            <div className="px-md py-sm bg-[rgba(255,100,100,0.1)] border border-[rgba(255,100,100,0.3)] rounded text-[#ff6b6b] text-[0.85rem] mb-md">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-sm mt-xl w-full max-w-[300px] mx-auto">
            <button
              className="px-lg py-md border-none rounded text-base font-semibold cursor-pointer transition-all duration-fast bg-steam-accent text-steam hover:bg-[#7dd3f8] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              onClick={handleSyncWithApi}
              disabled={syncing}
            >
              {syncing ? 'Syncing...' : 'Sync Library'}
            </button>
            <button
              className="px-lg py-md border-none rounded text-base font-semibold cursor-pointer transition-all duration-fast bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              onClick={() => setStep('results')}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading || (syncing && games.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-xl text-center overflow-y-auto">
        <div className="flex flex-col items-center gap-lg max-w-[400px]">
          <div className="w-20 h-20 flex items-center justify-center bg-steam rounded-xl text-steam-accent animate-pulse [&_svg]:w-12 [&_svg]:h-12">
            <SteamIcon />
          </div>
          <h1 className="text-[1.75rem] font-bold text-text-primary m-0">Scanning Steam</h1>
          <p className="text-base text-text-secondary m-0 leading-relaxed">
            Looking for installed games...
          </p>
          <div className="w-8 h-8 border-3 border-surface border-t-steam-accent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col items-stretch justify-start text-left h-full overflow-y-auto">
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
        title="Steam"
        subtitle={
          hasApiCredentials
            ? `${installedCount} of ${games.length} games installed`
            : `${games.length} games installed`
        }
        actions={
          <>
            <button
              ref={searchButtonRef}
              className="flex items-center gap-sm px-md py-sm bg-surface border-none rounded text-text-secondary cursor-pointer transition-colors duration-fast hover:bg-surface-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              onClick={() => setIsSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                  e.preventDefault();
                  focusIndex(0);
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
            {!hasApiCredentials && (
              <button
                className="bg-transparent text-accent px-md py-sm border-none rounded text-base font-semibold cursor-pointer transition-all duration-fast hover:bg-surface hover:text-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
                onClick={() => setStep('api-setup')}
              >
                Sync Full Library
              </button>
            )}
            <button
              className="px-md py-sm border-none rounded text-base font-semibold cursor-pointer transition-all duration-fast bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              onClick={handleRefresh}
              disabled={syncing}
            >
              {syncing ? 'Syncing...' : 'Refresh'}
            </button>
          </>
        }
      />

      {error && (
        <div className="px-md py-sm bg-[rgba(255,100,100,0.1)] border border-[rgba(255,100,100,0.3)] rounded text-[#ff6b6b] text-[0.85rem] mb-md">
          {error}
        </div>
      )}

      {games.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-2xl text-text-secondary text-center">
          <p className="m-0">No Steam games found.</p>
          <p className="text-[0.85rem] text-text-muted mt-sm">
            Make sure Steam is installed and you have games downloaded.
          </p>
          {!hasApiCredentials && (
            <button
              className="mt-md px-lg py-md border-none rounded text-base font-semibold cursor-pointer transition-all duration-fast bg-steam-accent text-steam hover:bg-[#7dd3f8] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              onClick={() => setStep('api-setup')}
            >
              Sync Full Library with API
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div ref={gridRef} className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-0 p-sm px-md pb-md">
            {games.map((game, index) => (
              <GameCard
                key={game.id}
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
