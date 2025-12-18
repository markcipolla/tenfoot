import { useState, useEffect, useCallback } from 'react';
import type { StoreType, StoreConnection } from '../types';
import { useGames } from './useGames';

const STORAGE_KEY = 'connected_stores';

export function useStoreConnections() {
  const [connectedStores, setConnectedStores] = useState<Set<StoreType>>(new Set());
  const { games } = useGames();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StoreType[];
        setConnectedStores(new Set(parsed));
      } catch {
        // Invalid data, start fresh
      }
    }
  }, []);

  const saveConnections = useCallback((stores: Set<StoreType>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...stores]));
  }, []);

  const connectStore = useCallback((storeId: StoreType) => {
    setConnectedStores(prev => {
      const next = new Set(prev);
      next.add(storeId);
      saveConnections(next);
      return next;
    });
  }, [saveConnections]);

  const disconnectStore = useCallback((storeId: StoreType) => {
    setConnectedStores(prev => {
      const next = new Set(prev);
      next.delete(storeId);
      saveConnections(next);
      return next;
    });
  }, [saveConnections]);

  const isConnected = useCallback((storeId: StoreType) => {
    return connectedStores.has(storeId);
  }, [connectedStores]);

  const hasAnyConnection = connectedStores.size > 0;

  const getStoreConnection = useCallback((storeId: StoreType): StoreConnection => {
    const storeGames = games.filter(g => g.store === storeId);
    return {
      storeId,
      connected: connectedStores.has(storeId),
      gamesCount: storeGames.length,
    };
  }, [connectedStores, games]);

  return {
    connectedStores,
    connectStore,
    disconnectStore,
    isConnected,
    hasAnyConnection,
    getStoreConnection,
  };
}
