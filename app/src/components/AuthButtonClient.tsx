'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface AuthButtonClientProps {
  email: string
  isAdmin: boolean
}

export default function AuthButtonClient({ email, isAdmin }: AuthButtonClientProps) {
  const [isSigningOut, setIsSigningOut] = useState(false)
  console.log('AuthButtonClient: rendered with', { email, isAdmin, isSigningOut })

  // Clear Supabase auth cookies manually as a fallback
  const clearAuthCookies = () => {
    // Supabase stores auth in cookies with names containing 'auth-token'
    document.cookie.split(';').forEach(cookie => {
      const name = cookie.split('=')[0].trim()
      if (name.includes('auth-token') || name.includes('sb-')) {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
      }
    })
  }

  const handleSignOut = async () => {
    if (isSigningOut) {
      console.log('AuthButtonClient: already signing out, ignoring')
      return
    }
    setIsSigningOut(true)
    console.log('AuthButtonClient: handleSignOut called')
    try {
      const supabase = createClient()
      console.log('AuthButtonClient: calling signOut')

      // Add timeout to detect hanging requests
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SignOut timed out after 5s')), 5000)
      )

      // Use scope: 'global' (default) to invalidate server-side session
      // This ensures the middleware won't restore the session from stale cookies
      const signOutPromise = supabase.auth.signOut()

      const { error } = await Promise.race([signOutPromise, timeoutPromise]) as { error: Error | null }
      console.log('AuthButtonClient: signOut result', { error: error?.message })

      // Clear cookies as fallback in case signOut didn't fully clear them
      clearAuthCookies()

      window.location.href = '/'
    } catch (err) {
      console.error('AuthButtonClient: signOut exception', err)
      // Force clear cookies and redirect even on error
      clearAuthCookies()
      window.location.href = '/'
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-stone-600 hidden sm:block">
        {email}
      </span>
      {isAdmin && (
        <Link
          href="/admin"
          className="px-3 py-1.5 text-sm text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors font-medium"
        >
          Admin
        </Link>
      )}
      <Link
        href="/account"
        className="px-3 py-1.5 text-sm text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors font-medium"
      >
        Account
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        className="px-3 py-1.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
      >
        Sign out
      </button>
    </div>
  )
}
