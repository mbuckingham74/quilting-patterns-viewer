import { redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AuthButton from '@/components/AuthButton'
import AccountContent from '@/components/AccountContent'
import PinnedKeywordsManager from '@/components/PinnedKeywordsManager'
import { Keyword, PinnedKeywordWithKeyword } from '@/lib/types'

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

async function getShares(userId: string) {
  const supabase = await createClient()
  const { data: shares } = await supabase
    .from('shared_collections')
    .select(`
      id,
      token,
      recipient_email,
      recipient_name,
      message,
      expires_at,
      created_at,
      shared_collection_patterns(count),
      shared_collection_feedback(id, customer_name, submitted_at)
    `)
    .eq('created_by', userId)
    .order('created_at', { ascending: false })

  // Transform the data
  return (shares || []).map(share => ({
    id: share.id,
    token: share.token,
    recipientEmail: share.recipient_email,
    recipientName: share.recipient_name,
    message: share.message,
    expiresAt: share.expires_at,
    createdAt: share.created_at,
    patternCount: (share.shared_collection_patterns as unknown as { count: number }[])?.[0]?.count || 0,
    feedback: share.shared_collection_feedback?.[0] || null,
    isExpired: new Date(share.expires_at) < new Date(),
  }))
}

async function getPinnedKeywords(userId: string): Promise<PinnedKeywordWithKeyword[]> {
  const supabase = await createClient()
  const { data: pinnedKeywords } = await supabase
    .from('pinned_keywords')
    .select(`
      id,
      user_id,
      keyword_id,
      display_order,
      created_at,
      keywords (
        id,
        value
      )
    `)
    .eq('user_id', userId)
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: true })

  return (pinnedKeywords as unknown as PinnedKeywordWithKeyword[]) || []
}

async function getAllKeywords(): Promise<Keyword[]> {
  const supabase = await createClient()
  const { data: keywords } = await supabase
    .from('keywords')
    .select('id, value')
    .order('value')

  return keywords || []
}

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  const [favorites, savedSearches, shares, pinnedKeywords, allKeywords] = await Promise.all([
    getFavorites(user.id),
    getSavedSearches(user.id),
    getShares(user.id),
    getPinnedKeywords(user.id),
    getAllKeywords(),
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

        <div className="space-y-10">
          <PinnedKeywordsManager
            initialPinnedKeywords={pinnedKeywords}
            allKeywords={allKeywords}
          />

          <AccountContent
            initialFavorites={favorites}
            initialSavedSearches={savedSearches}
            initialShares={shares}
          />
        </div>
      </div>
    </div>
  )
}
