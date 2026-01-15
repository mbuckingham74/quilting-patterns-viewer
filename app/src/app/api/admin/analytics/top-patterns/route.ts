import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()

  // Check if user is authenticated and admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Use RPC function for efficient SQL-based aggregation
  // This is much faster than loading all logs into memory
  const { data: topPatterns, error } = await supabase
    .rpc('get_top_downloaded_patterns', { p_limit: 10 })

  if (error) {
    console.error('Error fetching top patterns:', error)
    // Fallback to basic query if RPC not available yet
    if (error.code === 'PGRST202') {
      // RPC function doesn't exist, return empty for now
      return NextResponse.json({ patterns: [] })
    }
    return NextResponse.json({ error: 'Failed to fetch pattern data' }, { status: 500 })
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
}
