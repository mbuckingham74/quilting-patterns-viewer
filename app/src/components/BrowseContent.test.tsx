/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import BrowseContent from './BrowseContent'
import { Pattern } from '@/lib/types'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    toString: () => 'search=test&page=1',
  }),
}))

// Mock BrowseStateContext
const mockSaveBrowseState = vi.fn()
const mockMarkScrollRestored = vi.fn()
const mockRequestScrollRestore = vi.fn(() => false)
vi.mock('@/contexts/BrowseStateContext', () => ({
  useBrowseState: () => ({
    browseState: null,
    isHydrated: true,
    saveBrowseState: mockSaveBrowseState,
    clearBrowseState: vi.fn(),
    requestScrollRestore: mockRequestScrollRestore,
    markScrollRestored: mockMarkScrollRestored,
  }),
}))

// Mock child components
vi.mock('./PatternGrid', () => ({
  default: vi.fn(({ patterns, error, favoritePatternIds, onToggleFavorite, isAdmin, onBeforeNavigate }) => (
    <div data-testid="pattern-grid">
      <span data-testid="pattern-count">{patterns.length}</span>
      <span data-testid="error">{error || 'none'}</span>
      <span data-testid="favorite-count">{favoritePatternIds.size}</span>
      <span data-testid="is-admin">{isAdmin ? 'true' : 'false'}</span>
      {patterns.map((p: Pattern) => (
        <button
          key={p.id}
          data-testid={`toggle-favorite-${p.id}`}
          onClick={() => onToggleFavorite(p.id, !favoritePatternIds.has(p.id))}
        >
          Toggle {p.id}
        </button>
      ))}
      <button data-testid="before-navigate" onClick={onBeforeNavigate}>
        Navigate
      </button>
    </div>
  )),
}))

vi.mock('./Pagination', () => ({
  default: vi.fn(({ currentPage, totalPages, totalCount }) => (
    <div data-testid="pagination">
      <span data-testid="current-page">{currentPage}</span>
      <span data-testid="total-pages">{totalPages}</span>
      <span data-testid="total-count">{totalCount}</span>
    </div>
  )),
}))

describe('BrowseContent', () => {
  const mockPatterns: Pattern[] = [
    {
      id: 1,
      file_name: 'butterfly.qli',
      file_extension: 'qli',
      author: 'Jane Doe',
      thumbnail_url: 'https://example.com/1.png',
    },
    {
      id: 2,
      file_name: 'flower.qli',
      file_extension: 'qli',
      author: 'John Smith',
      thumbnail_url: 'https://example.com/2.png',
    },
    {
      id: 3,
      file_name: 'geometric.qli',
      file_extension: 'qli',
      author: null,
      thumbnail_url: null,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockSaveBrowseState.mockClear()
    mockMarkScrollRestored.mockClear()
    mockRequestScrollRestore.mockClear()
    mockRequestScrollRestore.mockReturnValue(false)
  })

  describe('rendering', () => {
    it('renders PatternGrid with patterns', () => {
      render(
        <BrowseContent
          patterns={mockPatterns}
          error={null}
          currentPage={1}
          totalPages={5}
          totalCount={100}
          initialFavoriteIds={[]}
        />
      )

      expect(screen.getByTestId('pattern-grid')).toBeInTheDocument()
      expect(screen.getByTestId('pattern-count')).toHaveTextContent('3')
    })

    it('renders Pagination with correct props', () => {
      render(
        <BrowseContent
          patterns={mockPatterns}
          error={null}
          currentPage={3}
          totalPages={10}
          totalCount={250}
          initialFavoriteIds={[]}
        />
      )

      expect(screen.getByTestId('pagination')).toBeInTheDocument()
      expect(screen.getByTestId('current-page')).toHaveTextContent('3')
      expect(screen.getByTestId('total-pages')).toHaveTextContent('10')
      expect(screen.getByTestId('total-count')).toHaveTextContent('250')
    })

    it('passes error to PatternGrid', () => {
      render(
        <BrowseContent
          patterns={[]}
          error="Failed to load patterns"
          currentPage={1}
          totalPages={0}
          totalCount={0}
          initialFavoriteIds={[]}
        />
      )

      expect(screen.getByTestId('error')).toHaveTextContent('Failed to load patterns')
    })

    it('renders empty patterns array', () => {
      render(
        <BrowseContent
          patterns={[]}
          error={null}
          currentPage={1}
          totalPages={0}
          totalCount={0}
          initialFavoriteIds={[]}
        />
      )

      expect(screen.getByTestId('pattern-count')).toHaveTextContent('0')
    })
  })

  describe('favorites', () => {
    it('initializes favorites from initialFavoriteIds', () => {
      render(
        <BrowseContent
          patterns={mockPatterns}
          error={null}
          currentPage={1}
          totalPages={5}
          totalCount={100}
          initialFavoriteIds={[1, 2]}
        />
      )

      expect(screen.getByTestId('favorite-count')).toHaveTextContent('2')
    })

    it('adds pattern to favorites when toggled on', async () => {
      render(
        <BrowseContent
          patterns={mockPatterns}
          error={null}
          currentPage={1}
          totalPages={5}
          totalCount={100}
          initialFavoriteIds={[1]}
        />
      )

      expect(screen.getByTestId('favorite-count')).toHaveTextContent('1')

      // Toggle favorite for pattern 2 (not currently favorited)
      await act(async () => {
        screen.getByTestId('toggle-favorite-2').click()
      })

      // Should now have 2 favorites
      expect(screen.getByTestId('favorite-count')).toHaveTextContent('2')
    })

    it('removes pattern from favorites when toggled off', async () => {
      render(
        <BrowseContent
          patterns={mockPatterns}
          error={null}
          currentPage={1}
          totalPages={5}
          totalCount={100}
          initialFavoriteIds={[1, 2]}
        />
      )

      expect(screen.getByTestId('favorite-count')).toHaveTextContent('2')

      // Toggle favorite for pattern 1 (currently favorited)
      await act(async () => {
        screen.getByTestId('toggle-favorite-1').click()
      })

      // Should now have 1 favorite
      expect(screen.getByTestId('favorite-count')).toHaveTextContent('1')
    })

    it('updates favorites when initialFavoriteIds changes', () => {
      const { rerender } = render(
        <BrowseContent
          patterns={mockPatterns}
          error={null}
          currentPage={1}
          totalPages={5}
          totalCount={100}
          initialFavoriteIds={[1]}
        />
      )

      expect(screen.getByTestId('favorite-count')).toHaveTextContent('1')

      // Simulate navigation that changes initialFavoriteIds
      rerender(
        <BrowseContent
          patterns={mockPatterns}
          error={null}
          currentPage={2}
          totalPages={5}
          totalCount={100}
          initialFavoriteIds={[1, 2, 3]}
        />
      )

      expect(screen.getByTestId('favorite-count')).toHaveTextContent('3')
    })

    it('handles empty initialFavoriteIds', () => {
      render(
        <BrowseContent
          patterns={mockPatterns}
          error={null}
          currentPage={1}
          totalPages={5}
          totalCount={100}
          initialFavoriteIds={[]}
        />
      )

      expect(screen.getByTestId('favorite-count')).toHaveTextContent('0')
    })

    it('handles toggling same pattern multiple times', async () => {
      render(
        <BrowseContent
          patterns={mockPatterns}
          error={null}
          currentPage={1}
          totalPages={5}
          totalCount={100}
          initialFavoriteIds={[]}
        />
      )

      expect(screen.getByTestId('favorite-count')).toHaveTextContent('0')

      // Add to favorites
      await act(async () => {
        screen.getByTestId('toggle-favorite-1').click()
      })
      expect(screen.getByTestId('favorite-count')).toHaveTextContent('1')

      // Remove from favorites
      await act(async () => {
        screen.getByTestId('toggle-favorite-1').click()
      })
      expect(screen.getByTestId('favorite-count')).toHaveTextContent('0')

      // Add again
      await act(async () => {
        screen.getByTestId('toggle-favorite-1').click()
      })
      expect(screen.getByTestId('favorite-count')).toHaveTextContent('1')
    })
  })

  describe('admin mode', () => {
    it('passes isAdmin false by default', () => {
      render(
        <BrowseContent
          patterns={mockPatterns}
          error={null}
          currentPage={1}
          totalPages={5}
          totalCount={100}
          initialFavoriteIds={[]}
        />
      )

      expect(screen.getByTestId('is-admin')).toHaveTextContent('false')
    })

    it('passes isAdmin true when specified', () => {
      render(
        <BrowseContent
          patterns={mockPatterns}
          error={null}
          currentPage={1}
          totalPages={5}
          totalCount={100}
          initialFavoriteIds={[]}
          isAdmin={true}
        />
      )

      expect(screen.getByTestId('is-admin')).toHaveTextContent('true')
    })

    it('passes isAdmin false when explicitly set', () => {
      render(
        <BrowseContent
          patterns={mockPatterns}
          error={null}
          currentPage={1}
          totalPages={5}
          totalCount={100}
          initialFavoriteIds={[]}
          isAdmin={false}
        />
      )

      expect(screen.getByTestId('is-admin')).toHaveTextContent('false')
    })
  })

  describe('edge cases', () => {
    it('handles large number of patterns', () => {
      const manyPatterns = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        file_name: `pattern${i + 1}.qli`,
        file_extension: 'qli',
        author: `Author ${i + 1}`,
        thumbnail_url: `https://example.com/${i + 1}.png`,
      }))

      render(
        <BrowseContent
          patterns={manyPatterns}
          error={null}
          currentPage={1}
          totalPages={10}
          totalCount={1000}
          initialFavoriteIds={[1, 50, 100]}
        />
      )

      expect(screen.getByTestId('pattern-count')).toHaveTextContent('100')
      expect(screen.getByTestId('favorite-count')).toHaveTextContent('3')
    })

    it('handles patterns with all null fields', () => {
      const nullPatterns: Pattern[] = [
        {
          id: 1,
          file_name: null,
          file_extension: null,
          author: null,
          thumbnail_url: null,
        },
      ]

      render(
        <BrowseContent
          patterns={nullPatterns}
          error={null}
          currentPage={1}
          totalPages={1}
          totalCount={1}
          initialFavoriteIds={[]}
        />
      )

      expect(screen.getByTestId('pattern-count')).toHaveTextContent('1')
    })

    it('handles page 0 edge case', () => {
      render(
        <BrowseContent
          patterns={[]}
          error={null}
          currentPage={0}
          totalPages={0}
          totalCount={0}
          initialFavoriteIds={[]}
        />
      )

      expect(screen.getByTestId('current-page')).toHaveTextContent('0')
    })

    it('handles very large favorite ids', () => {
      render(
        <BrowseContent
          patterns={mockPatterns}
          error={null}
          currentPage={1}
          totalPages={5}
          totalCount={100}
          initialFavoriteIds={[999999, 1000000]}
        />
      )

      // Favorites should be tracked even if not in current patterns
      expect(screen.getByTestId('favorite-count')).toHaveTextContent('2')
    })
  })

  describe('browse state', () => {
    it('calls saveBrowseState when onBeforeNavigate is called', async () => {
      // Mock window.scrollY
      Object.defineProperty(window, 'scrollY', { value: 500, writable: true })

      render(
        <BrowseContent
          patterns={mockPatterns}
          error={null}
          currentPage={1}
          totalPages={5}
          totalCount={100}
          initialFavoriteIds={[]}
        />
      )

      await act(async () => {
        screen.getByTestId('before-navigate').click()
      })

      expect(mockSaveBrowseState).toHaveBeenCalledWith('?search=test&page=1', 500)
    })

    it('saves current search params before navigation', async () => {
      Object.defineProperty(window, 'scrollY', { value: 0, writable: true })

      render(
        <BrowseContent
          patterns={mockPatterns}
          error={null}
          currentPage={1}
          totalPages={5}
          totalCount={100}
          initialFavoriteIds={[]}
        />
      )

      await act(async () => {
        screen.getByTestId('before-navigate').click()
      })

      expect(mockSaveBrowseState).toHaveBeenCalledTimes(1)
      expect(mockSaveBrowseState).toHaveBeenCalledWith(expect.any(String), expect.any(Number))
    })
  })
})

