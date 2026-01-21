/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor, cleanup } from '@testing-library/react'
import { BrowseStateProvider, useBrowseState, getBrowseUrl, BrowseState } from './BrowseStateContext'

// Simple test component that displays context state
function TestDisplay() {
  const context = useBrowseState()
  return (
    <div>
      <span data-testid="has-state">{context.browseState ? 'yes' : 'no'}</span>
      <span data-testid="search-params">{context.browseState?.searchParams ?? ''}</span>
      <span data-testid="scroll-y">{context.browseState?.scrollY ?? 0}</span>
      <span data-testid="should-restore">{context.shouldRestoreScroll ? 'yes' : 'no'}</span>
    </div>
  )
}

// Test component for actions
function TestActions({
  onAction,
}: {
  onAction: (ctx: ReturnType<typeof useBrowseState>) => void
}) {
  const context = useBrowseState()
  return (
    <button onClick={() => onAction(context)} data-testid="action">
      Act
    </button>
  )
}

// Mock sessionStorage
class MockStorage implements Storage {
  private store: Record<string, string> = {}

  get length() {
    return Object.keys(this.store).length
  }

  clear() {
    this.store = {}
  }

  getItem(key: string): string | null {
    return this.store[key] || null
  }

  key(index: number): string | null {
    const keys = Object.keys(this.store)
    return keys[index] || null
  }

  removeItem(key: string) {
    delete this.store[key]
  }

  setItem(key: string, value: string) {
    this.store[key] = value
  }
}

describe('BrowseStateContext', () => {
  let mockStorage: MockStorage

  const createState = (overrides: Partial<BrowseState> = {}): BrowseState => ({
    searchParams: '?search=test&page=2',
    scrollY: 500,
    timestamp: Date.now(),
    ...overrides,
  })

  beforeEach(() => {
    mockStorage = new MockStorage()
    vi.stubGlobal('sessionStorage', mockStorage)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('useBrowseState hook', () => {
    it('throws error when used outside provider', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        render(<TestDisplay />)
      }).toThrow('useBrowseState must be used within a BrowseStateProvider')
    })
  })

  describe('BrowseStateProvider', () => {
    it('provides initial empty state', () => {
      render(
        <BrowseStateProvider>
          <TestDisplay />
        </BrowseStateProvider>
      )

      expect(screen.getByTestId('has-state')).toHaveTextContent('no')
      expect(screen.getByTestId('search-params')).toHaveTextContent('')
      expect(screen.getByTestId('scroll-y')).toHaveTextContent('0')
    })

    it('loads state from sessionStorage on mount', async () => {
      const state = createState()
      mockStorage.setItem('browse-state', JSON.stringify(state))

      render(
        <BrowseStateProvider>
          <TestDisplay />
        </BrowseStateProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('has-state')).toHaveTextContent('yes')
      })

      expect(screen.getByTestId('search-params')).toHaveTextContent('?search=test&page=2')
      expect(screen.getByTestId('scroll-y')).toHaveTextContent('500')
    })

    it('sets shouldRestoreScroll to true when loading from storage', async () => {
      const state = createState()
      mockStorage.setItem('browse-state', JSON.stringify(state))

      render(
        <BrowseStateProvider>
          <TestDisplay />
        </BrowseStateProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('should-restore')).toHaveTextContent('yes')
      })
    })

    it('does not load expired state from sessionStorage', async () => {
      // Create state that expired 31 minutes ago
      const expiredState = createState({
        timestamp: Date.now() - (31 * 60 * 1000),
      })
      mockStorage.setItem('browse-state', JSON.stringify(expiredState))

      render(
        <BrowseStateProvider>
          <TestDisplay />
        </BrowseStateProvider>
      )

      // Wait for hydration
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(screen.getByTestId('has-state')).toHaveTextContent('no')
      expect(mockStorage.getItem('browse-state')).toBeNull()
    })

    it('handles invalid JSON in sessionStorage gracefully', async () => {
      mockStorage.setItem('browse-state', 'invalid json')

      render(
        <BrowseStateProvider>
          <TestDisplay />
        </BrowseStateProvider>
      )

      expect(screen.getByTestId('has-state')).toHaveTextContent('no')
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('saveBrowseState', () => {
    it('saves state and updates context', async () => {
      render(
        <BrowseStateProvider>
          <TestDisplay />
          <TestActions
            onAction={(ctx) => {
              ctx.saveBrowseState('?keywords=1,2', 1000)
            }}
          />
        </BrowseStateProvider>
      )

      // Wait for hydration
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      act(() => {
        screen.getByTestId('action').click()
      })

      expect(screen.getByTestId('has-state')).toHaveTextContent('yes')
      expect(screen.getByTestId('search-params')).toHaveTextContent('?keywords=1,2')
      expect(screen.getByTestId('scroll-y')).toHaveTextContent('1000')
    })

    it('persists to sessionStorage', async () => {
      render(
        <BrowseStateProvider>
          <TestDisplay />
          <TestActions
            onAction={(ctx) => {
              ctx.saveBrowseState('?search=quilts', 250)
            }}
          />
        </BrowseStateProvider>
      )

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      act(() => {
        screen.getByTestId('action').click()
      })

      await waitFor(() => {
        const stored = mockStorage.getItem('browse-state')
        expect(stored).not.toBeNull()
        const parsed = JSON.parse(stored!)
        expect(parsed.searchParams).toBe('?search=quilts')
        expect(parsed.scrollY).toBe(250)
        expect(parsed.timestamp).toBeDefined()
      })
    })

    it('does not set shouldRestoreScroll immediately (deferred to remount)', async () => {
      render(
        <BrowseStateProvider>
          <TestDisplay />
          <TestActions
            onAction={(ctx) => {
              ctx.saveBrowseState('?page=3', 800)
            }}
          />
        </BrowseStateProvider>
      )

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      // Initially no restore flag
      expect(screen.getByTestId('should-restore')).toHaveTextContent('no')

      act(() => {
        screen.getByTestId('action').click()
      })

      // After saving, shouldRestoreScroll should still be false - it only becomes
      // true when the provider remounts and loads from sessionStorage
      expect(screen.getByTestId('should-restore')).toHaveTextContent('no')

      // But state should be saved
      expect(screen.getByTestId('has-state')).toHaveTextContent('yes')
    })

    it('sets shouldRestoreScroll on remount after save', async () => {
      // First render - save state
      const { unmount } = render(
        <BrowseStateProvider>
          <TestDisplay />
          <TestActions
            onAction={(ctx) => {
              ctx.saveBrowseState('?page=3', 800)
            }}
          />
        </BrowseStateProvider>
      )

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      act(() => {
        screen.getByTestId('action').click()
      })

      // Wait for sessionStorage write
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      // Unmount (simulates navigating away)
      unmount()

      // Remount (simulates navigating back to browse)
      render(
        <BrowseStateProvider>
          <TestDisplay />
        </BrowseStateProvider>
      )

      // Wait for hydration
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      // Now shouldRestoreScroll should be true from loading sessionStorage
      expect(screen.getByTestId('should-restore')).toHaveTextContent('yes')
      expect(screen.getByTestId('search-params')).toHaveTextContent('?page=3')
      expect(screen.getByTestId('scroll-y')).toHaveTextContent('800')
    })
  })

  describe('clearBrowseState', () => {
    it('clears state from context and storage', async () => {
      const state = createState()
      mockStorage.setItem('browse-state', JSON.stringify(state))

      render(
        <BrowseStateProvider>
          <TestDisplay />
          <TestActions
            onAction={(ctx) => {
              ctx.clearBrowseState()
            }}
          />
        </BrowseStateProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('has-state')).toHaveTextContent('yes')
      })

      act(() => {
        screen.getByTestId('action').click()
      })

      expect(screen.getByTestId('has-state')).toHaveTextContent('no')
      expect(screen.getByTestId('should-restore')).toHaveTextContent('no')
      expect(mockStorage.getItem('browse-state')).toBeNull()
    })
  })

  describe('markScrollRestored', () => {
    it('sets shouldRestoreScroll to false', async () => {
      const state = createState()
      mockStorage.setItem('browse-state', JSON.stringify(state))

      render(
        <BrowseStateProvider>
          <TestDisplay />
          <TestActions
            onAction={(ctx) => {
              ctx.markScrollRestored()
            }}
          />
        </BrowseStateProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('should-restore')).toHaveTextContent('yes')
      })

      act(() => {
        screen.getByTestId('action').click()
      })

      expect(screen.getByTestId('should-restore')).toHaveTextContent('no')
    })
  })

  describe('sessionStorage error handling', () => {
    it('handles setItem error gracefully', async () => {
      render(
        <BrowseStateProvider>
          <TestDisplay />
          <TestActions
            onAction={(ctx) => {
              ctx.saveBrowseState('?test=1', 100)
            }}
          />
        </BrowseStateProvider>
      )

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      // Mock setItem to throw
      mockStorage.setItem = () => {
        throw new Error('Storage full')
      }

      act(() => {
        screen.getByTestId('action').click()
      })

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      expect(console.error).toHaveBeenCalledWith(
        'Failed to save browse state to sessionStorage:',
        expect.any(Error)
      )
    })

    it('handles removeItem error gracefully in clearBrowseState', async () => {
      const state = createState()
      mockStorage.setItem('browse-state', JSON.stringify(state))

      render(
        <BrowseStateProvider>
          <TestDisplay />
          <TestActions
            onAction={(ctx) => {
              ctx.clearBrowseState()
            }}
          />
        </BrowseStateProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('has-state')).toHaveTextContent('yes')
      })

      // Mock removeItem to throw
      mockStorage.removeItem = () => {
        throw new Error('Storage error')
      }

      act(() => {
        screen.getByTestId('action').click()
      })

      expect(console.error).toHaveBeenCalledWith(
        'Failed to clear browse state from sessionStorage:',
        expect.any(Error)
      )
    })
  })
})

describe('getBrowseUrl', () => {
  it('returns /browse when state is null', () => {
    expect(getBrowseUrl(null)).toBe('/browse')
  })

  it('returns /browse when searchParams is empty', () => {
    const state: BrowseState = {
      searchParams: '',
      scrollY: 100,
      timestamp: Date.now(),
    }
    expect(getBrowseUrl(state)).toBe('/browse')
  })

  it('returns browse URL with search params', () => {
    const state: BrowseState = {
      searchParams: '?search=test&page=2',
      scrollY: 100,
      timestamp: Date.now(),
    }
    expect(getBrowseUrl(state)).toBe('/browse?search=test&page=2')
  })

  it('handles params with multiple keywords', () => {
    const state: BrowseState = {
      searchParams: '?keywords=1,2,3&page=5',
      scrollY: 100,
      timestamp: Date.now(),
    }
    expect(getBrowseUrl(state)).toBe('/browse?keywords=1,2,3&page=5')
  })
})
