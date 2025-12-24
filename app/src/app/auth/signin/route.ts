import { NextResponse, type NextRequest } from 'next/server'
import { headers } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const headersList = await headers()
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'patterns.tachyonfuture.com'
  const protocol = headersList.get('x-forwarded-proto') || 'https'
  const origin = `${protocol}://${host}`

  // Create a response that we'll set cookies on
  const response = NextResponse.redirect(origin) // Temporary, will be replaced

  const supabase = createServerClient(
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

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })

  if (error || !data.url) {
    console.error('OAuth initiation error:', error)
    return NextResponse.redirect(`${origin}/?error=oauth_init_failed`)
  }

  // Create a new redirect response to Google, but copy our cookies to it
  const googleRedirect = NextResponse.redirect(data.url)

  // Copy all cookies from our initial response to the Google redirect
  response.cookies.getAll().forEach(cookie => {
    googleRedirect.cookies.set(cookie.name, cookie.value, {
      path: '/',
      sameSite: 'lax',
      secure: true,
      httpOnly: true,
    })
  })

  return googleRedirect
}
