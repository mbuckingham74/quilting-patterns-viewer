/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor, cleanup } from '@testing-library/react'
import { useEffect } from 'react'
import { BrowseStateProvider, useBrowseState, getBrowseUrl, BrowseState } from './BrowseStateContext'

// Simple test component that displays context state
function TestDisplay() {
  const context = useBrowseState()
  return (
    <div>
      <span data-testid="has-state">{context.browseState ? 'yes' : 'no'}</span>
      <span data-testid="search-params">{context.browseState?.searchParams ?? ''}</span>
      <span data-testid="scroll-y">{context.browseState?.scrollY ?? 0}</span>
      <span data-testid="request-restore">{context.requestScrollRestore() ? 'yes' : 'no'}</span>
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

    it('requestScrollRestore returns true when loading from storage', async () => {
      const state = createState()
      mockStorage.setItem('browse-state', JSON.stringify(state))

      render(
        <BrowseStateProvider>
          <TestDisplay />
        </BrowseStateProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('request-restore')).toHaveTextContent('yes')
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

    it('requestScrollRestore returns true immediately after saveBrowseState (for persistent provider)', async () => {
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

      // Initially no restore flag (no state saved yet)
      expect(screen.getByTestId('request-restore')).toHaveTextContent('no')

      act(() => {
        screen.getByTestId('action').click()
      })

      // After saving, requestScrollRestore should return true
      // This is the key fix: the pending flag is set via ref so it works
      // even when provider doesn't remount (root layout scenario)
      expect(screen.getByTestId('request-restore')).toHaveTextContent('yes')
      expect(screen.getByTestId('has-state')).toHaveTextContent('yes')
    })

    it('simulates browse -> detail -> browse navigation with persistent provider', async () => {
      // This test keeps the provider mounted (like root layout) and simulates
      // unmounting/remounting only the BrowseContent-like component

      // Custom component that simulates BrowseContent mount behavior
      function BrowseContentSimulator({ onMount }: { onMount: (shouldRestore: boolean) => void }) {
        const ctx = useBrowseState()
        useEffect(() => {
          // On mount, check if we should restore (same logic as BrowseContent)
          onMount(ctx.requestScrollRestore())
        }, [])
        return <div data-testid="browse-sim">mounted</div>
      }

      const mountCallback = vi.fn()

      // Initial render - provider + browse content
      const { rerender } = render(
        <BrowseStateProvider>
          <TestDisplay />
          <TestActions
            onAction={(ctx) => {
              ctx.saveBrowseState('?keywords=1,2', 750)
            }}
          />
          <BrowseContentSimulator onMount={mountCallback} />
        </BrowseStateProvider>
      )

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      // First mount - no pending restore
      expect(mountCallback).toHaveBeenLastCalledWith(false)
      mountCallback.mockClear()

      // User clicks a pattern - save state before navigating
      act(() => {
        screen.getByTestId('action').click()
      })

      // Simulate navigating to pattern detail (remove BrowseContent but keep provider)
      rerender(
        <BrowseStateProvider>
          <TestDisplay />
          <div data-testid="detail-page">Pattern Detail</div>
        </BrowseStateProvider>
      )

      expect(screen.getByTestId('detail-page')).toBeInTheDocument()
      expect(screen.queryByTestId('browse-sim')).not.toBeInTheDocument()

      // Simulate navigating back to browse (remount BrowseContent, provider stays)
      rerender(
        <BrowseStateProvider>
          <TestDisplay />
          <TestActions
            onAction={(ctx) => {
              ctx.saveBrowseState('?keywords=1,2', 750)
            }}
          />
          <BrowseContentSimulator onMount={mountCallback} />
        </BrowseStateProvider>
      )

      // The BrowseContentSimulator should detect pending restore on its mount
      expect(mountCallback).toHaveBeenLastCalledWith(true)
      expect(screen.getByTestId('search-params')).toHaveTextContent('?keywords=1,2')
      expect(screen.getByTestId('scroll-y')).toHaveTextContent('750')
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
      expect(screen.getByTestId('request-restore')).toHaveTextContent('no')
      expect(mockStorage.getItem('browse-state')).toBeNull()
    })
  })

  describe('markScrollRestored', () => {
    it('makes requestScrollRestore return false', async () => {
      const state = createState()
      mockStorage.setItem('browse-state', JSON.stringify(state))

      // Track the result of requestScrollRestore calls
      let restoreResults: boolean[] = []

      function RestoreChecker() {
        const ctx = useBrowseState()
        return (
          <button
            data-testid="check-restore"
            onClick={() => {
              restoreResults.push(ctx.requestScrollRestore())
            }}
          >
            Check
          </button>
        )
      }

      render(
        <BrowseStateProvider>
          <TestActions
            onAction={(ctx) => {
              ctx.markScrollRestored()
            }}
          />
          <RestoreChecker />
        </BrowseStateProvider>
      )

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      // Check before marking restored
      act(() => {
        screen.getByTestId('check-restore').click()
      })
      expect(restoreResults[0]).toBe(true)

      // Mark as restored
      act(() => {
        screen.getByTestId('action').click()
      })

      // Check after marking restored
      act(() => {
        screen.getByTestId('check-restore').click()
      })
      expect(restoreResults[1]).toBe(false)
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
