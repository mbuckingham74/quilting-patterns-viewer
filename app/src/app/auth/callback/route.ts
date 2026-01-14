import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

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
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const forwardedProto = request.headers.get('x-forwarded-proto') || 'https'
  const requestedOrigin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : null

  const origin = requestedOrigin && ALLOWED_ORIGINS.includes(requestedOrigin)
    ? requestedOrigin
    : DEFAULT_ORIGIN

  // Log cookies received for debugging (development only to avoid exposing sensitive data)
  const allCookies = request.cookies.getAll()
  const hasVerifier = allCookies.some(c => c.name.includes('code-verifier'))
  if (process.env.NODE_ENV === 'development') {
    console.log('Callback received cookies:', allCookies.map(c => c.name).join(', '))
    console.log('Has PKCE verifier cookie:', hasVerifier)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=no_code`)
  }

  // Create response first - we'll set cookies on it
  let redirectUrl = `${origin}${next}`
  const response = NextResponse.redirect(redirectUrl)

  const cookiesToSetLater: Array<{ name: string; value: string; options: Record<string, unknown> }> = []

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Setting cookies:', cookiesToSet.map(c => c.name).join(', '))
          }
          cookiesToSet.forEach(({ name, value, options }) => {
            cookiesToSetLater.push({ name, value, options: options || {} })
          })
        },
      },
    }
  )

  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)

  // Apply all cookies that were set during the exchange
  cookiesToSetLater.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, {
      ...options,
      path: '/',
      sameSite: 'lax',
      secure: true,
    })
  })
  if (process.env.NODE_ENV === 'development') {
    console.log('Applied cookies to response:', cookiesToSetLater.map(c => c.name).join(', '))
  }

  if (error) {
    console.error('Exchange code error:', error)
    return NextResponse.redirect(`${origin}/?error=auth_failed`)
  }

  const user = sessionData?.user
  if (!user) {
    return NextResponse.redirect(`${origin}/?error=no_user`)
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('User authenticated:', user.email)
  }

  // Check if profile exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, is_approved, is_admin')
    .eq('id', user.id)
    .single()

  let isApproved = existingProfile?.is_approved ?? false

  if (!existingProfile) {
    // New user - create profile with safe defaults
    // Database trigger handles admin detection server-side
    const { error: insertError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        display_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        is_approved: false,
        is_admin: false,
      })

    if (insertError) {
      console.error('Error creating profile:', insertError)
    }

    // Re-fetch profile to get trigger-updated values
    const { data: newProfile } = await supabase
      .from('profiles')
      .select('is_approved, is_admin')
      .eq('id', user.id)
      .single()

    isApproved = newProfile?.is_approved ?? false

    // Send admin notification for new non-admin users
    if (!newProfile?.is_admin) {
      try {
        await fetch(`${origin}/api/admin/notify-signup`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Use dedicated internal secret, fall back to service role key for compatibility
            'x-internal-secret': process.env.INTERNAL_API_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
          },
          body: JSON.stringify({ email: user.email }),
        })
      } catch (e) {
        console.error('Failed to send admin notification:', e)
      }
    }
  }

  // Redirect based on approval status
  if (!isApproved) {
    // Update the redirect location for pending users
    response.headers.set('Location', `${origin}/pending-approval`)
  }

  return response
}
