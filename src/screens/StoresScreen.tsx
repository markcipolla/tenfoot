import { useRef, useEffect, useCallback, useState } from 'react';
import { StoreCard } from '../components/StoreCard';
import { SteamIcon, EpicIcon, GOGIcon } from '../components/icons/StoreIcons';

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
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [hasInitialFocus, setHasInitialFocus] = useState(false);

  const handleStoreClick = (storeId: string) => {
    onStoreSelect?.(storeId);
  };

  const focusCard = useCallback((index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, stores.length - 1));
    setFocusedIndex(clampedIndex);
    cardRefs.current[clampedIndex]?.focus();
  }, []);

  const focusFirstCard = useCallback(() => {
    focusCard(focusedIndex);
  }, [focusCard, focusedIndex]);

  useEffect(() => {
    if (!hasInitialFocus) {
      const timer = setTimeout(() => {
        focusCard(0);
        setHasInitialFocus(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [focusCard, hasInitialFocus]);

  useEffect(() => {
    const handleFocusStores = () => focusFirstCard();
    window.addEventListener('focus-stores', handleFocusStores);
    return () => window.removeEventListener('focus-stores', handleFocusStores);
  }, [focusFirstCard]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Only handle keyboard navigation if focus is within this screen
    if (!containerRef.current?.contains(document.activeElement)) return;

    const activeElement = document.activeElement;
    let currentIndex = cardRefs.current.findIndex(ref => ref === activeElement);

    if (currentIndex === -1) {
      currentIndex = focusedIndex;
    }

    let nextIndex = currentIndex;

    switch (e.key) {
      case 'ArrowRight':
      case 'd':
      case 'D':
        nextIndex = (currentIndex + 1) % stores.length;
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        nextIndex = currentIndex - 1 < 0 ? stores.length - 1 : currentIndex - 1;
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        if (currentIndex + 3 >= stores.length) {
          e.preventDefault();
          onNavigateDown?.();
          return;
        }
        nextIndex = Math.min(currentIndex + 3, stores.length - 1);
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        nextIndex = Math.max(currentIndex - 3, 0);
        break;
      default:
        return;
    }

    if (stores.length > 0) {
      e.preventDefault();
      focusCard(nextIndex);
    }
  }, [focusCard, focusedIndex, onNavigateDown]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const setCardRef = (index: number) => (el: HTMLButtonElement | null) => {
    cardRefs.current[index] = el;
  };

  return (
    <div ref={containerRef} className="h-full p-2xl flex flex-col overflow-y-auto max-md:p-lg">
      <header className="mb-2xl">
        <h1 className="text-[2rem] font-bold text-text-primary mb-sm">Stores</h1>
        <p className="text-base text-text-secondary">Select a store to view your games</p>
      </header>

      <div className="flex flex-wrap gap-xl justify-start max-md:justify-center" ref={gridRef}>
        {stores.map((store, index) => (
          <StoreCard
            key={store.id}
            ref={setCardRef(index)}
            id={store.id}
            name={store.name}
            icon={store.icon}
            accentColor={store.accentColor}
            backgroundColor={store.backgroundColor}
            onClick={() => handleStoreClick(store.id)}
            onFocus={() => setFocusedIndex(index)}
            tabIndex={0}
          />
        ))}
      </div>
    </div>
  );
}
