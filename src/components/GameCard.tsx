import { useState, forwardRef } from 'react';
import type { Game } from '../types';
import { SteamIcon, EpicIcon, GOGIcon } from './icons/StoreIcons';

export interface GameCardProps {
  game: Game;
  onClick?: () => void;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  tabIndex?: number;
  featured?: boolean;
}

export const GameCard = forwardRef<HTMLButtonElement, GameCardProps>(
  function GameCard({ game, onClick, onFocus, onKeyDown, tabIndex = 0, featured = false }, ref) {
    const [isActive, setIsActive] = useState(false);
    const [imageError, setImageError] = useState(false);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsActive(true);
      }
      onKeyDown?.(e);
    };

    const handleKeyUp = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsActive(false);
        onClick?.();
      }
    };

    const handleMouseDown = () => setIsActive(true);
    const handleMouseUp = () => setIsActive(false);
    const handleMouseLeave = () => setIsActive(false);

    const coverUrl = game.cover_url || game.icon_url;

    const StoreIconComponent = () => {
      switch (game.store) {
        case 'steam': return <SteamIcon />;
        case 'epic': return <EpicIcon />;
        case 'gog': return <GOGIcon />;
        default: return null;
      }
    };

    const formatPlaytime = (minutes?: number) => {
      if (!minutes || minutes === 0) return 'Unplayed';
      const hours = Math.floor(minutes / 60);
      if (hours < 1) return `${minutes}m`;
      return `${hours}h`;
    };

    const notInstalled = !game.installed;

    return (
      <div className={`game-card-wrapper flex flex-col gap-sm p-xs ${featured ? 'col-span-2' : ''}`}>
        <button
          ref={ref}
          className={`flex flex-col bg-surface border-none rounded p-0 cursor-pointer overflow-hidden transition-all duration-fast shadow-md relative w-full
            ${featured ? 'aspect-[1.55]' : 'aspect-[3/4]'}
            ${notInstalled ? 'opacity-50 grayscale-[0.7] hover:opacity-75 hover:grayscale-[0.4] focus-visible:opacity-75 focus-visible:grayscale-[0.4]' : ''}
            hover:scale-[1.02] hover:shadow-lg
            focus-visible:scale-[1.08] focus-visible:z-[5] focus-visible:shadow-lg focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary
            focus:outline-none
            ${isActive ? 'scale-[1.12] z-10 shadow-lg' : ''}`}
          onClick={onClick}
          onFocus={onFocus}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          tabIndex={tabIndex}
          data-game-id={game.id}
          data-store={game.store}
          data-installed={game.installed}
        >
          <div className="absolute inset-0 overflow-hidden bg-tertiary">
            {coverUrl && !imageError ? (
              <img
                src={coverUrl}
                alt={game.name}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface to-tertiary">
                <span className={`font-bold text-text-muted uppercase ${featured ? 'text-5xl' : 'text-4xl'}`}>
                  {game.name.charAt(0)}
                </span>
              </div>
            )}
            {notInstalled && (
              <div className="absolute inset-0 bg-black/30 pointer-events-none" />
            )}
            <div
              className={`absolute top-sm right-sm w-12 h-12 p-2 rounded bg-black/60 flex items-center justify-center ${game.store === 'gog' ? '[&_.store-icon]:brightness-0 [&_.store-icon]:invert' : ''}`}
              data-store={game.store}
            >
              <div className="w-8 h-8 [&_.store-icon]:w-full [&_.store-icon]:h-full">
                <StoreIconComponent />
              </div>
            </div>
          </div>
        </button>
        <div className="flex flex-col h-10">
          <h3 className="text-[0.85rem] font-semibold text-text-primary m-0 whitespace-nowrap overflow-hidden text-ellipsis text-left leading-tight">
            {game.name}
          </h3>
          <span className="text-[0.7rem] text-text-muted text-left leading-tight">
            {formatPlaytime(game.playtime_minutes)}
          </span>
        </div>
      </div>
    );
  }
);
