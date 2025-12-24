import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_EMAILS } from '@/lib/types'

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
        to: ADMIN_EMAILS,
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
