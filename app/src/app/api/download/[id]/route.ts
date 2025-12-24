import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeFilenameForHeader } from '@/lib/filename'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const patternId = parseInt(id, 10)

  if (isNaN(patternId)) {
    return NextResponse.json({ error: 'Invalid pattern ID' }, { status: 400 })
  }

  const supabase = await createClient()

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json(
      { error: 'Authentication required to download patterns' },
      { status: 401 }
    )
  }

  // Get pattern info
  const { data: pattern, error: patternError } = await supabase
    .from('patterns')
    .select('id, file_name, file_extension, pattern_file_url')
    .eq('id', patternId)
    .single()

  if (patternError || !pattern) {
    return NextResponse.json({ error: 'Pattern not found' }, { status: 404 })
  }

  if (!pattern.pattern_file_url) {
    return NextResponse.json({ error: 'Pattern file not available' }, { status: 404 })
  }

  // Download from Supabase storage
  const { data: fileData, error: downloadError } = await supabase
    .storage
    .from('patterns')
    .download(pattern.pattern_file_url)

  if (downloadError || !fileData) {
    console.error('Download error:', downloadError)
    return NextResponse.json({ error: 'Failed to download pattern file' }, { status: 500 })
  }

  // Determine filename and sanitize for Content-Disposition header
  const rawFilename = pattern.file_name || `pattern-${pattern.id}.${pattern.file_extension || 'bin'}`
  const { contentDisposition } = sanitizeFilenameForHeader(rawFilename)

  // Return file with appropriate headers
  return new NextResponse(fileData, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': contentDisposition,
    },
  })
}
