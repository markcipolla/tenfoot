export type StoreType = 'steam' | 'epic' | 'gog';

export interface Game {
  id: string;
  name: string;
  store: StoreType;
  installed: boolean;
  install_path?: string;
  executable?: string;
  playtime_minutes?: number;
  last_played?: number;
  cover_url?: string;
  hero_url?: string;
  icon_url?: string;
  size_bytes?: number;
  version?: string;
  installed_at?: number;
}

export interface StoreConnection {
  storeId: StoreType;
  connected: boolean;
  gamesCount: number;
}
