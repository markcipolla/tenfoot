import { useState, useEffect, useCallback } from 'react';
import type { Game, StoreType } from '../types';

interface UseGamesResult {
  games: Game[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updateGameLastPlayed: (gameKey: string, timestamp: number) => void;
}

interface SteamCredentials {
  api_key: string;
  steam_id: string;
}

// Check if running in Tauri environment
const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

async function invokeCommand<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    // Return mock data for browser/testing environment
    return [] as T;
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(command, args);
}

// Steam-specific API calls
export async function saveSteamCredentials(apiKey: string, steamId: string): Promise<void> {
  await invokeCommand('save_steam_credentials', { apiKey, steamId });
}

export async function getSteamCredentials(): Promise<SteamCredentials | null> {
  return invokeCommand<SteamCredentials | null>('get_steam_credentials');
}

export async function isSteamConnected(): Promise<boolean> {
  if (!isTauri()) return false;
  return invokeCommand<boolean>('is_steam_connected');
}

export async function syncSteamLibrary(): Promise<Game[]> {
  return invokeCommand<Game[]>('sync_steam_library');
}

export async function getSteamGamesCached(): Promise<Game[]> {
  return invokeCommand<Game[]>('get_steam_games_cached');
}

export async function getLastSyncTime(): Promise<number | null> {
  return invokeCommand<number | null>('get_last_sync_time');
}

export async function installSteamGame(gameId: string): Promise<void> {
  await invokeCommand('install_steam_game', { gameId });
}

export async function disconnectSteam(): Promise<void> {
  await invokeCommand('disconnect_steam');
}

export async function detectSteamId(): Promise<string | null> {
  return invokeCommand<string | null>('detect_steam_id');
}

export async function isSteamInstalled(): Promise<boolean> {
  if (!isTauri()) return false;
  return invokeCommand<boolean>('is_steam_installed');
}

// Epic Games functions
export interface EpicCredentials {
  access_token: string;
  refresh_token: string;
  account_id: string;
  display_name: string;
  expires_at: number;
}

export async function getEpicLoginUrl(): Promise<string> {
  return invokeCommand<string>('get_epic_login_url');
}

export async function exchangeEpicCode(authCode: string): Promise<string> {
  return invokeCommand<string>('exchange_epic_code', { authCode });
}

export async function getEpicCredentials(): Promise<EpicCredentials | null> {
  return invokeCommand<EpicCredentials | null>('get_epic_credentials');
}

export async function isEpicConnected(): Promise<boolean> {
  if (!isTauri()) return false;
  return invokeCommand<boolean>('is_epic_connected');
}

export async function syncEpicLibrary(): Promise<Game[]> {
  return invokeCommand<Game[]>('sync_epic_library');
}

export async function getEpicGamesCached(): Promise<Game[]> {
  return invokeCommand<Game[]>('get_epic_games_cached');
}

export async function getEpicLastSyncTime(): Promise<number | null> {
  return invokeCommand<number | null>('get_epic_last_sync_time');
}

export async function disconnectEpic(): Promise<void> {
  await invokeCommand('disconnect_epic');
}

export interface PlayHistory {
  [gameKey: string]: [number | null, number | null]; // [last_played, installed_at]
}

export async function getPlayHistory(): Promise<PlayHistory> {
  return invokeCommand<PlayHistory>('get_play_history');
}

export async function hasSyncedLibrary(): Promise<boolean> {
  if (!isTauri()) return false;
  return invokeCommand<boolean>('has_synced_library');
}

export function useGames(): UseGamesResult {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get locally installed games
      const installedGames = await invokeCommand<Game[]>('get_installed_games');

      // Get cached games from synced stores
      const steamCached = await getSteamGamesCached();
      const epicCached = await getEpicGamesCached();

      // Create maps of synced games with their data
      const steamDataMap = new Map<string, Game>();
      for (const game of steamCached) {
        steamDataMap.set(`steam:${game.id}`, game);
      }
      const epicDataMap = new Map<string, Game>();
      for (const game of epicCached) {
        epicDataMap.set(`epic:${game.id}`, game);
      }

      // Merge installed games with synced data
      const mergedInstalled = installedGames.map(game => {
        const key = `${game.store}:${game.id}`;
        const steamData = steamDataMap.get(key);
        const epicData = epicDataMap.get(key);
        if (steamData) {
          return {
            ...game,
            playtime_minutes: steamData.playtime_minutes ?? game.playtime_minutes,
            last_played: steamData.last_played ?? game.last_played,
          };
        }
        if (epicData) {
          return {
            ...game,
            cover_url: epicData.cover_url ?? game.cover_url,
            icon_url: epicData.icon_url ?? game.icon_url,
          };
        }
        return game;
      });

      // Add uninstalled games from synced stores
      const installedKeys = new Set(installedGames.map(g => `${g.store}:${g.id}`));
      const uninstalledSteam = steamCached.filter(g => !installedKeys.has(`steam:${g.id}`));
      const uninstalledEpic = epicCached.filter(g => !installedKeys.has(`epic:${g.id}`));

      const allGames = [...mergedInstalled, ...uninstalledSteam, ...uninstalledEpic];

      // Fetch play history and merge
      const history = await getPlayHistory();
      const enrichedGames = allGames.map(game => {
        const key = `${game.store}:${game.id}`;
        const [lastPlayed, installedAt] = history[key] || [null, null];
        return {
          ...game,
          last_played: lastPlayed ?? game.last_played,
          installed_at: installedAt ?? game.installed_at,
        };
      });

      setGames(enrichedGames);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const updateGameLastPlayed = useCallback((gameKey: string, timestamp: number) => {
    setGames(prevGames =>
      prevGames.map(game => {
        const key = `${game.store}:${game.id}`;
        if (key === gameKey) {
          return { ...game, last_played: timestamp };
        }
        return game;
      })
    );
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { games, loading, error, refresh, updateGameLastPlayed };
}

export function useGamesByStore(storeId: StoreType): UseGamesResult {
  const { games: allGames, loading, error, refresh, updateGameLastPlayed } = useGames();
  const games = allGames.filter(game => game.store === storeId);
  return { games, loading, error, refresh, updateGameLastPlayed };
}

export function useGamesSortedByLastPlayed(): UseGamesResult {
  const { games: allGames, loading, error, refresh, updateGameLastPlayed } = useGames();

  const sortedGames = [...allGames].sort((a, b) => {
    // First: installed games come before uninstalled
    if (a.installed !== b.installed) {
      return a.installed ? -1 : 1;
    }

    if (a.installed) {
      // For installed games: sort by last_played (most recent first), then installed_at
      const aPlayed = a.last_played ?? 0;
      const bPlayed = b.last_played ?? 0;
      if (aPlayed !== bPlayed) {
        return bPlayed - aPlayed;
      }
      // If same last_played, sort by installed_at
      const aInstalled = a.installed_at ?? 0;
      const bInstalled = b.installed_at ?? 0;
      return bInstalled - aInstalled;
    } else {
      // For uninstalled games: sort by last_played (most recently played first, as proxy for recently added)
      const aPlayed = a.last_played ?? 0;
      const bPlayed = b.last_played ?? 0;
      if (aPlayed !== bPlayed) {
        return bPlayed - aPlayed;
      }
      // If neither played, sort alphabetically
      return a.name.localeCompare(b.name);
    }
  });

  return { games: sortedGames, loading, error, refresh, updateGameLastPlayed };
}

export async function launchGame(gameKey: string): Promise<number> {
  return invokeCommand<number>('launch_game', { gameKey });
}
