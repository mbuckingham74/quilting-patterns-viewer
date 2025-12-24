'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Pattern, SavedSearch } from '@/lib/types'

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

interface AccountContentProps {
  initialFavorites: FavoriteWithPattern[]
  initialSavedSearches: SavedSearch[]
}

export default function AccountContent({
  initialFavorites,
  initialSavedSearches,
}: AccountContentProps) {
  const router = useRouter()
  const [favorites, setFavorites] = useState(initialFavorites)
  const [savedSearches, setSavedSearches] = useState(initialSavedSearches)
  const [deletingFavorite, setDeletingFavorite] = useState<number | null>(null)
  const [deletingSearch, setDeletingSearch] = useState<number | null>(null)

  const handleRemoveFavorite = async (patternId: number) => {
    setDeletingFavorite(patternId)

    try {
      const response = await fetch(`/api/favorites/${patternId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to remove favorite')
      }

      setFavorites((prev) => prev.filter((f) => f.pattern_id !== patternId))
    } catch (error) {
      console.error('Error removing favorite:', error)
    } finally {
      setDeletingFavorite(null)
    }
  }

  const handleDeleteSearch = async (searchId: number) => {
    setDeletingSearch(searchId)

    try {
      const response = await fetch(`/api/saved-searches/${searchId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete search')
      }

      setSavedSearches((prev) => prev.filter((s) => s.id !== searchId))
    } catch (error) {
      console.error('Error deleting search:', error)
    } finally {
      setDeletingSearch(null)
    }
  }

  const handleRunSearch = (query: string) => {
    router.push(`/browse?ai_search=${encodeURIComponent(query)}`)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-10">
      {/* Favorites Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-stone-800 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-6 h-6 text-amber-500"
            >
              <path
                fillRule="evenodd"
                d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"
                clipRule="evenodd"
              />
            </svg>
            Favorite Patterns
          </h2>
          <span className="text-sm text-stone-500">{favorites.length} patterns</span>
        </div>

        {favorites.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
            <svg
              className="mx-auto w-12 h-12 text-stone-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
              />
            </svg>
            <p className="mt-4 text-stone-500">No favorite patterns yet</p>
            <p className="mt-1 text-sm text-stone-400">
              Click the star icon on any pattern to add it to your favorites
            </p>
            <Link
              href="/browse"
              className="mt-4 inline-block text-purple-600 hover:text-purple-700 font-medium"
            >
              Browse patterns
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {favorites.map((favorite) => {
              const pattern = favorite.patterns
              const displayName = pattern.file_name || `Pattern ${pattern.id}`
              const extension = pattern.file_extension?.toUpperCase() || ''

              return (
                <div
                  key={favorite.id}
                  className="group bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden relative"
                >
                  <Link href={`/patterns/${pattern.id}`}>
                    <div className="aspect-square relative bg-white p-2">
                      {pattern.thumbnail_url ? (
                        <Image
                          src={pattern.thumbnail_url}
                          alt={displayName}
                          fill
                          className="object-contain"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400">
                          <svg
                            className="w-12 h-12"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="p-3 border-t border-stone-100">
                      <h3 className="text-sm font-medium text-stone-800 truncate group-hover:text-rose-700 transition-colors">
                        {displayName}
                      </h3>
                      <div className="mt-1 flex items-center justify-between text-xs text-stone-500">
                        {pattern.author && (
                          <span className="truncate max-w-[60%]">{pattern.author}</span>
                        )}
                        {extension && (
                          <span className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-600 uppercase">
                            {extension}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Remove button */}
                  <button
                    onClick={() => handleRemoveFavorite(pattern.id)}
                    disabled={deletingFavorite === pattern.id}
                    className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-full shadow-sm text-stone-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                    title="Remove from favorites"
                  >
                    {deletingFavorite === pattern.id ? (
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Saved Searches Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-stone-800 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6 text-purple-600"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
              />
            </svg>
            Saved Searches
          </h2>
          <span className="text-sm text-stone-500">{savedSearches.length} searches</span>
        </div>

        {savedSearches.length === 0 ? (
          <div className="bg-white rounded-xl border border-stone-200 p-8 text-center">
            <svg
              className="mx-auto w-12 h-12 text-stone-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
            <p className="mt-4 text-stone-500">No saved searches yet</p>
            <p className="mt-1 text-sm text-stone-400">
              Use the AI search and click &quot;Save&quot; to save your searches
            </p>
            <Link
              href="/browse"
              className="mt-4 inline-block text-purple-600 hover:text-purple-700 font-medium"
            >
              Try AI search
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-stone-200 divide-y divide-stone-100">
            {savedSearches.map((search) => (
              <div
                key={search.id}
                className="flex items-center justify-between p-4 hover:bg-stone-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => handleRunSearch(search.query)}
                    className="text-left w-full group"
                  >
                    <p className="font-medium text-stone-800 group-hover:text-purple-700 transition-colors truncate">
                      {search.name || search.query}
                    </p>
                    {search.name && (
                      <p className="text-sm text-stone-500 truncate">{search.query}</p>
                    )}
                    <p className="text-xs text-stone-400 mt-1">
                      Saved {formatDate(search.created_at)}
                    </p>
                  </button>
                </div>

                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleRunSearch(search.query)}
                    className="p-2 text-purple-600 hover:bg-purple-100 rounded-lg transition-colors"
                    title="Run search"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
                      />
                    </svg>
                  </button>

                  <button
                    onClick={() => handleDeleteSearch(search.id)}
                    disabled={deletingSearch === search.id}
                    className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete search"
                  >
                    {deletingSearch === search.id ? (
                      <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
