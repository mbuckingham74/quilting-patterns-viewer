/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

// Mock Supabase
const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockRpc = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
    rpc: mockRpc,
  })),
}))

// Mock logError to prevent console output
vi.mock('@/lib/errors', () => ({
  ErrorCode: {
    AUTH_REQUIRED: 'AUTH_REQUIRED',
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    NOT_FOUND: 'NOT_FOUND',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  ErrorMessages: {
    AUTH_REQUIRED: 'Authentication required',
    VALIDATION_FAILED: 'Validation failed',
    NOT_FOUND: 'Not found',
    INTERNAL_ERROR: 'Internal error',
  },
  logError: vi.fn(),
}))

describe('GET /api/patterns/[id]/similar', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' }

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null })
  })

  const createRequest = (patternId: string, params = '') => {
    const url = `http://localhost/api/patterns/${patternId}/similar${params ? `?${params}` : ''}`
    return new NextRequest(url)
  }

  const createContext = (id: string) => ({
    params: Promise.resolve({ id }),
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null })

    const response = await GET(createRequest('123'), createContext('123'))
    expect(response.status).toBe(401)

    const body = await response.json()
    expect(body.error).toContain('Authentication')
  })

  it('returns 400 for invalid pattern ID', async () => {
    const response = await GET(createRequest('invalid'), createContext('invalid'))
    expect(response.status).toBe(400)

    const body = await response.json()
    expect(body.error).toContain('Invalid pattern ID')
  })

  it('returns 400 for negative pattern ID', async () => {
    const response = await GET(createRequest('-1'), createContext('-1'))
    expect(response.status).toBe(400)
  })

  it('returns 404 when pattern not found', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        }),
      }),
    })

    const response = await GET(createRequest('999'), createContext('999'))
    expect(response.status).toBe(404)

    const body = await response.json()
    expect(body.error).toContain('Pattern not found')
  })

  it('returns empty array when pattern has no embedding', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 123, embedding: null },
            error: null,
          }),
        }),
      }),
    })

    const response = await GET(createRequest('123'), createContext('123'))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.patterns).toEqual([])
    expect(body.message).toContain('no embedding')
  })

  it('returns similar patterns successfully', async () => {
    const mockEmbedding = [0.1, 0.2, 0.3]
    const mockSimilarPatterns = [
      { id: 123, file_name: 'current.qli', similarity: 1.0 },
      { id: 456, file_name: 'similar1.qli', file_extension: 'qli', author: 'Jane', thumbnail_url: 'url1', similarity: 0.85 },
      { id: 789, file_name: 'similar2.qli', file_extension: 'qli', author: 'John', thumbnail_url: 'url2', similarity: 0.75 },
    ]

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 123, embedding: mockEmbedding },
            error: null,
          }),
        }),
      }),
    })

    mockRpc.mockResolvedValue({
      data: mockSimilarPatterns,
      error: null,
    })

    const response = await GET(createRequest('123'), createContext('123'))
    expect(response.status).toBe(200)

    const body = await response.json()
    expect(body.patterns).toHaveLength(2) // Excludes current pattern (id 123)
    expect(body.patterns[0].id).toBe(456)
    expect(body.patterns[1].id).toBe(789)
    expect(body.patternId).toBe(123)
    expect(body.count).toBe(2)
  })

  it('filters out the current pattern from results', async () => {
    const mockEmbedding = [0.1, 0.2, 0.3]
    const mockSimilarPatterns = [
      { id: 100, file_name: 'current.qli', similarity: 1.0 },
      { id: 200, file_name: 'similar.qli', similarity: 0.9 },
    ]

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 100, embedding: mockEmbedding },
            error: null,
          }),
        }),
      }),
    })

    mockRpc.mockResolvedValue({
      data: mockSimilarPatterns,
      error: null,
    })

    const response = await GET(createRequest('100'), createContext('100'))
    const body = await response.json()

    expect(body.patterns).toHaveLength(1)
    expect(body.patterns[0].id).toBe(200)
  })

  it('respects limit parameter', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 1, embedding: [0.1] },
            error: null,
          }),
        }),
      }),
    })

    mockRpc.mockResolvedValue({ data: [], error: null })

    await GET(createRequest('1', 'limit=10'), createContext('1'))

    expect(mockRpc).toHaveBeenCalledWith(
      'search_patterns_semantic',
      expect.objectContaining({
        match_count: 11, // limit + 1 to filter out self
      })
    )
  })

  it('respects threshold parameter', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 1, embedding: [0.1] },
            error: null,
          }),
        }),
      }),
    })

    mockRpc.mockResolvedValue({ data: [], error: null })

    await GET(createRequest('1', 'threshold=0.8'), createContext('1'))

    expect(mockRpc).toHaveBeenCalledWith(
      'search_patterns_semantic',
      expect.objectContaining({
        match_threshold: 0.8,
      })
    )
  })

  it('clamps limit to max 20', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 1, embedding: [0.1] },
            error: null,
          }),
        }),
      }),
    })

    mockRpc.mockResolvedValue({ data: [], error: null })

    await GET(createRequest('1', 'limit=100'), createContext('1'))

    expect(mockRpc).toHaveBeenCalledWith(
      'search_patterns_semantic',
      expect.objectContaining({
        match_count: 21, // max 20 + 1
      })
    )
  })

  it('clamps threshold to valid range', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 1, embedding: [0.1] },
            error: null,
          }),
        }),
      }),
    })

    mockRpc.mockResolvedValue({ data: [], error: null })

    // Test threshold too low
    await GET(createRequest('1', 'threshold=0.1'), createContext('1'))
    expect(mockRpc).toHaveBeenCalledWith(
      'search_patterns_semantic',
      expect.objectContaining({
        match_threshold: 0.3, // clamped to min
      })
    )

    mockRpc.mockClear()

    // Test threshold too high
    await GET(createRequest('1', 'threshold=0.99'), createContext('1'))
    expect(mockRpc).toHaveBeenCalledWith(
      'search_patterns_semantic',
      expect.objectContaining({
        match_threshold: 0.95, // clamped to max
      })
    )
  })

  it('rounds similarity scores to 2 decimal places', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 1, embedding: [0.1] },
            error: null,
          }),
        }),
      }),
    })

    mockRpc.mockResolvedValue({
      data: [
        { id: 2, file_name: 'test.qli', similarity: 0.87654321 },
      ],
      error: null,
    })

    const response = await GET(createRequest('1'), createContext('1'))
    const body = await response.json()

    expect(body.patterns[0].similarity).toBe(0.88)
  })

  it('returns 500 when RPC fails', async () => {
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 1, embedding: [0.1] },
            error: null,
          }),
        }),
      }),
    })

    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    })

    const response = await GET(createRequest('1'), createContext('1'))
    expect(response.status).toBe(500)
  })
})
