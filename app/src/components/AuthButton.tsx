'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

// Loading skeleton - shown during SSR and initial client load
function LoadingSkeleton() {
  return <div className="h-9 w-20 bg-stone-100 rounded-lg animate-pulse" />
}

export default function AuthButton() {
  const [mounted, setMounted] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const supabase = createClient()

    // Get initial user and check admin status
    const initAuth = async () => {
      console.log('AuthButton: initAuth starting')
      try {
        // First try getSession (reads from storage, fast)
        let { data: { session }, error: sessionError } = await supabase.auth.getSession()
        console.log('AuthButton: getSession result', { user: session?.user?.email, error: sessionError?.message })

        // If no session from storage, the onAuthStateChange listener will handle it
        // when it fires with the session from cookies
        const user = session?.user ?? null
        console.log('AuthButton: setting user to', user?.email ?? 'null')
        setUser(user)

        if (user) {
          // Check if user is admin
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single()

          console.log('AuthButton: profile result', { profile, error: profileError?.message })
          setIsAdmin(profile?.is_admin ?? false)
        }
      } catch (error) {
        console.error('Auth init error:', error)
      }

      console.log('AuthButton: setting loading to false')
      setLoading(false)
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('AuthButton: onAuthStateChange', { event, user: session?.user?.email })
      setUser(session?.user ?? null)
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single()
        setIsAdmin(profile?.is_admin ?? false)
      } else {
        setIsAdmin(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [mounted])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  // Always render skeleton on server and during initial client mount
  // This prevents hydration mismatch
  if (!mounted || loading) {
    return <LoadingSkeleton />
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-stone-600 hidden sm:block">
          {user.email}
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
          onClick={handleSignOut}
          className="px-3 py-1.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <Link
      href="/auth/login"
      className="px-4 py-2 text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors"
    >
      Sign in
    </Link>
  )
}
