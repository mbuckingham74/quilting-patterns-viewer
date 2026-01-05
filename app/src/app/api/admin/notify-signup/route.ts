import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// POST /api/admin/notify-signup - Send email notification to admins
export async function POST(request: NextRequest) {
  try {
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
