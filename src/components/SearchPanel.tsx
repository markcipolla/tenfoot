import { useState, useRef, useEffect, useCallback } from 'react';
import { GameCard } from './GameCard';
import { fuzzySearch } from '../utils/fuzzyMatch';
import type { Game } from '../types';

export interface SearchPanelProps {
  games: Game[];
  onGameSelect?: (game: Game) => void;
  onClose?: () => void;
}

export function SearchPanel({ games, onGameSelect, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const searchResults = fuzzySearch(games, query, game => game.name);

  const getColumnCount = useCallback(() => {
    if (!gridRef.current) return 5;
    const gridWidth = gridRef.current.offsetWidth;
    const minColWidth = 140;
    return Math.max(1, Math.floor(gridWidth / minColWidth));
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        if (searchResults.length > 0) {
          setSelectedIndex(0);
          cardRefs.current[0]?.focus();
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (searchResults[selectedIndex]) {
          onGameSelect?.(searchResults[selectedIndex].item);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose?.();
        break;
    }
  }, [searchResults, selectedIndex, onGameSelect, onClose]);


  const scrollCardIntoView = useCallback((card: HTMLButtonElement | null) => {
    if (!card || !resultsRef.current) return;

    // Get the wrapper div (parent of button) which includes the title
    const wrapper = card.parentElement;
    if (!wrapper) return;

    const container = resultsRef.current;
    const wrapperRect = wrapper.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Add padding to ensure full visibility
    const padding = 16;

    // Check if wrapper is outside visible area
    if (wrapperRect.top < containerRect.top + padding) {
      // Card is above visible area
      container.scrollTop -= (containerRect.top - wrapperRect.top + padding);
    } else if (wrapperRect.bottom > containerRect.bottom - padding) {
      // Card is below visible area
      container.scrollTop += (wrapperRect.bottom - containerRect.bottom + padding);
    }
  }, []);

  const handleCardKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    const cols = getColumnCount();
    const row = Math.floor(index / cols);
    const col = index % cols;

    switch (e.key) {
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        {
          const nextIndex = index + cols;
          if (nextIndex < searchResults.length) {
            setSelectedIndex(nextIndex);
            const card = cardRefs.current[nextIndex];
            card?.focus();
            scrollCardIntoView(card);
          }
        }
        break;
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        if (row > 0) {
          const nextIndex = index - cols;
          setSelectedIndex(nextIndex);
          const card = cardRefs.current[nextIndex];
          card?.focus();
          scrollCardIntoView(card);
        } else {
          inputRef.current?.focus();
        }
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        if (index < searchResults.length - 1) {
          const nextIndex = index + 1;
          setSelectedIndex(nextIndex);
          const card = cardRefs.current[nextIndex];
          card?.focus();
          scrollCardIntoView(card);
        }
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        if (col > 0) {
          const nextIndex = index - 1;
          setSelectedIndex(nextIndex);
          const card = cardRefs.current[nextIndex];
          card?.focus();
          scrollCardIntoView(card);
        }
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        onGameSelect?.(searchResults[index].item);
        break;
      case 'Escape':
        e.preventDefault();
        onClose?.();
        break;
    }
  }, [searchResults, onGameSelect, onClose, getColumnCount, scrollCardIntoView]);

  const setCardRef = (index: number) => (el: HTMLButtonElement | null) => {
    cardRefs.current[index] = el;
  };

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
            onKeyDown={handleKeyDown}
          />
        </div>
        <button
          className="flex items-center justify-center bg-transparent border-none p-sm cursor-pointer text-text-secondary rounded transition-all duration-fast hover:text-text-primary hover:bg-surface"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-lg" ref={resultsRef}>
        {query && searchResults.length === 0 ? (
          <div className="text-center text-text-muted p-2xl text-lg">
            No games found for "{query}"
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-0 p-sm" ref={gridRef}>
            {searchResults.map((result, index) => (
              <GameCard
                key={`${result.item.store}:${result.item.id}`}
                ref={setCardRef(index)}
                game={result.item}
                onClick={() => onGameSelect?.(result.item)}
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
            <kbd className="bg-surface px-1.5 py-0.5 rounded text-[0.7rem] font-sans">←</kbd>
            <kbd className="bg-surface px-1.5 py-0.5 rounded text-[0.7rem] font-sans">↑</kbd>
            <kbd className="bg-surface px-1.5 py-0.5 rounded text-[0.7rem] font-sans">↓</kbd>
            <kbd className="bg-surface px-1.5 py-0.5 rounded text-[0.7rem] font-sans">→</kbd> navigate ·
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
