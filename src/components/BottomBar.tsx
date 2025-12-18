import { forwardRef } from 'react';

export interface BottomBarProps {
  onMenuClick: () => void;
  isMenuOpen: boolean;
  onNavigateUp?: () => void;
}

export const BottomBar = forwardRef<HTMLButtonElement, BottomBarProps>(
  function BottomBar({ onMenuClick, isMenuOpen, onNavigateUp }, ref) {
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        e.stopPropagation();
        e.nativeEvent.stopImmediatePropagation();
        onNavigateUp?.();
      }
    };

    return (
      <div className="fixed bottom-0 left-0 right-0 h-bottom-bar bg-secondary border-t border-surface flex items-center p-0 z-sticky">
        <button
          ref={ref}
          className={`flex items-center gap-sm px-md py-sm bg-transparent border-2 rounded text-text-primary text-base font-medium cursor-pointer transition-all duration-fast hover:bg-surface focus-visible:outline-none focus-visible:border-accent ${isMenuOpen ? 'bg-surface border-accent' : 'border-transparent'}`}
          onClick={onMenuClick}
          onKeyDown={handleKeyDown}
          aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMenuOpen}
        >
          <MenuIcon isOpen={isMenuOpen} />
          <span className="text-sm">Menu</span>
        </button>
      </div>
    );
  }
);

function MenuIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`w-6 h-6 transition-transform duration-normal ${isOpen ? 'rotate-90' : ''}`}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line
        x1="3" y1="6" x2="21" y2="6"
        className="origin-center transition-all duration-normal"
        style={isOpen ? { transform: 'translateY(6px) rotate(45deg)' } : {}}
      />
      <line
        x1="3" y1="12" x2="21" y2="12"
        className="origin-center transition-opacity duration-normal"
        style={isOpen ? { opacity: 0 } : {}}
      />
      <line
        x1="3" y1="18" x2="21" y2="18"
        className="origin-center transition-all duration-normal"
        style={isOpen ? { transform: 'translateY(-6px) rotate(-45deg)' } : {}}
      />
    </svg>
  );
}
