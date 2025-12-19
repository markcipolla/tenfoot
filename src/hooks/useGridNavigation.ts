import { useCallback, useRef } from 'react';

export interface GridNavigationOptions {
  /** Total number of items in the grid */
  itemCount: number;
  /** Number of columns (or function to calculate dynamically) */
  columns: number | (() => number);
  /** Whether horizontal navigation wraps to next/previous row */
  wrapHorizontal?: boolean;
  /** Whether vertical navigation wraps to top/bottom */
  wrapVertical?: boolean;
  /** Callback when navigating up from first row */
  onNavigateUp?: () => void;
  /** Callback when navigating down from last row */
  onNavigateDown?: () => void;
  /** Callback when navigating left from first column (first row only) */
  onNavigateLeft?: () => void;
  /** Callback when navigating right from last column (last row only) */
  onNavigateRight?: () => void;
  /** Whether to use WASD keys in addition to arrow keys (disabled in input fields) */
  enableWASD?: boolean;
  /** Whether navigation is currently enabled */
  enabled?: boolean;
  /** Index where a section break occurs (e.g., between installed and uninstalled games).
   *  When navigating up from this section's first row, go to last item of previous section. */
  sectionBreakIndex?: number;
}

export interface GridNavigationResult {
  /** Ref to attach to the container element */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Array of refs for each item */
  itemRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  /** Current focused index */
  focusedIndex: number;
  /** Focus a specific index */
  focusIndex: (index: number) => void;
  /** Handle keydown event (for use on individual items) */
  handleKeyDown: (e: React.KeyboardEvent, index: number) => void;
  /** Set ref for an item at index */
  setItemRef: (index: number) => (el: HTMLButtonElement | null) => void;
}

export function useGridNavigation(options: GridNavigationOptions): GridNavigationResult {
  const {
    itemCount,
    columns,
    wrapHorizontal = false,
    wrapVertical = false,
    onNavigateUp,
    onNavigateDown,
    onNavigateLeft,
    onNavigateRight,
    enableWASD = true,
    enabled = true,
    sectionBreakIndex,
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusedIndexRef = useRef(0);

  const getColumnCount = useCallback(() => {
    return typeof columns === 'function' ? columns() : columns;
  }, [columns]);

  const focusIndex = useCallback((index: number) => {
    if (itemCount === 0) return;
    const clampedIndex = Math.max(0, Math.min(index, itemCount - 1));
    focusedIndexRef.current = clampedIndex;
    const item = itemRefs.current[clampedIndex];
    if (item) {
      item.focus();
      // Scroll into view if needed
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [itemCount]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    if (!enabled) return;

    const cols = getColumnCount();
    const row = Math.floor(index / cols);
    const col = index % cols;
    const totalRows = Math.ceil(itemCount / cols);
    const isLastRow = row === totalRows - 1;
    const isFirstRow = row === 0;
    const itemsInCurrentRow = isLastRow ? itemCount - (row * cols) : cols;
    const isLastInRow = col === itemsInCurrentRow - 1;
    const isFirstInRow = col === 0;

    // Check if we should use WASD (not when in an input/textarea)
    const isInputFocused = e.target instanceof HTMLInputElement ||
                          e.target instanceof HTMLTextAreaElement;
    const useWASD = enableWASD && !isInputFocused;

    let nextIndex = index;
    let handled = false;

    switch (e.key) {
      case 'ArrowRight':
      case 'd':
      case 'D':
        if (e.key === 'd' || e.key === 'D') {
          if (!useWASD) return;
        }
        if (isLastInRow) {
          if (wrapHorizontal && !isLastRow) {
            // Wrap to start of next row
            nextIndex = (row + 1) * cols;
            handled = true;
          } else if (onNavigateRight) {
            onNavigateRight();
            handled = true;
          }
          // At boundary with no wrap/callback - don't handle, let default behavior
        } else if (index < itemCount - 1) {
          nextIndex = index + 1;
          handled = true;
        }
        break;

      case 'ArrowLeft':
      case 'a':
      case 'A':
        if (e.key === 'a' || e.key === 'A') {
          if (!useWASD) return;
        }
        if (isFirstInRow) {
          if (wrapHorizontal && !isFirstRow) {
            // Wrap to end of previous row
            nextIndex = row * cols - 1;
            handled = true;
          } else if (onNavigateLeft) {
            onNavigateLeft();
            handled = true;
          }
          // At boundary with no wrap/callback - don't handle, let default behavior
        } else {
          nextIndex = index - 1;
          handled = true;
        }
        break;

      case 'ArrowDown':
      case 's':
      case 'S':
        if (e.key === 's' || e.key === 'S') {
          if (!useWASD) return;
        }
        if (isLastRow) {
          if (wrapVertical) {
            nextIndex = col; // Wrap to top
          } else if (onNavigateDown) {
            onNavigateDown();
          }
        } else {
          const targetIndex = index + cols;
          // Make sure we don't go past the last item
          nextIndex = Math.min(targetIndex, itemCount - 1);
        }
        handled = true;
        break;

      case 'ArrowUp':
      case 'w':
      case 'W':
        if (e.key === 'w' || e.key === 'W') {
          if (!useWASD) return;
        }
        // Check if we're at the first row of the second section (after section break)
        if (sectionBreakIndex !== undefined && sectionBreakIndex > 0 && index >= sectionBreakIndex) {
          const sectionFirstRow = Math.floor(sectionBreakIndex / cols);
          const currentRow = Math.floor(index / cols);
          if (currentRow === sectionFirstRow) {
            // At first row of second section - go to last item of first section
            nextIndex = sectionBreakIndex - 1;
            handled = true;
            break;
          }
        }
        if (isFirstRow) {
          if (wrapVertical) {
            // Wrap to bottom - same column or last item
            const targetIndex = (totalRows - 1) * cols + col;
            nextIndex = Math.min(targetIndex, itemCount - 1);
          } else if (onNavigateUp) {
            onNavigateUp();
          }
        } else {
          nextIndex = index - cols;
        }
        handled = true;
        break;

      default:
        return;
    }

    if (handled) {
      e.preventDefault();
      e.stopPropagation();
      if (nextIndex !== index && nextIndex >= 0 && nextIndex < itemCount) {
        focusIndex(nextIndex);
      }
    }
  }, [enabled, getColumnCount, itemCount, wrapHorizontal, wrapVertical,
      onNavigateUp, onNavigateDown, onNavigateLeft, onNavigateRight, enableWASD, focusIndex, sectionBreakIndex]);

  const setItemRef = useCallback((index: number) => (el: HTMLButtonElement | null) => {
    itemRefs.current[index] = el;
  }, []);

  return {
    containerRef,
    itemRefs,
    focusedIndex: focusedIndexRef.current,
    focusIndex,
    handleKeyDown,
    setItemRef,
  };
}
