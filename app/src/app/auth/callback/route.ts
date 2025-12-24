import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { ADMIN_EMAILS } from '@/lib/types'

// Allowlist of valid origins for OAuth redirects
const ALLOWED_ORIGINS = [
  'https://patterns.tachyonfuture.com',
  // Add localhost for development
  ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000'] : []),
]

const DEFAULT_ORIGIN = 'https://patterns.tachyonfuture.com'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next') ?? '/browse'

  // Validate 'next' parameter to prevent open redirects
  // Only allow relative paths starting with /
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/browse'

  // Validate and sanitize the origin
  // Use x-forwarded headers but validate against allowlist to prevent host-header spoofing
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  const requestedOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : null

  // Only use the requested origin if it's in our allowlist, otherwise use default
  const origin = requestedOrigin && ALLOWED_ORIGINS.includes(requestedOrigin)
    ? requestedOrigin
    : DEFAULT_ORIGIN

  // No code = error, but don't redirect to login to avoid loop
  if (!code) {
    return NextResponse.redirect(`${origin}/?error=no_code`)
  }

  // Create a mutable response - we'll update the redirect location later
  let redirectUrl = `${origin}${next}`

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // We'll set these on the final response
        },
      },
    }
  )

  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('Exchange code error:', error)
    return NextResponse.redirect(`${origin}/?error=auth_failed`)
  }

  const user = sessionData?.user
  if (!user) {
    return NextResponse.redirect(`${origin}/?error=no_user`)
  }

  // Check if profile exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, is_approved, is_admin')
    .eq('id', user.id)
    .single()

  let isApproved = existingProfile?.is_approved ?? false
  let isNewUser = false

  if (!existingProfile) {
    // New user - create profile
    isNewUser = true
    const userEmail = user.email?.toLowerCase() || ''
    const isAdmin = ADMIN_EMAILS.includes(userEmail)

    // Admins are auto-approved
    isApproved = isAdmin

    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        display_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        is_approved: isApproved,
        is_admin: isAdmin,
        approved_at: isApproved ? new Date().toISOString() : null,
      })

    if (insertError) {
      console.error('Error creating profile:', insertError)
      // Don't fail the login, but log the error
    }

    // Send admin notification for new non-admin users
    if (!isAdmin) {
      try {
        await fetch(`${origin}/api/admin/notify-signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: user.email }),
        })
      } catch (e) {
        console.error('Failed to send admin notification:', e)
      }
    }
  }

  // Redirect based on approval status
  if (!isApproved) {
    redirectUrl = `${origin}/pending-approval`
  }

  // Create the response with the correct redirect
  const response = NextResponse.redirect(redirectUrl)

  // Re-create supabase client to set cookies on the response
  const supabaseWithCookies = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              path: '/',
              sameSite: 'lax',
              secure: true,
            })
          })
        },
      },
    }
  )

  // Re-exchange to set cookies properly
  await supabaseWithCookies.auth.exchangeCodeForSession(code)

  return response
}
