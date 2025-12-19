import { useRef, useEffect, useCallback, useState } from 'react';
import { StoreCard } from '../components/StoreCard';
import { SteamIcon, EpicIcon, GOGIcon } from '../components/icons/StoreIcons';
import { useGridNavigation } from '../hooks/useGridNavigation';

interface Store {
  id: string;
  name: string;
  icon: React.ReactNode;
  accentColor: string;
  backgroundColor: string;
}

const stores: Store[] = [
  {
    id: 'steam',
    name: 'Steam',
    icon: <SteamIcon />,
    accentColor: '#66c0f4',
    backgroundColor: '#1b2838',
  },
  {
    id: 'epic',
    name: 'Epic Games',
    icon: <EpicIcon />,
    accentColor: '#ffffff',
    backgroundColor: '#2a2a2a',
  },
  {
    id: 'gog',
    name: 'GOG Galaxy',
    icon: <GOGIcon />,
    accentColor: '#ab47bc',
    backgroundColor: '#4a2a6a',
  },
];

export interface StoresScreenProps {
  onStoreSelect?: (storeId: string) => void;
  onNavigateDown?: () => void;
}

export function StoresScreen({ onStoreSelect, onNavigateDown }: StoresScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasInitialFocus, setHasInitialFocus] = useState(false);

  const { itemRefs, focusIndex, handleKeyDown: gridHandleKeyDown, setItemRef } = useGridNavigation({
    itemCount: stores.length,
    columns: 3,
    wrapHorizontal: true,
    wrapVertical: false,
    onNavigateDown,
    enableWASD: true,
    enabled: true,
  });

  const handleStoreClick = (storeId: string) => {
    onStoreSelect?.(storeId);
  };

  // Initial focus
  useEffect(() => {
    if (!hasInitialFocus) {
      const timer = setTimeout(() => {
        focusIndex(0);
        setHasInitialFocus(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [focusIndex, hasInitialFocus]);

  // Handle focus-stores event from App
  useEffect(() => {
    const handleFocusStores = () => {
      // Re-focus the last focused card
      const currentlyFocused = itemRefs.current.findIndex(ref => ref === document.activeElement);
      if (currentlyFocused === -1) {
        focusIndex(0);
      }
    };
    window.addEventListener('focus-stores', handleFocusStores);
    return () => window.removeEventListener('focus-stores', handleFocusStores);
  }, [focusIndex, itemRefs]);

  // Card keyboard handler
  const handleCardKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    gridHandleKeyDown(e, index);
  }, [gridHandleKeyDown]);

  return (
    <div ref={containerRef} className="h-full p-2xl flex flex-col overflow-y-auto max-md:p-lg">
      <header className="mb-2xl">
        <h1 className="text-[2rem] font-bold text-text-primary mb-sm">Stores</h1>
        <p className="text-base text-text-secondary">Select a store to view your games</p>
      </header>

      <div className="flex flex-wrap gap-xl justify-start max-md:justify-center">
        {stores.map((store, index) => (
          <StoreCard
            key={store.id}
            ref={setItemRef(index)}
            id={store.id}
            name={store.name}
            icon={store.icon}
            accentColor={store.accentColor}
            backgroundColor={store.backgroundColor}
            onClick={() => handleStoreClick(store.id)}
            onFocus={() => focusIndex(index)}
            onKeyDown={(e) => handleCardKeyDown(e, index)}
            tabIndex={0}
          />
        ))}
      </div>
    </div>
  );
}
