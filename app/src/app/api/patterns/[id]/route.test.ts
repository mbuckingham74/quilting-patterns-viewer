/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

// Mock supabase
const mockSupabaseAuth = {
  getUser: vi.fn(),
}

const mockSupabaseFrom = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: mockSupabaseAuth,
      from: () => mockSupabaseFrom,
    })
  ),
}))

describe('GET /api/patterns/[id]', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' }
  const mockPattern = {
    id: 123,
    file_name: 'Test Pattern',
    file_extension: 'qli',
    file_size: 1024,
    author: 'Test Author',
    author_url: 'https://example.com',
    author_notes: 'Author notes',
    notes: 'Pattern notes',
    thumbnail_url: 'https://example.com/thumb.png',
    pattern_file_url: 'https://example.com/pattern.qli',
    created_at: '2025-01-01T00:00:00Z',
    pattern_keywords: [
      { keywords: { id: 1, value: 'floral' } },
      { keywords: { id: 2, value: 'geometric' } },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: mockUser },
      error: null,
    })
  })

  const createRequest = () => new NextRequest('http://localhost/api/patterns/123')
  const createContext = (id: string) => ({
    params: Promise.resolve({ id }),
  })

  describe('authentication', () => {
    it('returns 401 when user is not authenticated', async () => {
      mockSupabaseAuth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' },
      })

      const response = await GET(createRequest(), createContext('123'))

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Authentication required')
    })
  })

  describe('validation', () => {
    it('returns 400 for invalid pattern ID', async () => {
      const response = await GET(createRequest(), createContext('invalid'))

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid pattern ID')
    })

    it('returns 400 for negative pattern ID', async () => {
      const response = await GET(createRequest(), createContext('-1'))

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid pattern ID')
    })

    it('returns 400 for zero pattern ID', async () => {
      const response = await GET(createRequest(), createContext('0'))

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid pattern ID')
    })
  })

  describe('successful fetch', () => {
    it('returns pattern with keywords sorted alphabetically', async () => {
      mockSupabaseFrom.single.mockResolvedValue({
        data: mockPattern,
        error: null,
      })

      const response = await GET(createRequest(), createContext('123'))

      expect(response.status).toBe(200)
      const data = await response.json()

      expect(data.pattern.id).toBe(123)
      expect(data.pattern.file_name).toBe('Test Pattern')
      expect(data.pattern.keywords).toHaveLength(2)
      // Keywords should be sorted alphabetically
      expect(data.pattern.keywords[0].value).toBe('floral')
      expect(data.pattern.keywords[1].value).toBe('geometric')
    })

    it('excludes pattern_keywords from response', async () => {
      mockSupabaseFrom.single.mockResolvedValue({
        data: mockPattern,
        error: null,
      })

      const response = await GET(createRequest(), createContext('123'))
      const data = await response.json()

      expect(data.pattern.pattern_keywords).toBeUndefined()
    })

    it('handles patterns with no keywords', async () => {
      mockSupabaseFrom.single.mockResolvedValue({
        data: { ...mockPattern, pattern_keywords: [] },
        error: null,
      })

      const response = await GET(createRequest(), createContext('123'))
      const data = await response.json()

      expect(data.pattern.keywords).toEqual([])
    })

    it('filters out null keywords', async () => {
      mockSupabaseFrom.single.mockResolvedValue({
        data: {
          ...mockPattern,
          pattern_keywords: [
            { keywords: { id: 1, value: 'floral' } },
            { keywords: null },
            { keywords: { id: 2, value: 'geometric' } },
          ],
        },
        error: null,
      })

      const response = await GET(createRequest(), createContext('123'))
      const data = await response.json()

      expect(data.pattern.keywords).toHaveLength(2)
    })
  })

  describe('error handling', () => {
    it('returns 404 when pattern is not found', async () => {
      mockSupabaseFrom.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows returned' },
      })

      const response = await GET(createRequest(), createContext('999'))

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Pattern not found')
    })

    it('returns 404 when pattern data is null', async () => {
      mockSupabaseFrom.single.mockResolvedValue({
        data: null,
        error: null,
      })

      const response = await GET(createRequest(), createContext('123'))

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data.error).toBe('Pattern not found')
    })

    it('returns 500 for database errors', async () => {
      mockSupabaseFrom.single.mockResolvedValue({
        data: null,
        error: { code: 'INTERNAL', message: 'Database error' },
      })

      const response = await GET(createRequest(), createContext('123'))

      expect(response.status).toBe(500)
    })
  })
})
