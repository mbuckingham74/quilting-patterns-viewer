import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AuthButtonClient from './AuthButtonClient'

export default async function AuthButtonServer() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <Link
        href="/auth/login"
        className="px-4 py-2 text-sm font-medium text-white bg-rose-500 hover:bg-rose-600 rounded-lg transition-colors"
      >
        Sign in
      </Link>
    )
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.is_admin ?? false

  // Pass pre-fetched data to client component for interactivity (sign out)
  return (
    <AuthButtonClient
      email={user.email || ''}
      isAdmin={isAdmin}
    />
  )
}
