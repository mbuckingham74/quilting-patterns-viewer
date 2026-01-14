import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

// Dedicated internal API secret - separate from service role key to reduce blast radius
// Falls back to service role key for backwards compatibility during transition
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY

// POST /api/admin/notify-signup - Send email notification to admins
// Called by OAuth callback (server-side with secret) or client-side signup (with session)
export async function POST(request: NextRequest) {
  try {
    // Check for internal secret header (server-to-server calls like OAuth callback)
    const authHeader = request.headers.get('x-internal-secret')
    const isInternalCall = INTERNAL_API_SECRET && authHeader === INTERNAL_API_SECRET

    if (!isInternalCall) {
      // For client-side calls, verify this is a legitimate new signup
      // by checking authenticated user was created within the last 5 minutes
      const supabase = await createServerClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const userCreatedAt = new Date(user.created_at).getTime()
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000

      if (userCreatedAt < fiveMinutesAgo) {
        // User account is too old - this isn't a new signup notification
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Skip if Resend API key is not configured
    const resendApiKey = process.env.RESEND_API_KEY
    if (!resendApiKey) {
      console.log('RESEND_API_KEY not configured, skipping email notification')
      return NextResponse.json({ success: true, skipped: true })
    }

    // Guard against missing service role key
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceRoleKey) {
      console.error('SUPABASE_SERVICE_ROLE_KEY not configured, cannot fetch admin emails')
      return NextResponse.json({ success: true, skipped: true, reason: 'missing_service_key' })
    }

    // Fetch admin emails from database using service role
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const { data: adminEmails } = await supabase
      .from('admin_emails')
      .select('email')

    if (!adminEmails || adminEmails.length === 0) {
      console.log('No admin emails found in database')
      return NextResponse.json({ success: true, skipped: true })
    }

    const adminEmailList = adminEmails.map(a => a.email)

    // Send email to all admin addresses
    const adminPanelUrl = 'https://patterns.tachyonfuture.com/admin/users'

    const emailBody = `
      <h2>New User Signup</h2>
      <p>A new user has signed up for the Quilting Patterns app and needs approval:</p>
      <p><strong>Email:</strong> ${email}</p>
      <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      <p>
        <a href="${adminPanelUrl}" style="display: inline-block; padding: 12px 24px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 8px; margin-top: 16px;">
          Review in Admin Panel
        </a>
      </p>
    `

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: 'Quilting Patterns <noreply@tachyonfuture.com>',
        to: adminEmailList,
        subject: `New Signup: ${email} - Quilting Patterns`,
        html: emailBody,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Failed to send email:', errorData)
      // Don't fail the request, just log the error
      return NextResponse.json({ success: true, emailSent: false })
    }

    return NextResponse.json({ success: true, emailSent: true })
  } catch (error) {
    console.error('Error in notify-signup:', error)
    // Don't fail - email is optional
    return NextResponse.json({ success: true, error: 'Email failed but continuing' })
  }
}
