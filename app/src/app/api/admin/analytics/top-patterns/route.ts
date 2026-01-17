import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseNoRowError, logError } from '@/lib/errors'
import { unauthorized, forbidden, internalError, serviceUnavailable, withErrorHandler } from '@/lib/api-response'

export const GET = withErrorHandler(async () => {
  const supabase = await createClient()

  // Check if user is authenticated and admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (profileError && !isSupabaseNoRowError(profileError)) {
    logError(profileError, { action: 'fetch_profile', userId: user.id })
    return internalError(profileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!profile?.is_admin) {
    return forbidden()
  }

  // Use RPC function for efficient SQL-based aggregation
  // This is much faster than loading all logs into memory
  const { data: topPatterns, error } = await supabase
    .rpc('get_top_downloaded_patterns', { p_limit: 10 })

  if (error) {
    logError(error, { action: 'fetch_top_patterns' })
    // PGRST202 = RPC function doesn't exist - migration needs to be run
    if (error.code === 'PGRST202') {
      return serviceUnavailable('Analytics RPC function not found. Run migration 027_performance_indexes.sql and 028_secure_analytics_rpcs.sql.')
    }
    return internalError(error, { action: 'fetch_top_patterns' })
  }

  // Map RPC result to expected format
  const patterns = (topPatterns || []).map((p: {
    pattern_id: number
    file_name: string
    thumbnail_url: string | null
    author: string | null
    download_count: number
    favorite_count: number
  }) => ({
    id: p.pattern_id,
    file_name: p.file_name,
    thumbnail_url: p.thumbnail_url,
    author: p.author,
    download_count: Number(p.download_count),
    favorite_count: Number(p.favorite_count),
  }))

  return NextResponse.json({ patterns })
})
