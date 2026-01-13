import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/admin/batches/[id] - Get batch details with all patterns
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const batchId = parseInt(id, 10)

  if (isNaN(batchId)) {
    return NextResponse.json({ error: 'Invalid batch ID' }, { status: 400 })
  }

  const supabase = await createClient()

  // Check if current user is admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!adminProfile?.is_admin) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  // Use service client to bypass RLS and get all patterns including staged
  const serviceClient = createServiceClient()

  // Get batch info
  const { data: batch, error: batchError } = await serviceClient
    .from('upload_logs')
    .select('*')
    .eq('id', batchId)
    .single()

  if (batchError || !batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  // Get all patterns in this batch
  const { data: patterns, error: patternsError } = await serviceClient
    .from('patterns')
    .select(`
      id,
      file_name,
      file_extension,
      file_size,
      author,
      author_url,
      author_notes,
      notes,
      thumbnail_url,
      pattern_file_url,
      is_staged,
      created_at
    `)
    .eq('upload_batch_id', batchId)
    .order('file_name', { ascending: true })

  if (patternsError) {
    console.error('Error fetching patterns:', patternsError)
    return NextResponse.json({ error: 'Failed to fetch patterns' }, { status: 500 })
  }

  // Get keywords for each pattern
  const patternIds = patterns?.map(p => p.id) || []
  let patternKeywords: Record<number, Array<{ id: number; value: string }>> = {}

  if (patternIds.length > 0) {
    const { data: keywords } = await serviceClient
      .from('pattern_keywords')
      .select('pattern_id, keywords(id, value)')
      .in('pattern_id', patternIds)

    if (keywords) {
      for (const pk of keywords) {
        if (!patternKeywords[pk.pattern_id]) {
          patternKeywords[pk.pattern_id] = []
        }
        if (pk.keywords) {
          // Supabase returns nested select as object, not array
          const kw = pk.keywords as unknown as { id: number; value: string }
          patternKeywords[pk.pattern_id].push(kw)
        }
      }
    }
  }

  // Merge keywords into patterns
  const patternsWithKeywords = patterns?.map(p => ({
    ...p,
    keywords: patternKeywords[p.id] || [],
  })) || []

  return NextResponse.json({
    batch,
    patterns: patternsWithKeywords,
  })
}

// POST /api/admin/batches/[id]/commit - Commit batch (make patterns visible)
// POST /api/admin/batches/[id]/cancel - Cancel batch (delete all patterns)
// These are handled by separate route files in commit/ and cancel/ subdirectories
