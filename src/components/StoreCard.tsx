import { forwardRef, useState } from 'react';

export interface StoreCardProps {
  id: string;
  name: string;
  icon?: React.ReactNode;
  accentColor?: string;
  backgroundColor?: string;
  onClick?: () => void;
  onFocus?: () => void;
  tabIndex?: number;
}

export const StoreCard = forwardRef<HTMLButtonElement, StoreCardProps>(
  function StoreCard(
    {
      id,
      name,
      icon,
      accentColor = '#7c3aed',
      backgroundColor = '#252540',
      onClick,
      onFocus,
      tabIndex = 0,
    },
    ref
  ) {
    const [isActive, setIsActive] = useState(false);

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsActive(true);
      }
    };

    const handleKeyUp = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        setIsActive(false);
        onClick?.();
      }
    };

    return (
      <button
        ref={ref}
        className={`relative w-[200px] h-[200px] p-lg rounded shadow-lg cursor-pointer flex items-center justify-center transition-all duration-normal z-[1]
          border-2 border-transparent
          hover:-translate-y-1 hover:border-[var(--store-accent)]
          focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--store-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-primary
          ${isActive ? 'scale-105 z-10 shadow-lg border-[var(--store-accent)]' : ''}`}
        style={{
          '--store-accent': accentColor,
          backgroundColor,
        } as React.CSSProperties}
        onClick={onClick}
        onFocus={onFocus}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onMouseDown={() => setIsActive(true)}
        onMouseUp={() => setIsActive(false)}
        onMouseLeave={() => setIsActive(false)}
        tabIndex={tabIndex}
        aria-label={`${name} store`}
        data-store-id={id}
      >
        <div className="flex flex-col items-center gap-md">
          {icon && (
            <div
              className="w-16 h-16 flex items-center justify-center [&_svg]:w-full [&_svg]:h-full [&_svg]:object-contain [&_img]:w-full [&_img]:h-full [&_img]:object-contain"
              style={{ color: accentColor }}
            >
              {icon}
            </div>
          )}
        </div>
      </button>
    );
  }
);
