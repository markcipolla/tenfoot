import { forwardRef } from 'react';

export interface HeaderActionButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'accent' | 'transparent';
  onNavigateDown?: () => void;
  onNavigateUp?: () => void;
}

export const HeaderActionButton = forwardRef<HTMLButtonElement, HeaderActionButtonProps>(
  function HeaderActionButton(
    { children, onClick, disabled, variant = 'default', onNavigateDown, onNavigateUp },
    ref
  ) {
    const baseClasses =
      'px-md py-sm border-none rounded text-base font-semibold cursor-pointer transition-all duration-fast focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-primary';

    const variantClasses = {
      default: 'bg-surface text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      accent: 'bg-transparent text-accent hover:bg-surface hover:text-accent-hover',
      transparent: 'bg-transparent text-text-secondary hover:bg-surface hover:text-text-primary',
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
      const target = e.currentTarget;

      if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        e.preventDefault();
        onNavigateDown?.();
      } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        e.preventDefault();
        onNavigateUp?.();
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        const prev = target.previousElementSibling as HTMLButtonElement | null;
        prev?.focus();
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        const next = target.nextElementSibling as HTMLButtonElement | null;
        next?.focus();
      }
    };

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]}`}
        onClick={onClick}
        disabled={disabled}
        onKeyDown={handleKeyDown}
      >
        {children}
      </button>
    );
  }
);
