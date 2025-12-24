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

  // Create response first so we can set cookies on it
  const response = NextResponse.redirect(`${origin}${next}`)

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Use NextRequest's cookies API which properly parses cookies
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Ensure cookies are set with proper options for the domain
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

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('Exchange code error:', error)
    return NextResponse.redirect(`${origin}/?error=auth_failed`)
  }

  return response
}
