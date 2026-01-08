/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor, cleanup } from '@testing-library/react'
import { ShareProvider, useShare, SharePattern } from './ShareContext'

// Simple test component that displays context state
function TestDisplay() {
  const context = useShare()
  return (
    <div>
      <span data-testid="count">{context.count}</span>
      <span data-testid="can-add-more">{context.canAddMore ? 'yes' : 'no'}</span>
    </div>
  )
}

// Test component for actions
function TestActions({
  onAction,
}: {
  onAction: (ctx: ReturnType<typeof useShare>) => void
}) {
  const context = useShare()
  return (
    <button onClick={() => onAction(context)} data-testid="action">
      Act
    </button>
  )
}

// Mock localStorage
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

describe('ShareContext', () => {
  let mockStorage: MockStorage

  const createPattern = (id: number): SharePattern => ({
    id,
    file_name: `pattern-${id}`,
    thumbnail_url: `https://example.com/${id}.png`,
    author: `Author ${id}`,
  })

  beforeEach(() => {
    mockStorage = new MockStorage()
    vi.stubGlobal('localStorage', mockStorage)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('useShare hook', () => {
    it('throws error when used outside provider', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        render(<TestDisplay />)
      }).toThrow('useShare must be used within a ShareProvider')
    })
  })

  describe('ShareProvider', () => {
    it('provides initial empty state', () => {
      render(
        <ShareProvider>
          <TestDisplay />
        </ShareProvider>
      )

      expect(screen.getByTestId('count')).toHaveTextContent('0')
      expect(screen.getByTestId('can-add-more')).toHaveTextContent('yes')
    })

    it('loads patterns from localStorage on mount', async () => {
      const storedPatterns = [createPattern(1), createPattern(2)]
      mockStorage.setItem('share-basket', JSON.stringify(storedPatterns))

      render(
        <ShareProvider>
          <TestDisplay />
        </ShareProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('2')
      })
    })

    it('handles invalid JSON in localStorage gracefully', async () => {
      mockStorage.setItem('share-basket', 'invalid json')

      render(
        <ShareProvider>
          <TestDisplay />
        </ShareProvider>
      )

      expect(screen.getByTestId('count')).toHaveTextContent('0')
      expect(console.error).toHaveBeenCalled()
    })
  })

  describe('addPattern', () => {
    it('adds a pattern and updates count', async () => {
      let result: boolean

      render(
        <ShareProvider>
          <TestDisplay />
          <TestActions
            onAction={(ctx) => {
              result = ctx.addPattern(createPattern(1))
            }}
          />
        </ShareProvider>
      )

      // Wait for hydration
      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      act(() => {
        screen.getByTestId('action').click()
      })

      expect(result!).toBe(true)
      expect(screen.getByTestId('count')).toHaveTextContent('1')
    })

    it('saves to localStorage', async () => {
      render(
        <ShareProvider>
          <TestDisplay />
          <TestActions
            onAction={(ctx) => {
              ctx.addPattern(createPattern(1))
            }}
          />
        </ShareProvider>
      )

      await act(async () => {
        await new Promise((r) => setTimeout(r, 0))
      })

      act(() => {
        screen.getByTestId('action').click()
      })

      await waitFor(() => {
        const stored = mockStorage.getItem('share-basket')
        expect(stored).toContain('"id":1')
      })
    })

    it('returns false when at max capacity', async () => {
      // Pre-populate with 10 patterns
      const patterns = Array.from({ length: 10 }, (_, i) => createPattern(i + 1))
      mockStorage.setItem('share-basket', JSON.stringify(patterns))

      let result: boolean

      render(
        <ShareProvider>
          <TestDisplay />
          <TestActions
            onAction={(ctx) => {
              result = ctx.addPattern(createPattern(11))
            }}
          />
        </ShareProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('10')
      })

      act(() => {
        screen.getByTestId('action').click()
      })

      expect(result!).toBe(false)
      expect(screen.getByTestId('count')).toHaveTextContent('10')
    })

    it('returns false when pattern already exists', async () => {
      // Pre-populate with pattern 1
      mockStorage.setItem('share-basket', JSON.stringify([createPattern(1)]))

      let result: boolean

      render(
        <ShareProvider>
          <TestDisplay />
          <TestActions
            onAction={(ctx) => {
              result = ctx.addPattern(createPattern(1))
            }}
          />
        </ShareProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('1')
      })

      act(() => {
        screen.getByTestId('action').click()
      })

      expect(result!).toBe(false)
      expect(screen.getByTestId('count')).toHaveTextContent('1')
    })
  })

  describe('removePattern', () => {
    it('removes a pattern by id', async () => {
      mockStorage.setItem('share-basket', JSON.stringify([
        createPattern(1),
        createPattern(2),
      ]))

      render(
        <ShareProvider>
          <TestDisplay />
          <TestActions
            onAction={(ctx) => {
              ctx.removePattern(1)
            }}
          />
        </ShareProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('2')
      })

      act(() => {
        screen.getByTestId('action').click()
      })

      expect(screen.getByTestId('count')).toHaveTextContent('1')
    })
  })

  describe('clearSelection', () => {
    it('removes all patterns', async () => {
      mockStorage.setItem('share-basket', JSON.stringify([
        createPattern(1),
        createPattern(2),
        createPattern(3),
      ]))

      render(
        <ShareProvider>
          <TestDisplay />
          <TestActions
            onAction={(ctx) => {
              ctx.clearSelection()
            }}
          />
        </ShareProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('3')
      })

      act(() => {
        screen.getByTestId('action').click()
      })

      expect(screen.getByTestId('count')).toHaveTextContent('0')
    })
  })

  describe('isSelected', () => {
    it('returns correct values', async () => {
      mockStorage.setItem('share-basket', JSON.stringify([createPattern(1)]))

      let isSelected1: boolean
      let isSelected999: boolean

      render(
        <ShareProvider>
          <TestDisplay />
          <TestActions
            onAction={(ctx) => {
              isSelected1 = ctx.isSelected(1)
              isSelected999 = ctx.isSelected(999)
            }}
          />
        </ShareProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('1')
      })

      act(() => {
        screen.getByTestId('action').click()
      })

      expect(isSelected1!).toBe(true)
      expect(isSelected999!).toBe(false)
    })
  })

  describe('canAddMore', () => {
    it('is true when under max capacity', async () => {
      const patterns = Array.from({ length: 9 }, (_, i) => createPattern(i + 1))
      mockStorage.setItem('share-basket', JSON.stringify(patterns))

      render(
        <ShareProvider>
          <TestDisplay />
        </ShareProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('9')
      })

      expect(screen.getByTestId('can-add-more')).toHaveTextContent('yes')
    })

    it('is false at max capacity', async () => {
      const patterns = Array.from({ length: 10 }, (_, i) => createPattern(i + 1))
      mockStorage.setItem('share-basket', JSON.stringify(patterns))

      render(
        <ShareProvider>
          <TestDisplay />
        </ShareProvider>
      )

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('10')
      })

      expect(screen.getByTestId('can-add-more')).toHaveTextContent('no')
    })
  })

  describe('localStorage error handling', () => {
    it('handles setItem error gracefully', async () => {
      render(
        <ShareProvider>
          <TestDisplay />
          <TestActions
            onAction={(ctx) => {
              ctx.addPattern(createPattern(1))
            }}
          />
        </ShareProvider>
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
        'Failed to save share basket to localStorage:',
        expect.any(Error)
      )
    })
  })
})
