import { useState, useRef, useEffect, useCallback } from 'react';
import { GameCard } from './GameCard';
import { fuzzySearch } from '../utils/fuzzyMatch';
import { useGridNavigation } from '../hooks/useGridNavigation';
import type { Game } from '../types';

export interface SearchPanelProps {
  games: Game[];
  onGameSelect?: (game: Game) => void;
  onClose?: () => void;
}

export function SearchPanel({ games, onGameSelect, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const searchResults = fuzzySearch(games, query, game => game.name);

  const getColumnCount = useCallback(() => {
    if (!gridRef.current) return 5;
    const gridWidth = gridRef.current.offsetWidth;
    const minColWidth = 140;
    return Math.max(1, Math.floor(gridWidth / minColWidth));
  }, []);

  const handleNavigateUp = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  const { itemRefs, focusIndex, handleKeyDown: gridHandleKeyDown, setItemRef } = useGridNavigation({
    itemCount: searchResults.length,
    columns: getColumnCount,
    wrapHorizontal: false,
    wrapVertical: false,
    onNavigateUp: handleNavigateUp,
    enableWASD: true,
    enabled: true,
  });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Reset selection when query changes
  useEffect(() => {
    focusIndex(0);
  }, [query, focusIndex]);

  // Scroll card into view when focused
  const scrollCardIntoView = useCallback((card: HTMLButtonElement | null) => {
    if (!card || !resultsRef.current) return;

    const wrapper = card.parentElement;
    if (!wrapper) return;

    const container = resultsRef.current;
    const wrapperRect = wrapper.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const padding = 16;

    if (wrapperRect.top < containerRect.top + padding) {
      container.scrollTop -= (containerRect.top - wrapperRect.top + padding);
    } else if (wrapperRect.bottom > containerRect.bottom - padding) {
      container.scrollTop += (wrapperRect.bottom - containerRect.bottom + padding);
    }
  }, []);

  // Input field keyboard handler - only arrow keys, not WASD (so user can type)
  const handleInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (searchResults.length > 0) {
          focusIndex(0);
          scrollCardIntoView(itemRefs.current[0]);
        }
        break;
      case 'Enter':
        // Only select if there's a query AND results
        if (query.trim() && searchResults.length > 0) {
          e.preventDefault();
          onGameSelect?.(searchResults[0].item);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose?.();
        break;
    }
  }, [query, searchResults, onGameSelect, onClose, focusIndex, itemRefs, scrollCardIntoView]);

  // Card keyboard handler - wraps grid navigation + select/close
  const handleCardKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    // Handle select and close keys
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onGameSelect?.(searchResults[index].item);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose?.();
      return;
    }

    // Use grid navigation for arrow keys (hook handles scrolling)
    gridHandleKeyDown(e, index);
  }, [searchResults, onGameSelect, onClose, gridHandleKeyDown]);

  return (
    <div className="fixed inset-0 bottom-bottom-bar bg-primary z-overlay flex flex-col animate-search-panel-fade-in">
      <div className="flex items-center gap-md p-lg border-b border-surface">
        <div className="flex-1 flex items-center gap-sm bg-surface rounded px-md py-sm">
          <SearchIcon />
          <input
            ref={inputRef}
            type="text"
            className="flex-1 bg-transparent border-none outline-none text-xl text-text-primary font-sans placeholder:text-text-muted"
            placeholder="Search games..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
          />
        </div>
        <button
          className="flex items-center justify-center bg-transparent border-none p-sm cursor-pointer text-text-secondary rounded transition-all duration-fast hover:text-text-primary hover:bg-surface"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden" ref={resultsRef}>
        {query && searchResults.length === 0 ? (
          <div className="text-center text-text-muted p-2xl text-lg">
            No games found for "{query}"
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-0 p-md" ref={gridRef}>
            {searchResults.map((result, index) => (
              <GameCard
                key={`${result.item.store}:${result.item.id}`}
                ref={setItemRef(index)}
                game={result.item}
                onClick={() => onGameSelect?.(result.item)}
                onFocus={() => focusIndex(index)}
                onKeyDown={(e) => handleCardKeyDown(e, index)}
                tabIndex={0}
              />
            ))}
          </div>
        )}
      </div>

      {query && searchResults.length > 0 && (
        <div className="flex justify-between items-center px-lg py-sm border-t border-surface bg-secondary">
          <span className="text-text-secondary text-[0.85rem]">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
          </span>
          <span className="text-text-muted text-xs flex items-center gap-xs">
            <kbd className="bg-surface px-1.5 py-0.5 rounded text-[0.7rem] font-sans">WASD</kbd> or
            <kbd className="bg-surface px-1.5 py-0.5 rounded text-[0.7rem] font-sans">Arrow</kbd> navigate ·
            <kbd className="bg-surface px-1.5 py-0.5 rounded text-[0.7rem] font-sans">Enter</kbd> select ·
            <kbd className="bg-surface px-1.5 py-0.5 rounded text-[0.7rem] font-sans">Esc</kbd> close
          </span>
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg className="text-text-muted shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
