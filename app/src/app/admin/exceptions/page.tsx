'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface PatternException {
  id: number
  file_name: string
  file_extension: string
  author: string | null
  thumbnail_url: string | null
  pattern_file_url: string | null
  has_embedding: boolean
  has_thumbnail: boolean
}

type FilterType = 'all' | 'no_thumbnail' | 'no_embedding'

export default function PatternExceptionsPage() {
  const [patterns, setPatterns] = useState<PatternException[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filter, setFilter] = useState<FilterType>('all')
  const [deleting, setDeleting] = useState<number | null>(null)

  const fetchExceptions = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/exceptions?page=${page}&limit=25&filter=${filter}`)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to fetch')
      }
      const data = await response.json()
      setPatterns(data.patterns)
      setTotalPages(data.totalPages)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch patterns')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchExceptions()
  }, [page, filter])

  const handleDelete = async (id: number, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This cannot be undone.`)) {
      return
    }

    setDeleting(id)
    try {
      const response = await fetch(`/api/admin/patterns/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete')
      }
      // Remove from list
      setPatterns(prev => prev.filter(p => p.id !== id))
      setTotal(prev => prev - 1)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete pattern')
    } finally {
      setDeleting(null)
    }
  }

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter)
    setPage(1)
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/admin"
            className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-stone-800">Pattern Exceptions</h1>
            <p className="text-stone-600">Patterns missing thumbnails or embeddings</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleFilterChange('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-purple-600 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              All Exceptions
            </button>
            <button
              onClick={() => handleFilterChange('no_thumbnail')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'no_thumbnail'
                  ? 'bg-purple-600 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              No Thumbnail
            </button>
            <button
              onClick={() => handleFilterChange('no_embedding')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'no_embedding'
                  ? 'bg-purple-600 text-white'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              No Embedding
            </button>
          </div>
          <p className="mt-3 text-sm text-stone-500">
            {total} pattern{total !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent"></div>
            <p className="mt-4 text-stone-600">Loading patterns...</p>
          </div>
        ) : error ? (
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8 text-center">
            <p className="text-red-600">{error}</p>
            <button
              onClick={fetchExceptions}
              className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
            >
              Try Again
            </button>
          </div>
        ) : patterns.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-green-200 p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-4 text-xl font-medium text-stone-800">No Exceptions Found</h3>
            <p className="mt-2 text-stone-600">All patterns have the required data.</p>
          </div>
        ) : (
          <>
            {/* Pattern List */}
            <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Pattern</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-stone-600">Status</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-stone-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {patterns.map(pattern => (
                    <tr key={pattern.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-stone-100 rounded-lg overflow-hidden flex-shrink-0">
                            {pattern.thumbnail_url ? (
                              <Image
                                src={pattern.thumbnail_url}
                                alt={pattern.file_name}
                                width={48}
                                height={48}
                                className="object-contain"
                                unoptimized
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-400">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-stone-800 truncate max-w-xs" title={pattern.file_name}>
                              {pattern.file_name}
                            </p>
                            <p className="text-sm text-stone-500">
                              ID: {pattern.id} {pattern.author && `• ${pattern.author}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-stone-100 text-stone-600 text-xs font-medium rounded uppercase">
                          {pattern.file_extension || '?'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center gap-1 text-xs ${
                            pattern.has_thumbnail ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {pattern.has_thumbnail ? (
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            )}
                            Thumbnail
                          </span>
                          <span className={`inline-flex items-center gap-1 text-xs ${
                            pattern.has_embedding ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {pattern.has_embedding ? (
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                              </svg>
                            )}
                            Embedding
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {pattern.pattern_file_url && (
                            <a
                              href={pattern.pattern_file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-stone-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Download pattern file"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                            </a>
                          )}
                          <button
                            onClick={() => handleDelete(pattern.id, pattern.file_name)}
                            disabled={deleting === pattern.id}
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete pattern"
                          >
                            {deleting === pattern.id ? (
                              <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-stone-600">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-4 py-2 bg-white border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-4 py-2 bg-white border border-stone-300 rounded-lg text-stone-700 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Info Box */}
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="font-medium text-amber-800 mb-2">About Pattern Exceptions</h3>
          <ul className="text-sm text-amber-700 space-y-1">
            <li>• <strong>No Thumbnail:</strong> Pattern file exists but no preview image was generated. These patterns won&apos;t appear in search results.</li>
            <li>• <strong>No Embedding:</strong> Pattern has no AI embedding, so it won&apos;t appear in AI-powered searches or duplicate detection.</li>
            <li>• Patterns without thumbnails cannot have embeddings generated automatically.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
