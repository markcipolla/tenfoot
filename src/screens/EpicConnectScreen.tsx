import { useState, useEffect, useRef, useCallback } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { GamesGrid, PageHeader, LoadingScreen, ErrorMessage } from '../components';
import { EpicIcon } from '../components/icons/StoreIcons';
import { SearchIcon } from '../components/icons/SearchIcon';
import {
  useGamesByStore,
  launchGame,
  getEpicLoginUrl,
  exchangeEpicCode,
  isEpicConnected,
  syncEpicLibrary,
  getEpicGamesCached,
} from '../hooks';
import type { Game } from '../types';

export interface EpicConnectScreenProps {
  onBack?: () => void;
  onNavigateDown?: () => void;
}

type ConnectionStep = 'scanning' | 'results' | 'oauth-setup';

export function EpicConnectScreen({ onBack, onNavigateDown }: EpicConnectScreenProps) {
  const [step, setStep] = useState<ConnectionStep>('scanning');
  const [authCode, setAuthCode] = useState('');
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasOAuthCredentials, setHasOAuthCredentials] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [loginUrl, setLoginUrl] = useState<string>('');

  const { games: installedGames, refresh: refreshInstalled, updateGameLastPlayed } = useGamesByStore('epic');
  const authCodeInputRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  // Initialize: check for existing credentials or use local scan
  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        // Check for existing OAuth credentials
        const connected = await isEpicConnected();
        if (connected) {
          setHasOAuthCredentials(true);
          // Load cached games from OAuth sync
          const cached = await getEpicGamesCached();
          if (cached.length > 0) {
            setGames(cached);
            setStep('results');
            setLoading(false);
            return;
          }
        }

        // Check for locally installed games
        await refreshInstalled();

        // If not connected and no installed games found, go directly to OAuth setup
        // (we check installedGames in the next useEffect, but set a flag here)
      } catch (err) {
        console.error('Init error:', err);
      } finally {
        setLoading(false);
        setStep('results');
      }
    };
    initialize();
  }, []);

  // Update games when installed games change
  useEffect(() => {
    if (!hasOAuthCredentials && installedGames.length > 0) {
      setGames(installedGames);
    }
  }, [installedGames, hasOAuthCredentials]);

  // Focus auth code input when in oauth-setup step
  useEffect(() => {
    if (step === 'oauth-setup') {
      authCodeInputRef.current?.focus();
      // Get the login URL
      getEpicLoginUrl().then(setLoginUrl).catch(console.error);
    }
  }, [step]);

  const handleOpenLogin = async () => {
    if (loginUrl) {
      try {
        await openUrl(loginUrl);
      } catch (err) {
        console.error('Failed to open login URL:', err);
        // Fallback for browser dev environment
        window.open(loginUrl, '_blank');
      }
    }
  };

  const handleSyncWithOAuth = async () => {
    if (!authCode.trim()) {
      setError('Please enter the authorization code');
      return;
    }

    setError(null);
    setSyncing(true);

    try {
      // Exchange code for tokens
      await exchangeEpicCode(authCode.trim());
      // Sync library
      const syncedGames = await syncEpicLibrary();
      setGames(syncedGames);
      setHasOAuthCredentials(true);
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
      if (hasOAuthCredentials) {
        const syncedGames = await syncEpicLibrary();
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

  const handleLaunchGame = async (game: Game) => {
    try {
      const timestamp = await launchGame(`epic:${game.id}`);
      // Update local games state
      setGames(prevGames =>
        prevGames.map(g =>
          g.id === game.id ? { ...g, last_played: timestamp } : g
        )
      );
      updateGameLastPlayed(`epic:${game.id}`, timestamp);
    } catch (err) {
      console.error('Failed to launch game:', err);
    }
  };

  const handleNavigateUp = useCallback(() => {
    searchButtonRef.current?.focus();
  }, []);

  // Listen for focus event from global keyboard handler
  useEffect(() => {
    const handleFocusEpicConnect = () => {
      if (step === 'results' && games.length > 0) {
        searchButtonRef.current?.focus();
      } else if (step === 'oauth-setup') {
        authCodeInputRef.current?.focus();
      }
    };
    window.addEventListener('focus-epic-connect', handleFocusEpicConnect);
    return () => window.removeEventListener('focus-epic-connect', handleFocusEpicConnect);
  }, [step, games.length]);

  // Handle escape to go back
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSearchOpen) {
        if (step === 'oauth-setup') {
          setStep('results');
        } else {
          onBack?.();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, onBack, step]);

  if (step === 'oauth-setup') {
    return (
      <div className="flex flex-col items-center justify-center min-h-full p-xl text-center overflow-y-auto">
        <div className="flex flex-col items-center gap-lg max-w-[500px]">
          <div className="w-20 h-20 flex items-center justify-center bg-[#2a2a2a] rounded-xl text-white [&_svg]:w-12 [&_svg]:h-12">
            <EpicIcon />
          </div>
          <h1 className="text-[1.75rem] font-bold text-text-primary m-0">Sync Epic Library</h1>
          <p className="text-base text-text-secondary m-0 leading-relaxed">
            Sign in to Epic Games to see all your purchased games, not just installed ones.
          </p>
        </div>

        <div className="flex flex-col gap-lg w-full max-w-[500px] mt-xl">
          <div className="flex flex-col gap-md">
            <p className="text-[0.9rem] text-text-secondary m-0">
              <strong>Step 1:</strong> Click the button below to sign in to Epic Games
            </p>
            <button
              className="px-lg py-md border-none rounded text-base font-semibold cursor-pointer transition-all duration-fast bg-[#2a2a2a] text-white hover:bg-[#3a3a3a] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              onClick={handleOpenLogin}
            >
              Sign in with Epic Games
            </button>
          </div>

          <div className="flex flex-col gap-xs text-left">
            <label htmlFor="authCode" className="text-[0.9rem] font-semibold text-text-secondary">
              <strong>Step 2:</strong> Paste the authorization code from the redirect page
            </label>
            <input
              ref={authCodeInputRef}
              id="authCode"
              type="text"
              value={authCode}
              onChange={e => setAuthCode(e.target.value)}
              placeholder='Look for "authorizationCode" in the JSON response'
              className="px-md py-sm bg-surface border border-surface-hover rounded text-base text-text-primary font-sans transition-colors duration-fast focus:outline-none focus:border-accent placeholder:text-text-muted"
            />
            <span className="text-xs text-text-muted">
              After signing in, you'll see a JSON response. Copy the value after "authorizationCode":
            </span>
          </div>

          {error && <ErrorMessage message={error} />}

          <div className="flex flex-col gap-sm mt-lg w-full max-w-[300px] mx-auto">
            <button
              className="px-lg py-md border-none rounded text-base font-semibold cursor-pointer transition-all duration-fast bg-accent text-white hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              onClick={handleSyncWithOAuth}
              disabled={syncing || !authCode.trim()}
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
      <LoadingScreen
        icon={<EpicIcon />}
        iconBgClass="bg-[#2a2a2a]"
        iconTextClass="text-white"
        spinnerClass="border-t-white"
        title="Scanning Epic Games"
      />
    );
  }

  const installedCount = games.filter(g => g.installed).length;

  return (
    <div className="flex flex-col items-stretch justify-start text-left h-full overflow-y-auto">
      <PageHeader
        title="Epic Games"
        subtitle={
          hasOAuthCredentials
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
            {!hasOAuthCredentials && (
              <button
                className="bg-transparent text-accent px-md py-sm border-none rounded text-base font-semibold cursor-pointer transition-all duration-fast hover:bg-surface hover:text-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
                onClick={() => setStep('oauth-setup')}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
                    e.preventDefault();
                    const firstCard = document.querySelector('[data-game-id]') as HTMLButtonElement;
                    firstCard?.focus();
                  } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
                    e.preventDefault();
                    const prev = (e.currentTarget as HTMLElement).previousElementSibling as HTMLButtonElement;
                    prev?.focus();
                  } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
                    e.preventDefault();
                    const next = (e.currentTarget as HTMLElement).nextElementSibling as HTMLButtonElement;
                    next?.focus();
                  }
                }}
              >
                Sync Full Library
              </button>
            )}
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
              {syncing ? 'Syncing...' : 'Refresh'}
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
        emptyMessage={hasOAuthCredentials ? "No Epic Games found." : "Connect to see your games"}
        emptySubMessage={
          hasOAuthCredentials
            ? 'Your library is empty or sync failed.'
            : 'Click "Sync Full Library" above to sign in and see all your purchased games.'
        }
      />
    </div>
  );
}

