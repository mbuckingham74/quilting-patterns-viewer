'use server'

import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { headers } from 'next/headers'

export async function signInWithGoogle() {
  const cookieStore = await cookies()
  const headersList = await headers()

  // Get the origin from headers (handles reverse proxy correctly)
  const host = headersList.get('x-forwarded-host') || headersList.get('host') || 'patterns.tachyonfuture.com'
  const protocol = headersList.get('x-forwarded-proto') || 'https'
  const origin = `${protocol}://${host}`

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, {
                ...options,
                path: '/',
                sameSite: 'lax',
                secure: true,
              })
            })
          } catch {
            // Ignore errors in server components
          }
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

  if (error) {
    console.error('OAuth initiation error:', error)
    redirect('/?error=oauth_init_failed')
  }

  if (data.url) {
    redirect(data.url)
  }
}
