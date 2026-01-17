import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { isSupabaseNoRowError, logError } from '@/lib/errors'
import { unauthorized, forbidden, badRequest, internalError, withErrorHandler } from '@/lib/api-response'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

interface CreateShareRequest {
  recipientEmail: string
  recipientName?: string
  message?: string
  patternIds: number[]
}

// POST /api/shares - Create a new share
export const POST = withErrorHandler(async (request: Request) => {
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  // Check if user is approved
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('is_approved, display_name, email')
    .eq('id', user.id)
    .single()

  if (profileError && !isSupabaseNoRowError(profileError)) {
    logError(profileError, { action: 'fetch_profile', userId: user.id })
    return internalError(profileError, { action: 'fetch_profile', userId: user.id })
  }

  if (!profile?.is_approved) {
    return forbidden('Account not approved')
  }

  // Parse request body
  let body: CreateShareRequest
  try {
    body = await request.json()
  } catch {
    return badRequest('Invalid JSON in request body')
  }

  const { recipientEmail, recipientName, message, patternIds } = body

  // Validate input
  if (!recipientEmail || !patternIds || !Array.isArray(patternIds)) {
    return badRequest('Missing required fields')
  }

  if (patternIds.length === 0 || patternIds.length > 10) {
    return badRequest('Must share between 1 and 10 patterns')
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(recipientEmail)) {
    return badRequest('Invalid email address')
  }

  // Verify all pattern IDs exist
  const { data: patterns, error: patternsError } = await supabase
    .from('patterns')
    .select('id, file_name, thumbnail_url')
    .in('id', patternIds)

  if (patternsError || !patterns || patterns.length !== patternIds.length) {
    return badRequest('One or more patterns not found')
  }

  // Create the share using service role (to bypass RLS for insert)
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return internalError(new Error('Missing SUPABASE_SERVICE_ROLE_KEY'), { action: 'create_service_client' })
  }

  const serviceClient = createServiceClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

  // Create the shared collection
  const { data: share, error: shareError } = await serviceClient
    .from('shared_collections')
    .insert({
      created_by: user.id,
      recipient_email: recipientEmail,
      recipient_name: recipientName || null,
      message: message || null,
    })
    .select('id, token, expires_at')
    .single()

  if (shareError || !share) {
    return internalError(shareError ?? new Error('Share insert returned no data'), {
      action: 'create_share',
      userId: user.id,
    })
  }

  // Add patterns to the share
  const patternInserts = patternIds.map((patternId, index) => ({
    collection_id: share.id,
    pattern_id: patternId,
    position: index + 1,
  }))

  const { error: patternError } = await serviceClient
    .from('shared_collection_patterns')
    .insert(patternInserts)

  if (patternError) {
    logError(patternError, { action: 'add_share_patterns', shareId: share.id })
    // Clean up the share
    await serviceClient.from('shared_collections').delete().eq('id', share.id)
    return internalError(patternError, { action: 'add_share_patterns', shareId: share.id })
  }

  const shareUrl = `https://patterns.tachyonfuture.com/share/${share.token}`
  const senderName = profile.display_name || profile.email || 'Someone'

  // Send email to recipient
  if (RESEND_API_KEY) {
    try {
      const patternList = patterns.map(p => p.file_name).join(', ')
      const expiresDate = new Date(share.expires_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })

      const emailBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed;">${senderName} shared some quilting patterns with you!</h2>
          ${recipientName ? `<p>Hi ${recipientName},</p>` : ''}
          ${message ? `<p style="background: #f5f5f4; padding: 16px; border-radius: 8px; font-style: italic;">"${message}"</p>` : ''}
          <p>${senderName} wants to share ${patternIds.length} quilting pattern${patternIds.length > 1 ? 's' : ''} with you.</p>
          <p style="margin-top: 24px;">
            <a href="${shareUrl}" style="display: inline-block; padding: 14px 28px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 8px; font-weight: 500;">
              View Patterns & Rank Your Favorites
            </a>
          </p>
          <p style="color: #78716c; font-size: 14px; margin-top: 24px;">
            This link expires on ${expiresDate}.
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
          to: [recipientEmail],
          subject: `${senderName} shared some quilting patterns with you`,
          html: emailBody,
        }),
      })
    } catch (emailError) {
      logError(emailError, { action: 'send_share_email', shareId: share.id })
      // Don't fail the request if email fails
    }
  }

  return NextResponse.json({
    success: true,
    token: share.token,
    shareUrl,
    expiresAt: share.expires_at,
  })
})

// GET /api/shares - List user's shares
export const GET = withErrorHandler(async () => {
  const supabase = await createClient()

  // Check authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return unauthorized()
  }

  // Get user's shares with pattern count and feedback status
  const { data: shares, error } = await supabase
    .from('shared_collections')
    .select(`
      id,
      token,
      recipient_email,
      recipient_name,
      message,
      expires_at,
      created_at,
      shared_collection_patterns(count),
      shared_collection_feedback(id, customer_name, submitted_at)
    `)
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return internalError(error, { action: 'fetch_shares', userId: user.id })
  }

  // Transform the data
  const transformedShares = shares?.map(share => ({
    id: share.id,
    token: share.token,
    recipientEmail: share.recipient_email,
    recipientName: share.recipient_name,
    message: share.message,
    expiresAt: share.expires_at,
    createdAt: share.created_at,
    patternCount: (share.shared_collection_patterns as unknown as { count: number }[])?.[0]?.count || 0,
    feedback: share.shared_collection_feedback?.[0] || null,
    isExpired: new Date(share.expires_at) < new Date(),
  })) || []

  return NextResponse.json({ shares: transformedShares })
})
