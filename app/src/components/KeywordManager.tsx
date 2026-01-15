'use client'

import { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useToast, ToastProvider } from './Toast'

interface Keyword {
  id: number
  value: string
  pattern_count: number
}

interface Pattern {
  id: number
  file_name: string | null
  notes: string | null
  thumbnail_url: string | null
}

function KeywordManagerContent() {
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [filteredKeywords, setFilteredKeywords] = useState<Keyword[]>([])
  const [patternsWithoutKeywords, setPatternsWithoutKeywords] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'value' | 'count'>('value')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Modal states
  const [editingKeyword, setEditingKeyword] = useState<Keyword | null>(null)
  const [editValue, setEditValue] = useState('')
  const [deletingKeyword, setDeletingKeyword] = useState<Keyword | null>(null)
  const [mergingKeyword, setMergingKeyword] = useState<Keyword | null>(null)
  const [mergeTargetId, setMergeTargetId] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [newKeywordValue, setNewKeywordValue] = useState('')
  const [showOrphanPatterns, setShowOrphanPatterns] = useState(false)
  const [orphanPatterns, setOrphanPatterns] = useState<Pattern[]>([])
  const [orphanPatternsLoading, setOrphanPatternsLoading] = useState(false)

  const [isSaving, setIsSaving] = useState(false)

  const { showSuccess, showError } = useToast()

  const fetchKeywords = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/keywords?sortBy=${sortBy}&sortOrder=${sortOrder}`)
      if (!response.ok) throw new Error('Failed to fetch keywords')
      const data = await response.json()
      setKeywords(data.keywords)
      setFilteredKeywords(data.keywords)
      setPatternsWithoutKeywords(data.patterns_without_keywords)
    } catch (error) {
      console.error('Error fetching keywords:', error)
      showError(error, 'Failed to load keywords')
    } finally {
      setIsLoading(false)
    }
  }, [sortBy, sortOrder, showError])

  useEffect(() => {
    fetchKeywords()
  }, [fetchKeywords])

  useEffect(() => {
    if (!search.trim()) {
      setFilteredKeywords(keywords)
    } else {
      const searchLower = search.toLowerCase()
      setFilteredKeywords(keywords.filter(k => k.value.toLowerCase().includes(searchLower)))
    }
  }, [search, keywords])

  const handleEdit = async () => {
    if (!editingKeyword || !editValue.trim()) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/keywords/${editingKeyword.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: editValue.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update keyword')
      }

      showSuccess('Keyword updated')
      setEditingKeyword(null)
      fetchKeywords()
    } catch (error) {
      showError(error, 'Failed to update keyword')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingKeyword) return

    setIsSaving(true)
    try {
      const response = await fetch(`/api/admin/keywords/${deletingKeyword.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete keyword')
      }

      const data = await response.json()
      showSuccess(`Deleted "${deletingKeyword.value}" (was on ${data.patterns_affected} patterns)`)
      setDeletingKeyword(null)
      fetchKeywords()
    } catch (error) {
      showError(error, 'Failed to delete keyword')
    } finally {
      setIsSaving(false)
    }
  }

  const handleMerge = async () => {
    if (!mergingKeyword || !mergeTargetId) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/keywords/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_id: mergingKeyword.id,
          target_id: mergeTargetId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to merge keywords')
      }

      const data = await response.json()
      const targetKeyword = keywords.find(k => k.id === mergeTargetId)
      showSuccess(`Merged "${mergingKeyword.value}" into "${targetKeyword?.value}" (${data.patterns_moved} patterns moved)`)
      setMergingKeyword(null)
      setMergeTargetId(null)
      fetchKeywords()
    } catch (error) {
      showError(error, 'Failed to merge keywords')
    } finally {
      setIsSaving(false)
    }
  }

  const handleAdd = async () => {
    if (!newKeywordValue.trim()) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/admin/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: newKeywordValue.trim() }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create keyword')
      }

      showSuccess(`Created keyword "${newKeywordValue.trim()}"`)
      setShowAddModal(false)
      setNewKeywordValue('')
      fetchKeywords()
    } catch (error) {
      showError(error, 'Failed to create keyword')
    } finally {
      setIsSaving(false)
    }
  }

  const fetchOrphanPatterns = async () => {
    setOrphanPatternsLoading(true)
    try {
      const response = await fetch('/api/admin/patterns/no-keywords?limit=50')
      if (!response.ok) throw new Error('Failed to fetch patterns')
      const data = await response.json()
      setOrphanPatterns(data.patterns)
      setShowOrphanPatterns(true)
    } catch (error) {
      showError(error, 'Failed to load patterns without keywords')
    } finally {
      setOrphanPatternsLoading(false)
    }
  }

  const toggleSort = (field: 'value' | 'count') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder(field === 'count' ? 'desc' : 'asc')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-stone-500">Total Keywords</p>
              <p className="text-2xl font-bold text-stone-800">{keywords.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-stone-500">Keywords with Patterns</p>
              <p className="text-2xl font-bold text-stone-800">{keywords.filter(k => k.pattern_count > 0).length}</p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchOrphanPatterns}
          disabled={orphanPatternsLoading}
          className="bg-white rounded-xl border border-amber-200 p-4 hover:bg-amber-50 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              {orphanPatternsLoading ? (
                <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              )}
            </div>
            <div>
              <p className="text-sm text-stone-500">Patterns Without Keywords</p>
              <p className="text-2xl font-bold text-amber-600">{patternsWithoutKeywords}</p>
            </div>
            <svg className="w-5 h-5 text-stone-400 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </button>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keywords..."
            className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
          />
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Keyword
        </button>
      </div>

      {/* Keywords Table */}
      <div className="bg-white rounded-xl border border-stone-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              <th
                onClick={() => toggleSort('value')}
                className="px-4 py-3 text-left text-sm font-medium text-stone-600 cursor-pointer hover:bg-stone-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  Keyword
                  {sortBy === 'value' && (
                    <svg className={`w-4 h-4 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  )}
                </div>
              </th>
              <th
                onClick={() => toggleSort('count')}
                className="px-4 py-3 text-left text-sm font-medium text-stone-600 cursor-pointer hover:bg-stone-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  Patterns
                  {sortBy === 'count' && (
                    <svg className={`w-4 h-4 ${sortOrder === 'desc' ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  )}
                </div>
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-stone-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {filteredKeywords.map((keyword) => (
              <tr key={keyword.id} className="hover:bg-stone-50 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-stone-800 font-medium">{keyword.value}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-sm ${
                    keyword.pattern_count > 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-stone-100 text-stone-500'
                  }`}>
                    {keyword.pattern_count}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => {
                        setEditingKeyword(keyword)
                        setEditValue(keyword.value)
                      }}
                      className="p-1.5 text-stone-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                      title="Edit keyword"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setMergingKeyword(keyword)}
                      className="p-1.5 text-stone-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Merge into another keyword"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setDeletingKeyword(keyword)}
                      className="p-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete keyword"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredKeywords.length === 0 && (
          <div className="text-center py-8 text-stone-500">
            {search ? 'No keywords match your search' : 'No keywords found'}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingKeyword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-stone-800 mb-4">Edit Keyword</h3>
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 mb-4"
              placeholder="Keyword value"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setEditingKeyword(null)}
                className="px-4 py-2 text-stone-600 hover:text-stone-800"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={isSaving || !editValue.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingKeyword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-stone-800 mb-2">Delete Keyword</h3>
            <p className="text-stone-600 mb-4">
              Are you sure you want to delete <strong>&quot;{deletingKeyword.value}&quot;</strong>?
              {deletingKeyword.pattern_count > 0 && (
                <span className="block mt-2 text-amber-600">
                  This will remove it from {deletingKeyword.pattern_count} pattern(s).
                </span>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingKeyword(null)}
                className="px-4 py-2 text-stone-600 hover:text-stone-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {isSaving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {mergingKeyword && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-stone-800 mb-2">Merge Keyword</h3>
            <p className="text-stone-600 mb-4">
              Merge <strong>&quot;{mergingKeyword.value}&quot;</strong> into another keyword.
              All patterns will be moved to the target keyword.
            </p>
            <select
              value={mergeTargetId || ''}
              onChange={(e) => setMergeTargetId(parseInt(e.target.value, 10) || null)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 mb-4"
            >
              <option value="">Select target keyword...</option>
              {keywords
                .filter(k => k.id !== mergingKeyword.id)
                .map(k => (
                  <option key={k.id} value={k.id}>
                    {k.value} ({k.pattern_count} patterns)
                  </option>
                ))}
            </select>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setMergingKeyword(null)
                  setMergeTargetId(null)
                }}
                className="px-4 py-2 text-stone-600 hover:text-stone-800"
              >
                Cancel
              </button>
              <button
                onClick={handleMerge}
                disabled={isSaving || !mergeTargetId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? 'Merging...' : 'Merge'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Keyword Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-stone-800 mb-4">Add New Keyword</h3>
            <input
              type="text"
              value={newKeywordValue}
              onChange={(e) => setNewKeywordValue(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 mb-4"
              placeholder="Enter keyword..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newKeywordValue.trim()) {
                  handleAdd()
                }
              }}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddModal(false)
                  setNewKeywordValue('')
                }}
                className="px-4 py-2 text-stone-600 hover:text-stone-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={isSaving || !newKeywordValue.trim()}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {isSaving ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Orphan Patterns Modal */}
      {showOrphanPatterns && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-stone-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-stone-800">
                  Patterns Without Keywords ({patternsWithoutKeywords})
                </h3>
                <button
                  onClick={() => setShowOrphanPatterns(false)}
                  className="p-2 text-stone-400 hover:text-stone-600"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-stone-500 mt-1">
                Click a pattern to edit and add keywords
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {orphanPatterns.length === 0 ? (
                <div className="text-center py-8 text-stone-500">
                  All patterns have keywords assigned!
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {orphanPatterns.map((pattern) => (
                    <Link
                      key={pattern.id}
                      href={`/admin/patterns/${pattern.id}/edit`}
                      className="bg-stone-50 rounded-lg border border-stone-200 overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="aspect-square bg-white relative">
                        {pattern.thumbnail_url ? (
                          <Image
                            src={pattern.thumbnail_url}
                            alt={pattern.notes || pattern.file_name || 'Pattern'}
                            fill
                            className="object-contain"
                            sizes="150px"
                            unoptimized
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-400">
                            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-xs text-stone-600 truncate">
                          {pattern.notes || pattern.file_name || `Pattern ${pattern.id}`}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function KeywordManager() {
  return (
    <ToastProvider>
      <KeywordManagerContent />
    </ToastProvider>
  )
}
