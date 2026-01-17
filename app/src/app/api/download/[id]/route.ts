import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sanitizeFilenameForHeader } from '@/lib/filename'
import { isSupabaseNoRowError, logError } from '@/lib/errors'
import { unauthorized, badRequest, notFound, internalError, withErrorHandler } from '@/lib/api-response'

export const GET = withErrorHandler(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  const { id } = await params
  const patternId = parseInt(id, 10)

  if (isNaN(patternId)) {
    return badRequest('Invalid pattern ID')
  }

  const supabase = await createClient()

  // Check if user is authenticated
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return unauthorized('Authentication required to download patterns')
  }

  // Get pattern info
  const { data: pattern, error: patternError } = await supabase
    .from('patterns')
    .select('id, file_name, file_extension, pattern_file_url')
    .eq('id', patternId)
    .single()

  if (patternError) {
    if (isSupabaseNoRowError(patternError)) {
      return notFound('Pattern not found')
    }
    return internalError(patternError, { action: 'fetch_pattern', patternId })
  }

  if (!pattern) {
    return notFound('Pattern not found')
  }

  if (!pattern.pattern_file_url) {
    return notFound('Pattern file not available')
  }

  // Download from Supabase storage
  const { data: fileData, error: downloadError } = await supabase
    .storage
    .from('patterns')
    .download(pattern.pattern_file_url)

  if (downloadError || !fileData) {
    return internalError(downloadError ?? new Error('Download returned no data'), { action: 'download_pattern', patternId })
  }

  // Determine filename and sanitize for Content-Disposition header
  const rawFilename = pattern.file_name || `pattern-${pattern.id}.${pattern.file_extension || 'bin'}`
  const { contentDisposition } = sanitizeFilenameForHeader(rawFilename)

  // Log the download (non-blocking)
  supabase
    .from('download_logs')
    .insert({ user_id: user.id, pattern_id: patternId })
    .then(({ error }) => {
      if (error) logError(error, { action: 'log_download', patternId, userId: user.id })
    })

  // Return file with appropriate headers
  return new NextResponse(fileData, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': contentDisposition,
    },
  })
})
