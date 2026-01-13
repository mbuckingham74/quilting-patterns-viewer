import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/admin/upload-logs - Fetch recent upload logs
export async function GET(request: NextRequest) {
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

  // Get query params
  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)
  const offset = parseInt(searchParams.get('offset') || '0')

  // Fetch upload logs with uploader info
  const { data: logs, error, count } = await supabase
    .from('upload_logs')
    .select(`
      id,
      zip_filename,
      uploaded_by,
      uploaded_at,
      total_patterns,
      uploaded_count,
      skipped_count,
      error_count,
      uploaded_patterns,
      skipped_patterns,
      error_patterns
    `, { count: 'exact' })
    .order('uploaded_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error('Error fetching upload logs:', error)
    return NextResponse.json({ error: 'Failed to fetch upload logs' }, { status: 500 })
  }

  // Get uploader names
  const uploaderIds = [...new Set(logs?.map(l => l.uploaded_by).filter(Boolean))]
  let uploaderNames: Record<string, string> = {}

  if (uploaderIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, display_name')
      .in('id', uploaderIds)

    if (profiles) {
      uploaderNames = Object.fromEntries(
        profiles.map(p => [p.id, p.display_name || p.email || 'Unknown'])
      )
    }
  }

  // Enrich logs with uploader names
  const enrichedLogs = logs?.map(log => ({
    ...log,
    uploader_name: log.uploaded_by ? uploaderNames[log.uploaded_by] || 'Unknown' : 'Unknown'
  }))

  return NextResponse.json({
    logs: enrichedLogs,
    total: count,
    limit,
    offset
  })
}
