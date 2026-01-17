import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { badRequest, notFound, expired, internalError, withErrorHandler } from '@/lib/api-response'
import { isSupabaseNoRowError, logError } from '@/lib/errors'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

interface RouteParams {
  params: Promise<{ token: string }>
}

interface ShareData {
  id: string
  token: string
  created_by: string
  creator_email: string | null
  creator_name: string | null
  recipient_email: string
  recipient_name: string | null
  message: string | null
  expires_at: string
  created_at: string
  has_feedback: boolean
}

interface SharePattern {
  pattern_id: number
  position: number
  file_name: string
  thumbnail_url: string | null
  author: string | null
}

// GET /api/shares/[token] - Get a share by token (public, no auth required)
export const GET = withErrorHandler(async (request: Request, { params }: RouteParams) => {
  const { token } = await params

  if (!token || token.length !== 32) {
    return badRequest('Invalid share link')
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return internalError(new Error('Missing Supabase configuration'), { action: 'get_share' })
  }

  // Use service client to bypass RLS (this is a public endpoint)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Get the share using the SECURITY DEFINER function
  const { data: shareData, error: shareError } = await supabase
    .rpc('get_share_by_token', { share_token: token })
    .single()

  const share = shareData as ShareData | null

  if (shareError) {
    logError(shareError, { action: 'get_share_by_token', token: token.substring(0, 8) + '...' })
    return internalError(shareError, { action: 'get_share_by_token' })
  }

  if (!share) {
    return notFound('Share not found or expired')
  }

  // Check if expired
  if (new Date(share.expires_at) < new Date()) {
    return expired('This share link has expired')
  }

  // Get the patterns using the SECURITY DEFINER function
  const { data: rawPatterns, error: patternsError } = await supabase
    .rpc('get_share_patterns_by_token', { share_token: token })

  if (patternsError) {
    return internalError(patternsError, { action: 'get_share_patterns' })
  }

  // Transform to include id field (function returns pattern_id)
  const sharePatterns = (rawPatterns || []) as SharePattern[]
  const patterns = sharePatterns.map(p => ({
    id: p.pattern_id,
    position: p.position,
    file_name: p.file_name,
    thumbnail_url: p.thumbnail_url,
    author: p.author,
  }))

  // Check if feedback already submitted
  const { data: feedback, error: feedbackError } = await supabase
    .from('shared_collection_feedback')
    .select('id, submitted_at')
    .eq('collection_id', share.id)
    .single()

  if (feedbackError && !isSupabaseNoRowError(feedbackError)) {
    return internalError(feedbackError, { action: 'fetch_share_feedback', shareId: share.id })
  }

  return NextResponse.json({
    share: {
      id: share.id,
      senderName: share.creator_name || 'Someone',
      recipientName: share.recipient_name,
      message: share.message,
      expiresAt: share.expires_at,
      createdAt: share.created_at,
    },
    patterns: patterns,
    feedbackSubmitted: !!feedback,
    feedbackDate: feedback?.submitted_at || null,
  })
})
