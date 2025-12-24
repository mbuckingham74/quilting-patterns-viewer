'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

export default function AuthButton() {
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Get initial user and check admin status
    const initAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)

      if (user) {
        // Check if user is admin
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single()

        setIsAdmin(profile?.is_admin ?? false)
      }

      setLoading(false)
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
  }, [])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) {
    return (
      <div className="h-9 w-20 bg-stone-100 rounded-lg animate-pulse" />
    )
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
