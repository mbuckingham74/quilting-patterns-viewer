import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/keywords - Get all keywords (for dropdown selection)
export async function GET() {
  const supabase = await createClient()

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Fetch all keywords ordered alphabetically
  const { data: keywords, error } = await supabase
    .from('keywords')
    .select('id, value')
    .order('value', { ascending: true })

  if (error) {
    console.error('Error fetching keywords:', error)
    return NextResponse.json(
      { error: 'Failed to fetch keywords', details: error.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ keywords })
}
