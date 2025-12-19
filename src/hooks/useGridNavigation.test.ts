import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGridNavigation, GridNavigationResult } from './useGridNavigation';

describe('useGridNavigation', () => {
  // Mock refs and focus behavior
  const mockElements: (HTMLButtonElement | null)[] = [];
  const mockFocus = vi.fn();
  const mockScrollIntoView = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockElements.length = 0;
    // Create mock button elements
    for (let i = 0; i < 12; i++) {
      const el = document.createElement('button');
      el.focus = mockFocus;
      el.scrollIntoView = mockScrollIntoView;
      mockElements.push(el);
    }
  });

  function setupRefs(result: { current: GridNavigationResult }) {
    mockElements.forEach((el, i) => {
      result.current.setItemRef(i)(el);
    });
  }

  describe('basic navigation', () => {
    it('returns required properties', () => {
      const { result } = renderHook(() =>
        useGridNavigation({ itemCount: 9, columns: 3 })
      );

      expect(result.current.containerRef).toBeDefined();
      expect(result.current.itemRefs).toBeDefined();
      expect(typeof result.current.focusIndex).toBe('function');
      expect(typeof result.current.handleKeyDown).toBe('function');
      expect(typeof result.current.setItemRef).toBe('function');
    });

    it('focuses correct index with focusIndex', () => {
      const { result } = renderHook(() =>
        useGridNavigation({ itemCount: 9, columns: 3 })
      );
      setupRefs(result);

      act(() => {
        result.current.focusIndex(4);
      });

      expect(mockFocus).toHaveBeenCalled();
    });

    it('clamps index to valid range', () => {
      const { result } = renderHook(() =>
        useGridNavigation({ itemCount: 9, columns: 3 })
      );
      setupRefs(result);

      act(() => {
        result.current.focusIndex(-1); // Should clamp to 0
      });
      expect(mockFocus).toHaveBeenCalled();

      mockFocus.mockClear();
      act(() => {
        result.current.focusIndex(100); // Should clamp to 8
      });
      expect(mockFocus).toHaveBeenCalled();
    });
  });

  describe('arrow key navigation', () => {
    it('moves right with ArrowRight', () => {
      const { result } = renderHook(() =>
        useGridNavigation({ itemCount: 9, columns: 3 })
      );
      setupRefs(result);

      const event = {
        key: 'ArrowRight',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div'),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event, 0);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockFocus).toHaveBeenCalled();
    });

    it('moves left with ArrowLeft', () => {
      const { result } = renderHook(() =>
        useGridNavigation({ itemCount: 9, columns: 3 })
      );
      setupRefs(result);

      const event = {
        key: 'ArrowLeft',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div'),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event, 1);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockFocus).toHaveBeenCalled();
    });

    it('moves down with ArrowDown', () => {
      const { result } = renderHook(() =>
        useGridNavigation({ itemCount: 9, columns: 3 })
      );
      setupRefs(result);

      const event = {
        key: 'ArrowDown',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div'),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event, 0);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockFocus).toHaveBeenCalled();
    });

    it('moves up with ArrowUp', () => {
      const { result } = renderHook(() =>
        useGridNavigation({ itemCount: 9, columns: 3 })
      );
      setupRefs(result);

      const event = {
        key: 'ArrowUp',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div'),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event, 4);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockFocus).toHaveBeenCalled();
    });
  });

  describe('WASD navigation', () => {
    it('moves right with D key when WASD enabled', () => {
      const { result } = renderHook(() =>
        useGridNavigation({ itemCount: 9, columns: 3, enableWASD: true })
      );
      setupRefs(result);

      const event = {
        key: 'd',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div'),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event, 0);
      });

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it('does not move with WASD when in input field', () => {
      const { result } = renderHook(() =>
        useGridNavigation({ itemCount: 9, columns: 3, enableWASD: true })
      );
      setupRefs(result);

      const input = document.createElement('input');
      const event = {
        key: 'd',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: input,
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event, 0);
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
    });

    it('does not move with WASD when disabled', () => {
      const { result } = renderHook(() =>
        useGridNavigation({ itemCount: 9, columns: 3, enableWASD: false })
      );
      setupRefs(result);

      const event = {
        key: 'd',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div'),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event, 0);
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe('boundary behavior', () => {
    it('calls onNavigateUp when at first row and pressing up', () => {
      const onNavigateUp = vi.fn();
      const { result } = renderHook(() =>
        useGridNavigation({
          itemCount: 9,
          columns: 3,
          onNavigateUp,
        })
      );
      setupRefs(result);

      const event = {
        key: 'ArrowUp',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div'),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event, 1); // First row, middle column
      });

      expect(onNavigateUp).toHaveBeenCalled();
    });

    it('calls onNavigateDown when at last row and pressing down', () => {
      const onNavigateDown = vi.fn();
      const { result } = renderHook(() =>
        useGridNavigation({
          itemCount: 9,
          columns: 3,
          onNavigateDown,
        })
      );
      setupRefs(result);

      const event = {
        key: 'ArrowDown',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div'),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event, 7); // Last row
      });

      expect(onNavigateDown).toHaveBeenCalled();
    });

    it('does not move past first item with ArrowLeft', () => {
      const { result } = renderHook(() =>
        useGridNavigation({ itemCount: 9, columns: 3 })
      );
      setupRefs(result);

      const event = {
        key: 'ArrowLeft',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div'),
      } as unknown as React.KeyboardEvent;

      mockFocus.mockClear();
      act(() => {
        result.current.handleKeyDown(event, 0);
      });

      // Should not move (already at first item in row)
      expect(mockFocus).not.toHaveBeenCalled();
    });

    it('does not move past last item with ArrowRight', () => {
      const { result } = renderHook(() =>
        useGridNavigation({ itemCount: 9, columns: 3 })
      );
      setupRefs(result);

      const event = {
        key: 'ArrowRight',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div'),
      } as unknown as React.KeyboardEvent;

      mockFocus.mockClear();
      act(() => {
        result.current.handleKeyDown(event, 8);
      });

      // Should not move (already at last item)
      expect(mockFocus).not.toHaveBeenCalled();
    });
  });

  describe('wrapping behavior', () => {
    it('wraps horizontally when enabled', () => {
      const { result } = renderHook(() =>
        useGridNavigation({
          itemCount: 9,
          columns: 3,
          wrapHorizontal: true,
        })
      );
      setupRefs(result);

      const event = {
        key: 'ArrowRight',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div'),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event, 2); // End of first row
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockFocus).toHaveBeenCalled();
    });

    it('wraps vertically when enabled', () => {
      const { result } = renderHook(() =>
        useGridNavigation({
          itemCount: 9,
          columns: 3,
          wrapVertical: true,
        })
      );
      setupRefs(result);

      const event = {
        key: 'ArrowDown',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div'),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event, 7); // Last row
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockFocus).toHaveBeenCalled();
    });
  });

  describe('section breaks', () => {
    it('jumps to end of previous section when at section break', () => {
      const { result } = renderHook(() =>
        useGridNavigation({
          itemCount: 12,
          columns: 3,
          sectionBreakIndex: 6, // Second section starts at index 6
        })
      );
      setupRefs(result);

      const event = {
        key: 'ArrowUp',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div'),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event, 6); // First item of second section
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(mockFocus).toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('does nothing when disabled', () => {
      const { result } = renderHook(() =>
        useGridNavigation({
          itemCount: 9,
          columns: 3,
          enabled: false,
        })
      );
      setupRefs(result);

      const event = {
        key: 'ArrowRight',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div'),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event, 0);
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(mockFocus).not.toHaveBeenCalled();
    });
  });

  describe('dynamic columns', () => {
    it('supports function for columns', () => {
      const getColumns = vi.fn(() => 4);
      const { result } = renderHook(() =>
        useGridNavigation({
          itemCount: 12,
          columns: getColumns,
        })
      );
      setupRefs(result);

      const event = {
        key: 'ArrowDown',
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: document.createElement('div'),
      } as unknown as React.KeyboardEvent;

      act(() => {
        result.current.handleKeyDown(event, 0);
      });

      expect(getColumns).toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
    });
  });
});
