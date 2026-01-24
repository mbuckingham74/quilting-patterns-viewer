import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  normalizeQuery,
  getCachedEmbedding,
  cacheEmbedding,
  getCacheStats,
  cleanupCache,
} from './query-embedding-cache'

// Mock the errors module
vi.mock('./errors', () => ({
  logError: vi.fn(),
  addErrorBreadcrumb: vi.fn(),
}))

// Create a mock Supabase client
function createMockSupabase(rpcResponses: Record<string, { data: unknown; error: unknown }>) {
  return {
    rpc: vi.fn((functionName: string) => {
      const response = rpcResponses[functionName] || { data: null, error: null }
      return Promise.resolve(response)
    }),
  }
}

describe('normalizeQuery', () => {
  it('converts to lowercase', () => {
    expect(normalizeQuery('FLOWERS')).toBe('flowers')
    expect(normalizeQuery('Butterflies')).toBe('butterflies')
  })

  it('trims whitespace', () => {
    expect(normalizeQuery('  flowers  ')).toBe('flowers')
    expect(normalizeQuery('\tbutterflies\n')).toBe('butterflies')
  })

  it('handles combined cases', () => {
    expect(normalizeQuery('  FLORAL Patterns  ')).toBe('floral patterns')
  })

  it('handles empty strings', () => {
    expect(normalizeQuery('')).toBe('')
    expect(normalizeQuery('   ')).toBe('')
  })
})

describe('getCachedEmbedding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns cached embedding on cache hit', async () => {
    const mockEmbedding = [0.1, 0.2, 0.3]
    const supabase = createMockSupabase({
      get_cached_query_embedding: { data: mockEmbedding, error: null },
    })

    const result = await getCachedEmbedding(supabase as never, 'flowers')

    expect(result).toEqual(mockEmbedding)
    expect(supabase.rpc).toHaveBeenCalledWith('get_cached_query_embedding', {
      p_query_text: 'flowers',
    })
  })

  it('returns null on cache miss', async () => {
    const supabase = createMockSupabase({
      get_cached_query_embedding: { data: null, error: null },
    })

    const result = await getCachedEmbedding(supabase as never, 'new query')

    expect(result).toBeNull()
  })

  it('normalizes query before lookup', async () => {
    const supabase = createMockSupabase({
      get_cached_query_embedding: { data: null, error: null },
    })

    await getCachedEmbedding(supabase as never, '  FLOWERS  ')

    expect(supabase.rpc).toHaveBeenCalledWith('get_cached_query_embedding', {
      p_query_text: 'flowers',
    })
  })

  it('returns null for empty query', async () => {
    const supabase = createMockSupabase({})

    const result = await getCachedEmbedding(supabase as never, '')

    expect(result).toBeNull()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns null for whitespace-only query', async () => {
    const supabase = createMockSupabase({})

    const result = await getCachedEmbedding(supabase as never, '   ')

    expect(result).toBeNull()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('returns null and logs error on RPC failure', async () => {
    const { logError } = await import('./errors')
    const supabase = createMockSupabase({
      get_cached_query_embedding: {
        data: null,
        error: { message: 'Database error' },
      },
    })

    const result = await getCachedEmbedding(supabase as never, 'flowers')

    expect(result).toBeNull()
    expect(logError).toHaveBeenCalledWith(
      { message: 'Database error' },
      expect.objectContaining({ action: 'get_cached_embedding' })
    )
  })

  it('returns null and logs error on exception', async () => {
    const { logError } = await import('./errors')
    const supabase = {
      rpc: vi.fn().mockRejectedValue(new Error('Network error')),
    }

    const result = await getCachedEmbedding(supabase as never, 'flowers')

    expect(result).toBeNull()
    expect(logError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ action: 'get_cached_embedding_exception' })
    )
  })
})

describe('cacheEmbedding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('caches embedding with normalized query', async () => {
    const supabase = createMockSupabase({
      cache_query_embedding: { data: null, error: null },
    })
    const embedding = [0.1, 0.2, 0.3]

    await cacheEmbedding(supabase as never, '  FLOWERS  ', embedding)

    expect(supabase.rpc).toHaveBeenCalledWith('cache_query_embedding', {
      p_query_text: 'flowers',
      p_embedding: embedding,
    })
  })

  it('does nothing for empty query', async () => {
    const supabase = createMockSupabase({})

    await cacheEmbedding(supabase as never, '', [0.1, 0.2])

    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('does nothing for whitespace-only query', async () => {
    const supabase = createMockSupabase({})

    await cacheEmbedding(supabase as never, '   ', [0.1, 0.2])

    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('does nothing for empty embedding', async () => {
    const supabase = createMockSupabase({})

    await cacheEmbedding(supabase as never, 'flowers', [])

    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('does nothing for null embedding', async () => {
    const supabase = createMockSupabase({})

    await cacheEmbedding(supabase as never, 'flowers', null as never)

    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('logs error but does not throw on RPC failure', async () => {
    const { logError } = await import('./errors')
    const supabase = createMockSupabase({
      cache_query_embedding: {
        data: null,
        error: { message: 'Database error' },
      },
    })

    // Should not throw
    await cacheEmbedding(supabase as never, 'flowers', [0.1, 0.2])

    expect(logError).toHaveBeenCalledWith(
      { message: 'Database error' },
      expect.objectContaining({ action: 'cache_embedding' })
    )
  })

  it('logs error but does not throw on exception', async () => {
    const { logError } = await import('./errors')
    const supabase = {
      rpc: vi.fn().mockRejectedValue(new Error('Network error')),
    }

    // Should not throw
    await cacheEmbedding(supabase as never, 'flowers', [0.1, 0.2])

    expect(logError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ action: 'cache_embedding_exception' })
    )
  })
})

describe('getCacheStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns cache statistics', async () => {
    const mockStats = {
      total_entries: 100,
      total_hits: 500,
      oldest_entry: '2026-01-01T00:00:00Z',
      newest_entry: '2026-01-24T12:00:00Z',
      avg_hits_per_query: 5,
    }
    const supabase = createMockSupabase({
      get_query_cache_stats: { data: [mockStats], error: null },
    })

    const result = await getCacheStats(supabase as never)

    expect(result).toEqual(mockStats)
  })

  it('handles single object response (not array)', async () => {
    const mockStats = {
      total_entries: 50,
      total_hits: 200,
      oldest_entry: null,
      newest_entry: null,
      avg_hits_per_query: 4,
    }
    const supabase = createMockSupabase({
      get_query_cache_stats: { data: mockStats, error: null },
    })

    const result = await getCacheStats(supabase as never)

    expect(result).toEqual(mockStats)
  })

  it('returns null on RPC error', async () => {
    const supabase = createMockSupabase({
      get_query_cache_stats: {
        data: null,
        error: { message: 'Database error' },
      },
    })

    const result = await getCacheStats(supabase as never)

    expect(result).toBeNull()
  })

  it('returns null on exception', async () => {
    const supabase = {
      rpc: vi.fn().mockRejectedValue(new Error('Network error')),
    }

    const result = await getCacheStats(supabase as never)

    expect(result).toBeNull()
  })
})

describe('cleanupCache', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns number of deleted entries', async () => {
    const supabase = createMockSupabase({
      cleanup_query_embedding_cache: { data: 15, error: null },
    })

    const result = await cleanupCache(supabase as never, 30)

    expect(result).toBe(15)
    expect(supabase.rpc).toHaveBeenCalledWith('cleanup_query_embedding_cache', {
      p_days_old: 30,
    })
  })

  it('uses default 30 days when not specified', async () => {
    const supabase = createMockSupabase({
      cleanup_query_embedding_cache: { data: 5, error: null },
    })

    await cleanupCache(supabase as never)

    expect(supabase.rpc).toHaveBeenCalledWith('cleanup_query_embedding_cache', {
      p_days_old: 30,
    })
  })

  it('returns null on RPC error', async () => {
    const { logError } = await import('./errors')
    const supabase = createMockSupabase({
      cleanup_query_embedding_cache: {
        data: null,
        error: { message: 'Permission denied' },
      },
    })

    const result = await cleanupCache(supabase as never, 30)

    expect(result).toBeNull()
    expect(logError).toHaveBeenCalled()
  })

  it('returns null on exception', async () => {
    const supabase = {
      rpc: vi.fn().mockRejectedValue(new Error('Network error')),
    }

    const result = await cleanupCache(supabase as never, 30)

    expect(result).toBeNull()
  })
})
