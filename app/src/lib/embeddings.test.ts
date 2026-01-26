import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'

// Mock the Supabase service client
vi.mock('./supabase/server', () => ({
  createServiceClient: vi.fn(),
}))

// Mock global fetch
const mockFetch = vi.fn()

beforeAll(() => {
  vi.stubGlobal('fetch', mockFetch)
})

afterAll(() => {
  vi.unstubAllGlobals()
})

import { createServiceClient } from './supabase/server'
import { generateEmbeddingsForPatterns, generateEmbeddingsForBatch } from './embeddings'

const mockCreateServiceClient = vi.mocked(createServiceClient)

describe('embeddings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  // Helper to create a properly chaining Supabase mock
  function createChainableMock(resolveValue: { data: unknown; error: unknown }) {
    const chainable: Record<string, unknown> = {}
    const methods = ['select', 'is', 'not', 'order', 'limit', 'in', 'eq']

    methods.forEach((method) => {
      chainable[method] = vi.fn().mockReturnValue(chainable)
    })

    // The final await should resolve to our value
    // Make the mock thenable
    chainable.then = (resolve: (value: unknown) => void) => {
      resolve(resolveValue)
      return Promise.resolve(resolveValue)
    }

    return chainable
  }

  describe('generateEmbeddingsForPatterns', () => {
    it('returns early with zero counts when VOYAGE_API_KEY is not set', async () => {
      const originalKey = process.env.VOYAGE_API_KEY
      delete process.env.VOYAGE_API_KEY

      const result = await generateEmbeddingsForPatterns()

      expect(result).toEqual({ processed: 0, errors: 0 })
      expect(console.error).toHaveBeenCalledWith(
        'VOYAGE_API_KEY not configured - skipping embedding generation'
      )

      if (originalKey) process.env.VOYAGE_API_KEY = originalKey
    })

    it('returns zero counts when no patterns need embeddings', async () => {
      const originalKey = process.env.VOYAGE_API_KEY
      process.env.VOYAGE_API_KEY = 'test-api-key'

      const chainable = createChainableMock({ data: [], error: null })
      mockCreateServiceClient.mockReturnValue({
        from: vi.fn().mockReturnValue(chainable),
      } as unknown as ReturnType<typeof createServiceClient>)

      const result = await generateEmbeddingsForPatterns()

      expect(result).toEqual({ processed: 0, errors: 0 })
      expect(console.log).toHaveBeenCalledWith('No patterns need embeddings')

      if (originalKey === undefined) {
        delete process.env.VOYAGE_API_KEY
      } else {
        process.env.VOYAGE_API_KEY = originalKey
      }
    })

    it('returns zero counts when fetch patterns fails', async () => {
      const originalKey = process.env.VOYAGE_API_KEY
      process.env.VOYAGE_API_KEY = 'test-api-key'

      const chainable = createChainableMock({
        data: null,
        error: new Error('Database error'),
      })
      mockCreateServiceClient.mockReturnValue({
        from: vi.fn().mockReturnValue(chainable),
      } as unknown as ReturnType<typeof createServiceClient>)

      const result = await generateEmbeddingsForPatterns()

      expect(result).toEqual({ processed: 0, errors: 0 })
      expect(console.error).toHaveBeenCalledWith('Error fetching patterns:', expect.any(Error))

      if (originalKey === undefined) {
        delete process.env.VOYAGE_API_KEY
      } else {
        process.env.VOYAGE_API_KEY = originalKey
      }
    })

    it('successfully generates embeddings for patterns', async () => {
      const originalKey = process.env.VOYAGE_API_KEY
      process.env.VOYAGE_API_KEY = 'test-api-key'

      const patterns = [
        { id: 1, thumbnail_url: 'https://example.com/thumb1.png' },
        { id: 2, thumbnail_url: 'https://example.com/thumb2.png' },
      ]

      const selectChainable = createChainableMock({ data: patterns, error: null })
      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

      mockCreateServiceClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(selectChainable),
          update: mockUpdate,
        }),
      } as unknown as ReturnType<typeof createServiceClient>)

      // Mock successful image download and Voyage API
      const imageBuffer = Buffer.from('fake-image-data')
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('example.com')) {
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(imageBuffer),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [{ embedding: new Array(1024).fill(0.1) }],
              usage: { total_tokens: 1000 },
            }),
        })
      })

      const result = await generateEmbeddingsForPatterns()

      expect(result).toEqual({ processed: 2, errors: 0 })
      expect(mockUpdate).toHaveBeenCalledTimes(2)

      if (originalKey === undefined) {
        delete process.env.VOYAGE_API_KEY
      } else {
        process.env.VOYAGE_API_KEY = originalKey
      }
    })

    it('counts errors when thumbnail download fails', async () => {
      const originalKey = process.env.VOYAGE_API_KEY
      process.env.VOYAGE_API_KEY = 'test-api-key'

      const patterns = [{ id: 1, thumbnail_url: 'https://example.com/thumb1.png' }]
      const selectChainable = createChainableMock({ data: patterns, error: null })

      mockCreateServiceClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(selectChainable),
          update: vi.fn(),
        }),
      } as unknown as ReturnType<typeof createServiceClient>)

      // Mock failed image download
      mockFetch.mockResolvedValue({ ok: false })

      const result = await generateEmbeddingsForPatterns()

      expect(result).toEqual({ processed: 0, errors: 1 })
      expect(console.error).toHaveBeenCalledWith(
        'Failed to download thumbnail for pattern 1'
      )

      if (originalKey === undefined) {
        delete process.env.VOYAGE_API_KEY
      } else {
        process.env.VOYAGE_API_KEY = originalKey
      }
    })

    it('counts errors when Voyage API returns error', async () => {
      const originalKey = process.env.VOYAGE_API_KEY
      process.env.VOYAGE_API_KEY = 'test-api-key'

      const patterns = [{ id: 1, thumbnail_url: 'https://example.com/thumb1.png' }]
      const selectChainable = createChainableMock({ data: patterns, error: null })

      mockCreateServiceClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(selectChainable),
          update: vi.fn(),
        }),
      } as unknown as ReturnType<typeof createServiceClient>)

      // Mock successful image download but failed Voyage API
      const imageBuffer = Buffer.from('fake-image-data')
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('example.com')) {
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(imageBuffer),
          })
        }
        return Promise.resolve({
          ok: false,
          text: () => Promise.resolve('Rate limit exceeded'),
        })
      })

      const result = await generateEmbeddingsForPatterns()

      expect(result).toEqual({ processed: 0, errors: 1 })
      expect(console.error).toHaveBeenCalledWith('Voyage API error:', 'Rate limit exceeded')
      expect(console.error).toHaveBeenCalledWith(
        'Failed to generate embedding for pattern 1'
      )

      if (originalKey === undefined) {
        delete process.env.VOYAGE_API_KEY
      } else {
        process.env.VOYAGE_API_KEY = originalKey
      }
    })

    it('counts errors when database update fails', async () => {
      const originalKey = process.env.VOYAGE_API_KEY
      process.env.VOYAGE_API_KEY = 'test-api-key'

      const patterns = [{ id: 1, thumbnail_url: 'https://example.com/thumb1.png' }]
      const selectChainable = createChainableMock({ data: patterns, error: null })

      const mockUpdateEq = vi.fn().mockResolvedValue({ error: new Error('Update failed') })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

      mockCreateServiceClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(selectChainable),
          update: mockUpdate,
        }),
      } as unknown as ReturnType<typeof createServiceClient>)

      // Mock successful image download and Voyage API
      const imageBuffer = Buffer.from('fake-image-data')
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('example.com')) {
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(imageBuffer),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [{ embedding: new Array(1024).fill(0.1) }],
            }),
        })
      })

      const result = await generateEmbeddingsForPatterns()

      expect(result).toEqual({ processed: 0, errors: 1 })
      expect(console.error).toHaveBeenCalledWith(
        'Failed to save embedding for pattern 1:',
        expect.any(Error)
      )

      if (originalKey === undefined) {
        delete process.env.VOYAGE_API_KEY
      } else {
        process.env.VOYAGE_API_KEY = originalKey
      }
    })

    it('skips patterns with null thumbnail_url', async () => {
      const originalKey = process.env.VOYAGE_API_KEY
      process.env.VOYAGE_API_KEY = 'test-api-key'

      const patterns = [
        { id: 1, thumbnail_url: null },
        { id: 2, thumbnail_url: 'https://example.com/thumb2.png' },
      ]
      const selectChainable = createChainableMock({ data: patterns, error: null })

      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

      mockCreateServiceClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(selectChainable),
          update: mockUpdate,
        }),
      } as unknown as ReturnType<typeof createServiceClient>)

      // Mock successful image download and Voyage API
      const imageBuffer = Buffer.from('fake-image-data')
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('example.com')) {
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(imageBuffer),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [{ embedding: new Array(1024).fill(0.1) }],
            }),
        })
      })

      const result = await generateEmbeddingsForPatterns()

      // Only pattern 2 should be processed (pattern 1 has null thumbnail)
      expect(result).toEqual({ processed: 1, errors: 0 })
      expect(mockUpdate).toHaveBeenCalledTimes(1)

      if (originalKey === undefined) {
        delete process.env.VOYAGE_API_KEY
      } else {
        process.env.VOYAGE_API_KEY = originalKey
      }
    })

    it('filters by specific pattern IDs when provided', async () => {
      const originalKey = process.env.VOYAGE_API_KEY
      process.env.VOYAGE_API_KEY = 'test-api-key'

      const patterns = [{ id: 5, thumbnail_url: 'https://example.com/thumb5.png' }]

      const mockIn = vi.fn()
      const selectChainable = createChainableMock({ data: patterns, error: null })
      selectChainable.in = mockIn.mockReturnValue(selectChainable)

      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

      mockCreateServiceClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(selectChainable),
          update: mockUpdate,
        }),
      } as unknown as ReturnType<typeof createServiceClient>)

      // Mock successful image download and Voyage API
      const imageBuffer = Buffer.from('fake-image-data')
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('example.com')) {
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(imageBuffer),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [{ embedding: new Array(1024).fill(0.1) }],
            }),
        })
      })

      const result = await generateEmbeddingsForPatterns([5, 10, 15])

      expect(result).toEqual({ processed: 1, errors: 0 })
      expect(mockIn).toHaveBeenCalledWith('id', [5, 10, 15])

      if (originalKey === undefined) {
        delete process.env.VOYAGE_API_KEY
      } else {
        process.env.VOYAGE_API_KEY = originalKey
      }
    })

    it('handles network errors during image download gracefully', async () => {
      const originalKey = process.env.VOYAGE_API_KEY
      process.env.VOYAGE_API_KEY = 'test-api-key'

      const patterns = [{ id: 1, thumbnail_url: 'https://example.com/thumb1.png' }]
      const selectChainable = createChainableMock({ data: patterns, error: null })

      mockCreateServiceClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(selectChainable),
          update: vi.fn(),
        }),
      } as unknown as ReturnType<typeof createServiceClient>)

      // Mock network error during image download
      mockFetch.mockRejectedValue(new Error('Network error'))

      const result = await generateEmbeddingsForPatterns()

      expect(result).toEqual({ processed: 0, errors: 1 })
      expect(console.error).toHaveBeenCalledWith('Error downloading image:', expect.any(Error))

      if (originalKey === undefined) {
        delete process.env.VOYAGE_API_KEY
      } else {
        process.env.VOYAGE_API_KEY = originalKey
      }
    })

    it('handles Voyage API network errors gracefully', async () => {
      const originalKey = process.env.VOYAGE_API_KEY
      process.env.VOYAGE_API_KEY = 'test-api-key'

      const patterns = [{ id: 1, thumbnail_url: 'https://example.com/thumb1.png' }]
      const selectChainable = createChainableMock({ data: patterns, error: null })

      mockCreateServiceClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(selectChainable),
          update: vi.fn(),
        }),
      } as unknown as ReturnType<typeof createServiceClient>)

      // Mock successful image download but network error on Voyage API
      const imageBuffer = Buffer.from('fake-image-data')
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('example.com')) {
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(imageBuffer),
          })
        }
        return Promise.reject(new Error('Voyage API network error'))
      })

      const result = await generateEmbeddingsForPatterns()

      expect(result).toEqual({ processed: 0, errors: 1 })
      expect(console.error).toHaveBeenCalledWith(
        'Error generating embedding:',
        expect.any(Error)
      )

      if (originalKey === undefined) {
        delete process.env.VOYAGE_API_KEY
      } else {
        process.env.VOYAGE_API_KEY = originalKey
      }
    })

    it('handles empty embedding response from Voyage API', async () => {
      const originalKey = process.env.VOYAGE_API_KEY
      process.env.VOYAGE_API_KEY = 'test-api-key'

      const patterns = [{ id: 1, thumbnail_url: 'https://example.com/thumb1.png' }]
      const selectChainable = createChainableMock({ data: patterns, error: null })

      mockCreateServiceClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(selectChainable),
          update: vi.fn(),
        }),
      } as unknown as ReturnType<typeof createServiceClient>)

      // Mock successful image download but empty embedding response
      const imageBuffer = Buffer.from('fake-image-data')
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('example.com')) {
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(imageBuffer),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: [] }), // Empty data array
        })
      })

      const result = await generateEmbeddingsForPatterns()

      expect(result).toEqual({ processed: 0, errors: 1 })
      expect(console.error).toHaveBeenCalledWith(
        'Failed to generate embedding for pattern 1'
      )

      if (originalKey === undefined) {
        delete process.env.VOYAGE_API_KEY
      } else {
        process.env.VOYAGE_API_KEY = originalKey
      }
    })

    it('logs progress during embedding generation', async () => {
      const originalKey = process.env.VOYAGE_API_KEY
      process.env.VOYAGE_API_KEY = 'test-api-key'

      const patterns = [{ id: 1, thumbnail_url: 'https://example.com/thumb1.png' }]
      const selectChainable = createChainableMock({ data: patterns, error: null })

      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq })

      mockCreateServiceClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(selectChainable),
          update: mockUpdate,
        }),
      } as unknown as ReturnType<typeof createServiceClient>)

      // Mock successful image download and Voyage API
      const imageBuffer = Buffer.from('fake-image-data')
      mockFetch.mockImplementation((url: string) => {
        if (url.includes('example.com')) {
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(imageBuffer),
          })
        }
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              data: [{ embedding: new Array(1024).fill(0.1) }],
            }),
        })
      })

      await generateEmbeddingsForPatterns()

      expect(console.log).toHaveBeenCalledWith('Generating embeddings for 1 patterns...')
      expect(console.log).toHaveBeenCalledWith('Generated embedding for pattern 1 (1/1)')
      expect(console.log).toHaveBeenCalledWith(
        'Embedding generation complete: 1 processed, 0 errors'
      )

      if (originalKey === undefined) {
        delete process.env.VOYAGE_API_KEY
      } else {
        process.env.VOYAGE_API_KEY = originalKey
      }
    })
  })

  describe('generateEmbeddingsForBatch', () => {
    it('returns early when no patterns in batch need embeddings', async () => {
      const selectChainable = createChainableMock({ data: [], error: null })

      mockCreateServiceClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(selectChainable),
        }),
      } as unknown as ReturnType<typeof createServiceClient>)

      await generateEmbeddingsForBatch(123)

      expect(console.log).toHaveBeenCalledWith(
        'No patterns need embeddings in batch 123'
      )
    })

    it('returns early when fetch fails', async () => {
      const selectChainable = createChainableMock({
        data: null,
        error: new Error('Fetch failed'),
      })

      mockCreateServiceClient.mockReturnValue({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue(selectChainable),
        }),
      } as unknown as ReturnType<typeof createServiceClient>)

      await generateEmbeddingsForBatch(123)

      expect(console.log).toHaveBeenCalledWith(
        'No patterns need embeddings in batch 123'
      )
    })

    it('calls generateEmbeddingsForPatterns with batch pattern IDs', async () => {
      const originalKey = process.env.VOYAGE_API_KEY
      process.env.VOYAGE_API_KEY = 'test-api-key'

      const batchPatterns = [{ id: 10 }, { id: 20 }, { id: 30 }]

      // First call: batch query returns patterns
      // Second call: generateEmbeddingsForPatterns query returns empty (no more patterns to process)
      let callCount = 0
      const mockFrom = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // First call: batch query
          const chainable = createChainableMock({ data: batchPatterns, error: null })
          return { select: vi.fn().mockReturnValue(chainable) }
        }
        // Subsequent calls: from generateEmbeddingsForPatterns - return empty
        const chainable = createChainableMock({ data: [], error: null })
        return {
          select: vi.fn().mockReturnValue(chainable),
          update: vi.fn(),
        }
      })

      mockCreateServiceClient.mockReturnValue({
        from: mockFrom,
      } as unknown as ReturnType<typeof createServiceClient>)

      await generateEmbeddingsForBatch(456)

      expect(console.log).toHaveBeenCalledWith(
        'Generating embeddings for 3 patterns in batch 456'
      )

      if (originalKey === undefined) {
        delete process.env.VOYAGE_API_KEY
      } else {
        process.env.VOYAGE_API_KEY = originalKey
      }
    })
  })
})
