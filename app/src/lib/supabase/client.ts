import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          // Parse cookies from document.cookie
          return document.cookie.split('; ').filter(Boolean).map(cookie => {
            const [name, ...rest] = cookie.split('=')
            return { name, value: decodeURIComponent(rest.join('=')) }
          })
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Build cookie string with options
            let cookieStr = `${name}=${encodeURIComponent(value)}`
            if (options?.path) cookieStr += `; path=${options.path}`
            if (options?.maxAge) cookieStr += `; max-age=${options.maxAge}`
            if (options?.sameSite) cookieStr += `; samesite=${options.sameSite}`
            if (options?.secure) cookieStr += '; secure'
            document.cookie = cookieStr
          })
        },
      },
    }
  )
}
