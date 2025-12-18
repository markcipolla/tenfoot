import { useEffect, useRef, useState, useCallback } from 'react';

export type Screen = 'stores' | 'library' | 'settings';

export interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentScreen: Screen;
  onNavigate: (screen: Screen) => void;
}

interface NavItem {
  id: Screen;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    id: 'stores',
    label: 'Stores',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9,22 9,12 15,12 15,22" />
      </svg>
    ),
  },
  {
    id: 'library',
    label: 'Library',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
      </svg>
    ),
  },
];

export function SidePanel({ isOpen, onClose, currentScreen, onNavigate }: SidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(0);
      setTimeout(() => itemRefs.current[0]?.focus(), 50);
    }
  }, [isOpen]);

  const focusItem = useCallback((index: number) => {
    const clampedIndex = Math.max(0, Math.min(index, navItems.length - 1));
    setFocusedIndex(clampedIndex);
    itemRefs.current[clampedIndex]?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          e.preventDefault();
          focusItem((focusedIndex + 1) % navItems.length);
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          e.preventDefault();
          focusItem(focusedIndex - 1 < 0 ? navItems.length - 1 : focusedIndex - 1);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          onClose();
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          handleNavClick(navItems[focusedIndex].id);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, focusedIndex, focusItem, onClose]);

  const handleNavClick = (screen: Screen) => {
    onNavigate(screen);
    onClose();
  };

  const setItemRef = (index: number) => (el: HTMLButtonElement | null) => {
    itemRefs.current[index] = el;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bottom-bottom-bar bg-black/50 transition-all duration-normal z-[405] ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <nav
        ref={panelRef}
        className={`fixed top-0 left-0 bottom-bottom-bar w-side-panel bg-secondary border-r border-surface transition-transform duration-normal z-[410] flex flex-col overflow-y-auto ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-label="Main navigation"
        aria-hidden={!isOpen}
      >
        <div className="p-lg border-b border-surface">
          <h2 className="text-xl font-bold text-text-primary">TenFoot</h2>
        </div>

        <ul className="list-none p-md flex flex-col gap-xs">
          {navItems.map((item, index) => (
            <li key={item.id}>
              <button
                ref={setItemRef(index)}
                className={`flex items-center gap-md w-full p-md bg-transparent border-2 rounded text-base font-medium text-left cursor-pointer transition-all duration-fast
                  hover:bg-surface hover:text-text-primary
                  focus-visible:outline-none focus-visible:border-accent focus-visible:bg-surface focus-visible:text-text-primary
                  ${currentScreen === item.id ? 'bg-surface text-accent border-accent' : 'text-text-secondary border-transparent'}
                  ${focusedIndex === index ? 'border-accent bg-surface text-text-primary' : ''}`}
                onClick={() => handleNavClick(item.id)}
                onFocus={() => setFocusedIndex(index)}
                tabIndex={isOpen ? 0 : -1}
                aria-current={currentScreen === item.id ? 'page' : undefined}
              >
                <span className="flex items-center justify-center w-6 h-6">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
