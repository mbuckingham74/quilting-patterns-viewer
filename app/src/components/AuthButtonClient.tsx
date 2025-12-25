'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface AuthButtonClientProps {
  email: string
  isAdmin: boolean
}

export default function AuthButtonClient({ email, isAdmin }: AuthButtonClientProps) {
  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
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
        onClick={handleSignOut}
        className="px-3 py-1.5 text-sm text-stone-600 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}
