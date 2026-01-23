/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePatternModal } from './usePatternModal'

describe('usePatternModal', () => {
  // Store original methods
  const originalPushState = window.history.pushState
  const originalReplaceState = window.history.replaceState
  const originalBack = window.history.back
  const originalAddEventListener = window.addEventListener
  const originalRemoveEventListener = window.removeEventListener
  const originalBodyStyle = document.body.style.overflow

  // Mock functions
  let mockPushState: ReturnType<typeof vi.fn>
  let mockReplaceState: ReturnType<typeof vi.fn>
  let mockBack: ReturnType<typeof vi.fn>
  let popstateListeners: ((event: PopStateEvent) => void)[] = []
  let keydownListeners: ((event: KeyboardEvent) => void)[] = []

  beforeEach(() => {
    vi.clearAllMocks()
    popstateListeners = []
    keydownListeners = []

    // Mock history methods
    mockPushState = vi.fn()
    mockReplaceState = vi.fn()
    mockBack = vi.fn()
    window.history.pushState = mockPushState
    window.history.replaceState = mockReplaceState
    window.history.back = mockBack

    // Mock addEventListener/removeEventListener
    window.addEventListener = vi.fn((event, handler) => {
      if (event === 'popstate') {
        popstateListeners.push(handler as (event: PopStateEvent) => void)
      } else if (event === 'keydown') {
        keydownListeners.push(handler as (event: KeyboardEvent) => void)
      }
    })
    window.removeEventListener = vi.fn((event, handler) => {
      if (event === 'popstate') {
        popstateListeners = popstateListeners.filter(h => h !== handler)
      } else if (event === 'keydown') {
        keydownListeners = keydownListeners.filter(h => h !== handler)
      }
    })
    document.addEventListener = vi.fn((event, handler) => {
      if (event === 'keydown') {
        keydownListeners.push(handler as (event: KeyboardEvent) => void)
      }
    })
    document.removeEventListener = vi.fn((event, handler) => {
      if (event === 'keydown') {
        keydownListeners = keydownListeners.filter(h => h !== handler)
      }
    })

    // Reset body overflow
    document.body.style.overflow = ''
  })

  afterEach(() => {
    // Restore original methods
    window.history.pushState = originalPushState
    window.history.replaceState = originalReplaceState
    window.history.back = originalBack
    window.addEventListener = originalAddEventListener
    window.removeEventListener = originalRemoveEventListener
    document.body.style.overflow = originalBodyStyle
  })

  describe('initial state', () => {
    it('returns correct initial state', () => {
      const { result } = renderHook(() => usePatternModal())

      expect(result.current.patternId).toBeNull()
      expect(result.current.isOpen).toBe(false)
      expect(typeof result.current.openModal).toBe('function')
      expect(typeof result.current.closeModal).toBe('function')
      expect(typeof result.current.navigateToPattern).toBe('function')
    })
  })

  describe('openModal', () => {
    it('sets patternId and isOpen when opening modal', () => {
      const { result } = renderHook(() => usePatternModal())

      act(() => {
        result.current.openModal(123)
      })

      expect(result.current.patternId).toBe(123)
      expect(result.current.isOpen).toBe(true)
    })

    it('calls pushState with correct URL', () => {
      const { result } = renderHook(() => usePatternModal())

      act(() => {
        result.current.openModal(456)
      })

      expect(mockPushState).toHaveBeenCalledWith(
        expect.objectContaining({
          patternModal: true,
          patternId: 456,
        }),
        '',
        '/patterns/456'
      )
    })

    it('prevents body scroll when modal is open', () => {
      const { result } = renderHook(() => usePatternModal())

      act(() => {
        result.current.openModal(123)
      })

      expect(document.body.style.overflow).toBe('hidden')
    })
  })

  describe('closeModal', () => {
    it('calls history.back when closing modal', () => {
      const { result } = renderHook(() => usePatternModal())

      act(() => {
        result.current.openModal(123)
      })

      act(() => {
        result.current.closeModal()
      })

      expect(mockBack).toHaveBeenCalled()
    })

    it('does nothing if modal is not open', () => {
      const { result } = renderHook(() => usePatternModal())

      act(() => {
        result.current.closeModal()
      })

      expect(mockBack).not.toHaveBeenCalled()
    })
  })

  describe('navigateToPattern', () => {
    it('updates patternId without pushing new history entry', () => {
      const { result } = renderHook(() => usePatternModal())

      act(() => {
        result.current.openModal(123)
      })

      mockPushState.mockClear()

      act(() => {
        result.current.navigateToPattern(456)
      })

      expect(result.current.patternId).toBe(456)
      expect(mockPushState).not.toHaveBeenCalled()
      expect(mockReplaceState).toHaveBeenCalledWith(
        expect.objectContaining({
          patternModal: true,
          patternId: 456,
        }),
        '',
        '/patterns/456'
      )
    })

    it('does nothing if navigating to same pattern', () => {
      const { result } = renderHook(() => usePatternModal())

      act(() => {
        result.current.openModal(123)
      })

      mockReplaceState.mockClear()

      act(() => {
        result.current.navigateToPattern(123)
      })

      expect(mockReplaceState).not.toHaveBeenCalled()
    })
  })

  describe('popstate handling', () => {
    it('closes modal on popstate with non-modal state', () => {
      const { result } = renderHook(() => usePatternModal())

      act(() => {
        result.current.openModal(123)
      })

      expect(result.current.isOpen).toBe(true)

      // Simulate back navigation to non-modal state
      act(() => {
        const event = new PopStateEvent('popstate', { state: null })
        popstateListeners.forEach(listener => listener(event))
      })

      expect(result.current.patternId).toBeNull()
      expect(result.current.isOpen).toBe(false)
    })

    it('updates patternId on popstate with modal state', () => {
      const { result } = renderHook(() => usePatternModal())

      act(() => {
        result.current.openModal(123)
      })

      // Simulate popstate to different pattern
      act(() => {
        const event = new PopStateEvent('popstate', {
          state: { patternModal: true, patternId: 789 },
        })
        popstateListeners.forEach(listener => listener(event))
      })

      expect(result.current.patternId).toBe(789)
      expect(result.current.isOpen).toBe(true)
    })
  })

  describe('escape key handling', () => {
    it('closes modal on escape key press', () => {
      const { result } = renderHook(() => usePatternModal())

      act(() => {
        result.current.openModal(123)
      })

      // Simulate escape key press
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' })
        Object.defineProperty(event, 'preventDefault', { value: vi.fn() })
        keydownListeners.forEach(listener => listener(event))
      })

      expect(mockBack).toHaveBeenCalled()
    })

    it('does not respond to escape when modal is closed', () => {
      renderHook(() => usePatternModal())

      // Simulate escape key press without opening modal
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Escape' })
        keydownListeners.forEach(listener => listener(event))
      })

      expect(mockBack).not.toHaveBeenCalled()
    })

    it('ignores other key presses', () => {
      const { result } = renderHook(() => usePatternModal())

      act(() => {
        result.current.openModal(123)
      })

      // Simulate other key press
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'Enter' })
        keydownListeners.forEach(listener => listener(event))
      })

      expect(mockBack).not.toHaveBeenCalled()
    })
  })

  describe('cleanup', () => {
    it('removes event listeners on unmount', () => {
      const { unmount } = renderHook(() => usePatternModal())

      unmount()

      expect(window.removeEventListener).toHaveBeenCalledWith('popstate', expect.any(Function))
    })

    it('restores body overflow on unmount when modal was open', () => {
      document.body.style.overflow = 'auto'
      const { result, unmount } = renderHook(() => usePatternModal())

      act(() => {
        result.current.openModal(123)
      })

      expect(document.body.style.overflow).toBe('hidden')

      unmount()

      expect(document.body.style.overflow).toBe('auto')
    })
  })
})
