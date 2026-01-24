/**
 * Query Embedding Cache
 *
 * Caches Voyage AI query embeddings in the database to reduce API calls and latency.
 * Popular queries like "flowers", "borders", "stars" get instant results after first search.
 *
 * Benefits:
 * - Saves ~$0.00012 per cached query (Voyage AI pricing)
 * - Reduces latency by ~200ms for cached queries
 * - Persists across server restarts
 * - Shared across all instances if scaled
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { logError, addErrorBreadcrumb } from './errors'

export interface QueryCacheStats {
  total_entries: number
  total_hits: number
  oldest_entry: string | null
  newest_entry: string | null
  avg_hits_per_query: number
}

/**
 * Normalize a query for cache lookup.
 * Ensures consistent cache keys regardless of casing or whitespace.
 */
export function normalizeQuery(query: string): string {
  return query.toLowerCase().trim()
}

/**
 * Get a cached embedding for a query.
 * Returns null if not found or on error.
 *
 * @param supabase - Supabase client (user or service role)
 * @param query - The search query text
 * @returns The cached embedding vector, or null if not found
 */
export async function getCachedEmbedding(
  supabase: SupabaseClient,
  query: string
): Promise<number[] | null> {
  const normalizedQuery = normalizeQuery(query)

  if (!normalizedQuery) {
    return null
  }

  try {
    addErrorBreadcrumb('Checking query embedding cache', 'cache', { query: normalizedQuery })

    const { data, error } = await supabase.rpc('get_cached_query_embedding', {
      p_query_text: normalizedQuery,
    })

    if (error) {
      // Log but don't throw - cache miss is not fatal
      logError(error, {
        action: 'get_cached_embedding',
        query: normalizedQuery,
      })
      return null
    }

    // data is the embedding vector or null
    if (data) {
      addErrorBreadcrumb('Cache hit', 'cache', { query: normalizedQuery })
      return data as number[]
    }

    addErrorBreadcrumb('Cache miss', 'cache', { query: normalizedQuery })
    return null
  } catch (error) {
    // Swallow errors - cache is optional optimization
    logError(error, {
      action: 'get_cached_embedding_exception',
      query: normalizedQuery,
    })
    return null
  }
}

/**
 * Cache an embedding for a query.
 * Fails silently on error - caching is an optimization, not critical path.
 *
 * @param supabase - Supabase client (user or service role)
 * @param query - The search query text
 * @param embedding - The embedding vector from Voyage AI
 */
export async function cacheEmbedding(
  supabase: SupabaseClient,
  query: string,
  embedding: number[]
): Promise<void> {
  const normalizedQuery = normalizeQuery(query)

  if (!normalizedQuery || !embedding || embedding.length === 0) {
    return
  }

  try {
    addErrorBreadcrumb('Caching query embedding', 'cache', { query: normalizedQuery })

    const { error } = await supabase.rpc('cache_query_embedding', {
      p_query_text: normalizedQuery,
      p_embedding: embedding,
    })

    if (error) {
      // Log but don't throw - cache write failure is not fatal
      logError(error, {
        action: 'cache_embedding',
        query: normalizedQuery,
      })
    }
  } catch (error) {
    // Swallow errors - caching is optional optimization
    logError(error, {
      action: 'cache_embedding_exception',
      query: normalizedQuery,
    })
  }
}

/**
 * Get cache statistics for monitoring.
 *
 * @param supabase - Supabase client
 * @returns Cache statistics or null on error
 */
export async function getCacheStats(
  supabase: SupabaseClient
): Promise<QueryCacheStats | null> {
  try {
    const { data, error } = await supabase.rpc('get_query_cache_stats')

    if (error) {
      logError(error, { action: 'get_cache_stats' })
      return null
    }

    // RPC returns array with single row
    return (Array.isArray(data) ? data[0] : data) as QueryCacheStats
  } catch (error) {
    logError(error, { action: 'get_cache_stats_exception' })
    return null
  }
}

/**
 * Clean up stale cache entries.
 * Should be called periodically (e.g., daily cron job or admin action).
 *
 * @param supabase - Supabase client with service role
 * @param daysOld - Remove entries not used in this many days (default 30)
 * @returns Number of entries deleted, or null on error
 */
export async function cleanupCache(
  supabase: SupabaseClient,
  daysOld: number = 30
): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('cleanup_query_embedding_cache', {
      p_days_old: daysOld,
    })

    if (error) {
      logError(error, { action: 'cleanup_cache', daysOld })
      return null
    }

    return data as number
  } catch (error) {
    logError(error, { action: 'cleanup_cache_exception', daysOld })
    return null
  }
}
