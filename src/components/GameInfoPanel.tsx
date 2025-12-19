import { useRef, useEffect, useCallback, useState } from 'react';
import type { Game } from '../types';
import { SteamIcon, EpicIcon, GOGIcon } from './icons/StoreIcons';

export interface GameInfoPanelProps {
  game: Game;
  onPlay: () => void;
  onInstall?: () => void;
  onClose: () => void;
}

interface GameDetails {
  description?: string;
  developers?: string[];
  publishers?: string[];
  genres?: string[];
  platforms?: string[];
  releaseDate?: string;
}

const isTauri = () => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

async function fetchGameDetails(gameId: string, store: string): Promise<GameDetails | null> {
  if (!isTauri()) return null;

  try {
    const { invoke } = await import('@tauri-apps/api/core');

    if (store === 'steam') {
      return await invoke<GameDetails | null>('get_game_details', { gameId });
    } else if (store === 'epic') {
      return await invoke<GameDetails | null>('get_epic_game_details', { gameId });
    }

    return null;
  } catch (err) {
    console.error('Failed to fetch game details:', err);
    return null;
  }
}

export function GameInfoPanel({ game, onPlay, onInstall, onClose }: GameInfoPanelProps) {
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const [details, setDetails] = useState<GameDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    playButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const loadDetails = async () => {
      setLoadingDetails(true);
      const data = await fetchGameDetails(game.id, game.store);
      setDetails(data);
      setLoadingDetails(false);
    };
    loadDetails();
  }, [game.id, game.store]);

  const formatPlaytime = (minutes?: number) => {
    if (!minutes || minutes === 0) return 'Never played';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 1) return `${minutes} minutes`;
    if (mins === 0) return `${hours} hour${hours !== 1 ? 's' : ''}`;
    return `${hours}h ${mins}m`;
  };

  const formatLastPlayed = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) !== 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const StoreIcon = () => {
    switch (game.store) {
      case 'steam': return <SteamIcon />;
      case 'epic': return <EpicIcon />;
      case 'gog': return <GOGIcon />;
      default: return null;
    }
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        onClose();
        break;
    }
  }, [onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const coverUrl = game.cover_url || game.icon_url;

  const cleanDescription = (html?: string) => {
    if (!html) return null;
    return html.replace(/<[^>]*>/g, '').trim();
  };

  return (
    <div className="fixed inset-0 bottom-bottom-bar z-modal flex bg-primary animate-fade-in overflow-hidden">
      <div className="flex w-full h-full overflow-hidden">
        <div className="flex-[0_0_40%] max-w-[500px] h-full bg-tertiary flex items-center justify-center overflow-hidden">
          {coverUrl ? (
            <img src={coverUrl} alt={game.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-surface to-tertiary">
              <span className="text-[6rem] font-bold text-text-muted uppercase">{game.name.charAt(0)}</span>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-xl pt-xl pb-lg border-b border-surface">
            <div className="flex justify-between items-start gap-lg">
              <h1 className="text-[2rem] font-bold text-text-primary m-0 leading-tight">{game.name}</h1>
              <div
                className={`w-10 h-10 p-2 rounded bg-surface flex items-center justify-center shrink-0 [&_.store-icon]:w-6 [&_.store-icon]:h-6 ${game.store === 'gog' ? '[&_.store-icon]:brightness-0 [&_.store-icon]:invert' : ''}`}
                data-store={game.store}
              >
                <StoreIcon />
              </div>
            </div>
            {details?.developers && details.developers.length > 0 && (
              <p className="text-text-secondary text-[0.95rem] mt-sm m-0">{details.developers.join(', ')}</p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-xl flex flex-col gap-xl">
            <div className="flex gap-md flex-wrap">
              {game.installed ? (
                <button
                  ref={playButtonRef}
                  className="flex items-center justify-center gap-sm px-2xl py-md border-none rounded text-lg font-semibold cursor-pointer transition-all duration-fast bg-accent text-white hover:bg-accent-hover focus:outline focus:outline-2 focus:outline-accent focus:outline-offset-2 focus:scale-[1.02]"
                  onClick={onPlay}
                >
                  <PlayIcon />
                  Play
                </button>
              ) : (
                <button
                  ref={playButtonRef}
                  className="flex items-center justify-center gap-sm px-2xl py-md border-none rounded text-lg font-semibold cursor-pointer transition-all duration-fast bg-surface text-text-primary hover:bg-surface-hover focus:outline focus:outline-2 focus:outline-accent focus:outline-offset-2 focus:scale-[1.02]"
                  onClick={onInstall}
                >
                  <DownloadIcon />
                  Install
                </button>
              )}
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-lg">
              <div className="flex flex-col gap-xs">
                <span className="text-xs text-text-muted uppercase tracking-wide">Playtime</span>
                <span className="text-lg font-medium text-text-primary">{formatPlaytime(game.playtime_minutes)}</span>
              </div>
              <div className="flex flex-col gap-xs">
                <span className="text-xs text-text-muted uppercase tracking-wide">Last Played</span>
                <span className="text-lg font-medium text-text-primary">{formatLastPlayed(game.last_played)}</span>
              </div>
              <div className="flex flex-col gap-xs">
                <span className="text-xs text-text-muted uppercase tracking-wide">Status</span>
                <span className="text-lg font-medium text-text-primary">
                  {game.installed ? 'Installed' : 'Not Installed'}
                </span>
              </div>
              {details?.genres && details.genres.length > 0 && (
                <div className="flex flex-col gap-xs">
                  <span className="text-xs text-text-muted uppercase tracking-wide">Genre</span>
                  <span className="text-lg font-medium text-text-primary">{details.genres.slice(0, 2).join(', ')}</span>
                </div>
              )}
              {details?.releaseDate && (
                <div className="flex flex-col gap-xs">
                  <span className="text-xs text-text-muted uppercase tracking-wide">Released</span>
                  <span className="text-lg font-medium text-text-primary">{details.releaseDate}</span>
                </div>
              )}
              {details?.platforms && details.platforms.length > 0 && (
                <div className="flex flex-col gap-xs">
                  <span className="text-xs text-text-muted uppercase tracking-wide">Platforms</span>
                  <span className="text-lg font-medium text-text-primary flex gap-sm [&_.platform-icon]:w-5 [&_.platform-icon]:h-5 [&_.platform-icon]:opacity-80">
                    {details.platforms.includes('Windows') && <WindowsIcon />}
                    {details.platforms.includes('macOS') && <MacIcon />}
                    {details.platforms.includes('Linux') && <LinuxIcon />}
                  </span>
                </div>
              )}
            </div>

            {loadingDetails && (
              <p className="text-text-muted text-sm">Loading game details...</p>
            )}

            {details?.description && (
              <div className="flex flex-col gap-sm">
                <h3 className="text-[0.85rem] font-semibold text-text-secondary uppercase tracking-wide m-0">About</h3>
                <p className="text-[0.95rem] leading-relaxed text-text-secondary m-0">
                  {cleanDescription(details.description)}
                </p>
              </div>
            )}
          </div>

          <div className="fixed bottom-0 right-md h-bottom-bar flex items-center z-[401] gap-md justify-end">
            <span className="text-xs text-text-primary">
              <kbd className="bg-surface px-1.5 py-0.5 rounded font-sans">Enter</kbd> {game.installed ? 'Play' : 'Install'}
            </span>
            <span className="text-xs text-text-primary">
              <kbd className="bg-surface px-1.5 py-0.5 rounded font-sans">Esc</kbd> Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="5,3 19,12 5,21" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7,10 12,15 17,10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function WindowsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="platform-icon">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
    </svg>
  );
}

function MacIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="platform-icon">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function LinuxIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="platform-icon">
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.123-.067-.188-.135a.357.357 0 00-.19-.064c.431-1.278.264-2.55-.173-3.694-.533-1.41-1.465-2.638-2.175-3.483-.796-1.005-1.576-1.957-1.56-3.368.026-2.152.236-6.133-3.544-6.139zm.529 3.405h.013c.213 0 .396.062.584.198.19.135.33.332.438.533.105.259.158.459.166.724 0-.02.006-.04.006-.06v.105a.086.086 0 01-.004-.021l-.004-.024a1.807 1.807 0 01-.15.706.953.953 0 01-.213.335.71.71 0 00-.088-.042c-.104-.045-.198-.064-.284-.133a1.312 1.312 0 00-.22-.066c.05-.06.146-.133.183-.198.053-.128.082-.264.088-.402v-.02a1.21 1.21 0 00-.061-.4c-.045-.134-.101-.2-.183-.333-.084-.066-.167-.132-.267-.132h-.016c-.093 0-.176.03-.262.132a.8.8 0 00-.205.334 1.18 1.18 0 00-.09.4v.019c.002.089.008.179.02.267-.193-.067-.438-.135-.607-.202a1.635 1.635 0 01-.018-.2v-.02a1.772 1.772 0 01.15-.768c.082-.22.232-.406.43-.533a.985.985 0 01.594-.2zm-2.962.059h.036c.142 0 .27.048.399.135.146.129.264.288.344.465.09.199.14.4.153.667v.004c.007.134.006.2-.002.266v.08c-.03.007-.056.018-.083.024-.152.055-.274.135-.393.2.012-.09.013-.18.003-.267v-.015c-.012-.133-.04-.2-.082-.333a.613.613 0 00-.166-.267.248.248 0 00-.183-.064h-.021c-.071.006-.13.04-.186.132a.552.552 0 00-.12.27.944.944 0 00-.023.33v.015c.012.135.037.2.08.334.046.134.098.2.166.268.01.009.02.018.034.024-.07.057-.117.07-.176.136a.304.304 0 01-.131.068 2.62 2.62 0 01-.275-.402 1.772 1.772 0 01-.155-.667 1.759 1.759 0 01.08-.668 1.43 1.43 0 01.283-.535c.128-.133.26-.2.418-.2zm1.37 1.706c.332 0 .733.065 1.216.399.293.2.523.269 1.052.468h.003c.255.136.405.266.478.399v-.131a.571.571 0 01.016.47c-.123.31-.516.643-1.063.842v.002c-.268.135-.501.333-.775.465-.276.135-.588.292-1.012.267a1.139 1.139 0 01-.448-.067 3.566 3.566 0 01-.322-.198c-.195-.135-.363-.332-.612-.465v-.005h-.005c-.4-.246-.616-.512-.686-.71-.07-.268-.005-.47.193-.6.224-.135.38-.271.483-.336.104-.074.143-.102.176-.131h.002v-.003c.169-.202.436-.47.839-.601.139-.036.294-.065.466-.065zm2.8 2.142c.358 1.417 1.196 3.475 1.735 4.473.286.534.855 1.659 1.102 3.024.156-.005.33.018.513.064.646-1.671-.546-3.467-1.089-3.966-.22-.2-.232-.335-.123-.335.59.534 1.365 1.572 1.646 2.757.13.535.16 1.104.021 1.67.067.028.135.06.205.067 1.032.534 1.413.938 1.23 1.537v-.002c-.06.194-.24.4-.615.468-.046.016-.101.03-.164.04l-.004-.003c-.396.089-.84-.025-1.37-.315-.526-.287-1.137-.666-1.832-.936l-.169-.075c-.078.381-.112.77-.084 1.156l.003.03v.003c-.003.3-.054.597-.155.884-.098.283-.218.536-.4.749-.195.267-.37.401-.618.601a4.497 4.497 0 00-.8 1.002c.036.08.072.158.107.236.396.853 1.013 1.553 1.81 1.536.813-.064 1.326-.587 1.563-1.203.267-.666.353-1.398.265-2.143-.086-.684-.268-1.323-.518-1.961l-.053-.142c.012-.165.053-.265.167-.402a.77.77 0 01.269-.2c-.005-.066.005-.135-.007-.2l-.02-.067.004.003c-.03-.114-.1-.201-.198-.268.047-.134.113-.265.113-.399-.002-.148-.082-.267-.218-.333-.152-.068-.3-.003-.4.135l-.053.068c-.198.334-.302.664-.395.87-.044.089-.05.2-.074.27-.065.032-.073.064-.073.13v.131c-.005.02-.01.038-.015.057l-.022.068c-.13.4-.347.733-.607 1.001-.259.267-.554.468-.847.6-.347.167-.744.333-1.324.467-.154.033-.31.066-.467.098-.132.006-.265.012-.397.02-.265.268-.537.403-.8.603l-.002-.002c-.156.066-.267.133-.398.067h-.002c-.135-.067-.202-.135-.202-.267 0-.07.005-.136.018-.2l.006-.033c.15-.202.333-.4.467-.667.202-.333.535-.864.603-1.467-.005-.2-.132-.332-.332-.465l-.002.002a4.87 4.87 0 00-.332-.2c-.198-.135-.398-.2-.533-.333-.067-.07-.2-.2-.198-.334.002-.135.077-.265.207-.332.14-.068.285-.134.396-.134l.2.002c.134.002.2-.067.2-.201 0-.136-.067-.335-.067-.468v-.066c-.009-.234-.052-.465-.079-.698-.042-.373-.109-.746-.153-1.119-.088-.727-.136-1.455-.14-2.183l-.005-.467c-.024-.267-.051-.4-.19-.6-.097-.134-.178-.267-.26-.333-.062-.067-.088-.2-.064-.4.018-.134.094-.263.228-.33.133-.068.198-.068.332-.133.131-.134.262-.2.332-.333l.008-.02a6.92 6.92 0 00.4-.465c.266-.4.545-.936.784-1.4l.05-.103c.054-.2-.03-.332-.198-.468-.133-.066-.198-.067-.333-.2-.066-.063-.131-.133-.185-.198-.052-.066-.085-.135-.085-.2-.002-.1.04-.2.107-.267.066-.068.158-.1.254-.133h.003c.06-.012.12-.023.179-.046a3.896 3.896 0 001.103-.534l.003-.002c.068-.032.135-.064.199-.132.068-.068.133-.134.2-.2.402-.334.803-.601 1.338-.601z" />
    </svg>
  );
}
