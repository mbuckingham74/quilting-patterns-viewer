import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AuthButton from '@/components/AuthButton'
import AccountContent from '@/components/AccountContent'

interface FavoriteWithPattern {
  id: number
  pattern_id: number
  created_at: string
  patterns: {
    id: number
    file_name: string | null
    file_extension: string | null
    author: string | null
    thumbnail_url: string | null
  }
}

async function getFavorites(userId: string): Promise<FavoriteWithPattern[]> {
  const supabase = await createClient()
  const { data: favorites } = await supabase
    .from('user_favorites')
    .select(`
      id,
      pattern_id,
      created_at,
      patterns (
        id,
        file_name,
        file_extension,
        author,
        thumbnail_url
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  // Supabase returns patterns as an object for single relations
  // Type assertion needed due to Supabase type inference
  return (favorites as unknown as FavoriteWithPattern[]) || []
}

async function getSavedSearches(userId: string) {
  const supabase = await createClient()
  const { data: searches } = await supabase
    .from('saved_searches')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return searches || []
}

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const [favorites, savedSearches] = await Promise.all([
    getFavorites(user.id),
    getSavedSearches(user.id),
  ])

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="flex items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="Quilting Patterns"
                  width={120}
                  height={40}
                  className="h-10 w-auto"
                />
              </Link>
              <Link
                href="/browse"
                className="text-stone-600 hover:text-purple-700 transition-colors text-sm font-medium"
              >
                Browse Patterns
              </Link>
            </div>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-stone-800">My Account</h1>
          <p className="mt-1 text-stone-600">{user.email}</p>
        </div>

        <AccountContent
          initialFavorites={favorites}
          initialSavedSearches={savedSearches}
        />
      </div>
    </div>
  )
}
