export {
  useGames,
  useGamesByStore,
  useGamesSortedByLastPlayed,
  launchGame,
  saveSteamCredentials,
  getSteamCredentials,
  isSteamConnected,
  syncSteamLibrary,
  getSteamGamesCached,
  getLastSyncTime,
  installSteamGame,
  disconnectSteam,
  detectSteamId,
  isSteamInstalled,
  getPlayHistory,
  hasSyncedLibrary,
} from './useGames';
export type { PlayHistory } from './useGames';
export { useStoreConnections } from './useStoreConnections';
