export {
  useGames,
  useGamesByStore,
  useGamesSortedByLastPlayed,
  launchGame,
  // Steam
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
  // Epic
  getEpicLoginUrl,
  exchangeEpicCode,
  getEpicCredentials,
  isEpicConnected,
  syncEpicLibrary,
  getEpicGamesCached,
  getEpicLastSyncTime,
  disconnectEpic,
  // General
  getPlayHistory,
  hasSyncedLibrary,
} from './useGames';
export type { PlayHistory, EpicCredentials } from './useGames';
export { useStoreConnections } from './useStoreConnections';
