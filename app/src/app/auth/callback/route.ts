import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/browse'

  // Get the origin from headers (handles reverse proxy correctly)
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'patterns.tachyonfuture.com'
  const protocol = headersList.get('x-forwarded-proto') || 'https'
  const origin = `${protocol}://${host}`

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
