import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/admin/batches/[id]/cancel - Cancel batch (delete all patterns)
export async function POST(
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

  const serviceClient = createServiceClient()

  // Verify batch exists and is staged
  const { data: batch, error: batchError } = await serviceClient
    .from('upload_logs')
    .select('id, status')
    .eq('id', batchId)
    .single()

  if (batchError || !batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  if (batch.status !== 'staged') {
    return NextResponse.json(
      { error: `Cannot cancel batch that is already ${batch.status}` },
      { status: 400 }
    )
  }

  // Get all patterns in batch to delete their storage files
  const { data: patterns } = await serviceClient
    .from('patterns')
    .select('id, thumbnail_url, pattern_file_url')
    .eq('upload_batch_id', batchId)

  // Delete storage files
  if (patterns && patterns.length > 0) {
    const thumbnailPaths = patterns
      .filter(p => p.thumbnail_url)
      .map(p => `${p.id}.png`)

    const patternPaths = patterns
      .filter(p => p.pattern_file_url)
      .map(p => p.pattern_file_url!)

    // Delete thumbnails
    if (thumbnailPaths.length > 0) {
      const { error: thumbError } = await serviceClient.storage
        .from('thumbnails')
        .remove(thumbnailPaths)
      if (thumbError) {
        console.warn('Error deleting thumbnails:', thumbError)
      }
    }

    // Delete pattern files
    if (patternPaths.length > 0) {
      const { error: patternError } = await serviceClient.storage
        .from('patterns')
        .remove(patternPaths)
      if (patternError) {
        console.warn('Error deleting pattern files:', patternError)
      }
    }
  }

  // Delete all patterns in batch (CASCADE will handle pattern_keywords)
  const { error: deleteError, count: deletedCount } = await serviceClient
    .from('patterns')
    .delete()
    .eq('upload_batch_id', batchId)

  if (deleteError) {
    console.error('Error deleting patterns:', deleteError)
    return NextResponse.json({ error: 'Failed to delete patterns' }, { status: 500 })
  }

  // Delete the upload_log record entirely (cancelled uploads have no value to keep)
  const { error: deleteLogError } = await serviceClient
    .from('upload_logs')
    .delete()
    .eq('id', batchId)

  if (deleteLogError) {
    console.error('Error deleting upload log:', deleteLogError)
  }

  return NextResponse.json({
    success: true,
    message: `Cancelled batch and deleted ${deletedCount || 0} patterns`,
    batch_id: batchId,
  })
}
