import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const RESEND_API_KEY = process.env.RESEND_API_KEY

interface RouteParams {
  params: Promise<{ token: string }>
}

interface Ranking {
  pattern_id: number
  rank: number
}

interface FeedbackRequest {
  rankings: Ranking[]
  customerName?: string
  notes?: string
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

// POST /api/shares/[token]/feedback - Submit ranking feedback (public, no auth required)
export async function POST(request: Request, { params }: RouteParams) {
  const { token } = await params

  if (!token || token.length !== 32) {
    return NextResponse.json({ error: 'Invalid share link' }, { status: 400 })
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  // Parse request body
  let body: FeedbackRequest
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { rankings, customerName, notes } = body

  // Validate rankings
  if (!rankings || !Array.isArray(rankings) || rankings.length === 0) {
    return NextResponse.json({ error: 'Rankings are required' }, { status: 400 })
  }

  // Validate each ranking has pattern_id and rank
  for (const r of rankings) {
    if (typeof r.pattern_id !== 'number' || typeof r.rank !== 'number') {
      return NextResponse.json({ error: 'Invalid ranking format' }, { status: 400 })
    }
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Get the share to verify it exists and isn't expired
  const { data: shareData, error: shareError } = await supabase
    .rpc('get_share_by_token', { share_token: token })
    .single()

  const share = shareData as ShareData | null

  if (shareError || !share) {
    return NextResponse.json({ error: 'Share not found or expired' }, { status: 404 })
  }

  // Check if expired
  if (new Date(share.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This share link has expired' }, { status: 410 })
  }

  // Check if feedback already submitted
  const { data: existingFeedback } = await supabase
    .from('shared_collection_feedback')
    .select('id')
    .eq('collection_id', share.id)
    .single()

  if (existingFeedback) {
    return NextResponse.json({ error: 'Feedback has already been submitted for this share' }, { status: 409 })
  }

  // Get the patterns in this share to validate rankings
  const { data: sharePatternsData } = await supabase
    .rpc('get_share_patterns_by_token', { share_token: token })

  const sharePatterns = (sharePatternsData || []) as SharePattern[]
  const validPatternIds = new Set(sharePatterns.map(p => p.pattern_id))

  // Verify all ranked patterns are in the share
  for (const r of rankings) {
    if (!validPatternIds.has(r.pattern_id)) {
      return NextResponse.json({ error: 'Invalid pattern in rankings' }, { status: 400 })
    }
  }

  // Submit feedback using SECURITY DEFINER function
  const { data: feedback, error: feedbackError } = await supabase
    .rpc('submit_share_feedback', {
      share_token: token,
      feedback_rankings: rankings,
      feedback_customer_name: customerName || null,
      feedback_notes: notes || null,
    })

  if (feedbackError) {
    console.error('Error submitting feedback:', feedbackError)
    return NextResponse.json({ error: 'Failed to submit feedback' }, { status: 500 })
  }

  // Send notification email to the share creator
  if (RESEND_API_KEY && share.creator_email) {
    try {
      // Get pattern names for the email
      const rankedPatterns = rankings
        .sort((a, b) => a.rank - b.rank)
        .map(r => {
          const pattern = sharePatterns.find(p => p.pattern_id === r.pattern_id)
          return pattern?.file_name || `Pattern #${r.pattern_id}`
        })

      const displayName = customerName || share.recipient_name || 'Your customer'

      const rankingsList = rankedPatterns
        .map((name, i) => `${i + 1}. ${name}`)
        .join('\n')

      const emailBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed;">Great news! ${displayName} ranked your shared patterns!</h2>

          <p>Here are their rankings (favorite to least favorite):</p>

          <ol style="background: #f5f5f4; padding: 20px 40px; border-radius: 8px;">
            ${rankedPatterns.map(name => `<li style="margin: 8px 0;">${name}</li>`).join('')}
          </ol>

          ${notes ? `
            <p style="margin-top: 24px;"><strong>Their notes:</strong></p>
            <p style="background: #f5f5f4; padding: 16px; border-radius: 8px; font-style: italic;">"${notes}"</p>
          ` : ''}

          <p style="margin-top: 24px;">
            <a href="https://patterns.tachyonfuture.com/account" style="display: inline-block; padding: 14px 28px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
              View in Your Account
            </a>
          </p>

          <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;">
          <p style="color: #a8a29e; font-size: 12px;">
            Pam's Custom Quilts
          </p>
        </div>
      `

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'Quilting Patterns <noreply@tachyonfuture.com>',
          to: [share.creator_email],
          subject: `${displayName} ranked your shared patterns!`,
          html: emailBody,
        }),
      })
    } catch (emailError) {
      console.error('Failed to send feedback notification email:', emailError)
      // Don't fail the request if email fails
    }
  }

  return NextResponse.json({
    success: true,
    message: 'Thank you! Your rankings have been submitted.',
  })
}
