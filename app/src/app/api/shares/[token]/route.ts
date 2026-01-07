import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
export async function GET(request: Request, { params }: RouteParams) {
  const { token } = await params

  if (!token || token.length !== 32) {
    return NextResponse.json({ error: 'Invalid share link' }, { status: 400 })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // Use service client to bypass RLS (this is a public endpoint)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Get the share using the SECURITY DEFINER function
  const { data: shareData, error: shareError } = await supabase
    .rpc('get_share_by_token', { share_token: token })
    .single()

  const share = shareData as ShareData | null

  if (shareError || !share) {
    console.error('Error fetching share:', shareError)
    return NextResponse.json({ error: 'Share not found or expired' }, { status: 404 })
  }

  // Check if expired
  if (new Date(share.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This share link has expired' }, { status: 410 })
  }

  // Get the patterns using the SECURITY DEFINER function
  const { data: rawPatterns, error: patternsError } = await supabase
    .rpc('get_share_patterns_by_token', { share_token: token })

  if (patternsError) {
    console.error('Error fetching patterns:', patternsError)
    return NextResponse.json({ error: 'Failed to load patterns' }, { status: 500 })
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
  const { data: feedback } = await supabase
    .from('shared_collection_feedback')
    .select('id, submitted_at')
    .eq('collection_id', share.id)
    .single()

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
}
