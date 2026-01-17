'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AdminActivityLogWithAdmin } from '@/lib/types'

interface AdminActivityLogProps {
  initialLogs?: AdminActivityLogWithAdmin[]
}

type FilterTarget = 'all' | 'user' | 'pattern' | 'keyword' | 'batch'

// Actions that can be undone
const REVERSIBLE_ACTIONS = ['keyword.update', 'user.approve']

function isReversible(action: string): boolean {
  return REVERSIBLE_ACTIONS.includes(action)
}

function getUndoLabel(action: string): string {
  switch (action) {
    case 'keyword.update':
      return 'Undo Rename'
    case 'user.approve':
      return 'Unapprove'
    default:
      return 'Undo'
  }
}

export default function AdminActivityLog({
  initialLogs = [],
}: AdminActivityLogProps) {
  const [logs, setLogs] = useState<AdminActivityLogWithAdmin[]>(initialLogs)
  const [loading, setLoading] = useState(!initialLogs.length)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filters
  const [targetFilter, setTargetFilter] = useState<FilterTarget>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')

  // Available filter options (fetched from API)
  const [actionTypes, setActionTypes] = useState<string[]>([])

  // Expanded details
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Undo state
  const [undoingId, setUndoingId] = useState<number | null>(null)
  const [undoError, setUndoError] = useState<string | null>(null)
  const [undoSuccess, setUndoSuccess] = useState<string | null>(null)

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' })
      if (targetFilter !== 'all') params.set('target', targetFilter)
      if (actionFilter !== 'all') params.set('action', actionFilter)
      if (dateFrom) params.set('date_from', dateFrom)
      if (dateTo) params.set('date_to', dateTo)

      const response = await fetch(`/api/admin/activity?${params}`)
      const data = await response.json()

      if (response.ok) {
        setLogs(data.logs)
        setTotalPages(data.pagination.totalPages)
        setTotal(data.pagination.total)
        setActionTypes(data.filters.actionTypes)
      }
    } catch (error) {
      console.error('Failed to fetch activity logs:', error)
    } finally {
      setLoading(false)
    }
  }, [page, targetFilter, actionFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const getActionBadgeColor = (action: string) => {
    // Destructive actions - red
    if (action.includes('delete') || action.includes('reject') || action.includes('cancel') || action.includes('revoke'))
      return 'bg-red-100 text-red-700'
    // Creative/approval actions - green
    if (action.includes('approve') || action.includes('create') || action.includes('commit'))
      return 'bg-green-100 text-green-700'
    // Upload actions - teal
    if (action.includes('upload') || action.includes('reprocess'))
      return 'bg-teal-100 text-teal-700'
    // Update/transform actions - blue
    if (action.includes('update') || action.includes('transform'))
      return 'bg-blue-100 text-blue-700'
    // Merge actions - purple
    if (action.includes('merge')) return 'bg-purple-100 text-purple-700'
    // Review actions - amber
    if (action.includes('review')) return 'bg-amber-100 text-amber-700'
    // Keyword add/remove on patterns - indigo
    if (action.includes('keyword_add') || action.includes('keyword_remove') || action === 'batch.keywords')
      return 'bg-indigo-100 text-indigo-700'
    return 'bg-stone-100 text-stone-700'
  }

  const getTargetIcon = (targetType: string) => {
    switch (targetType) {
      case 'user':
        return (
          <svg
            className="w-5 h-5 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        )
      case 'pattern':
        return (
          <svg
            className="w-5 h-5 text-purple-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        )
      case 'keyword':
        return (
          <svg
            className="w-5 h-5 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
        )
      case 'batch':
        return (
          <svg
            className="w-5 h-5 text-amber-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
            />
          </svg>
        )
      default:
        return (
          <svg
            className="w-5 h-5 text-stone-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        )
    }
  }

  const formatActionLabel = (action: string) => {
    // Human-readable labels for specific actions
    const labels: Record<string, string> = {
      'user.approve': 'User Approved',
      'user.reject': 'User Rejected',
      'user.revoke': 'User Revoked',
      'pattern.delete': 'Pattern Deleted',
      'pattern.update': 'Pattern Updated',
      'pattern.transform': 'Thumbnail Transform',
      'pattern.keyword_add': 'Keyword Added',
      'pattern.keyword_remove': 'Keyword Removed',
      'keyword.create': 'Keyword Created',
      'keyword.update': 'Keyword Renamed',
      'keyword.delete': 'Keyword Deleted',
      'keyword.merge': 'Keywords Merged',
      'orientation.review': 'Orientation Reviewed',
      'batch.upload': 'Batch Upload',
      'batch.commit': 'Batch Committed',
      'batch.cancel': 'Batch Cancelled',
      'batch.keywords': 'Batch Keywords',
      'duplicate.review': 'Duplicate Reviewed',
      'thumbnails.reprocess': 'Thumbnails Reprocessed',
    }
    if (labels[action]) return labels[action]
    // Fallback: Convert 'user.approve' to 'User Approve'
    return action
      .split('.')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).replace(/_/g, ' '))
      .join(' ')
  }

  // Check if this log has meaningful details to show
  const hasDetails = (log: AdminActivityLogWithAdmin): boolean => {
    const details = log.details as Record<string, unknown> | null
    if (!details) return false
    // Filter out empty objects and objects with only undone_activity_id
    const keys = Object.keys(details).filter(k => k !== 'undone_activity_id')
    return keys.length > 0
  }

  // Format details for display
  const formatDetails = (details: Record<string, unknown>): Array<{ label: string; value: string }> => {
    const result: Array<{ label: string; value: string }> = []
    const labelMap: Record<string, string> = {
      zip_filename: 'File',
      total: 'Total Patterns',
      uploaded: 'Uploaded',
      skipped: 'Skipped',
      errors: 'Errors',
      is_staged: 'Staged',
      patterns_count: 'Patterns',
      patterns_deleted: 'Patterns Deleted',
      patterns_affected: 'Patterns Affected',
      keyword_ids: 'Keywords',
      keyword_id: 'Keyword ID',
      keyword_value: 'Keyword',
      pattern_id_1: 'Pattern 1',
      pattern_id_2: 'Pattern 2',
      decision: 'Decision',
      deleted_pattern_id: 'Deleted Pattern',
      processed: 'Processed',
      not_found: 'Not Found',
      action: 'Action',
    }

    for (const [key, value] of Object.entries(details)) {
      if (key === 'undone_activity_id' || key === 'processed_ids') continue
      if (value === null || value === undefined) continue

      const label = labelMap[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      let displayValue: string

      if (typeof value === 'boolean') {
        displayValue = value ? 'Yes' : 'No'
      } else if (Array.isArray(value)) {
        displayValue = value.length > 5 ? `${value.slice(0, 5).join(', ')}... (${value.length} total)` : value.join(', ')
      } else {
        displayValue = String(value)
      }

      result.push({ label, value: displayValue })
    }
    return result
  }

  const clearFilters = () => {
    setTargetFilter('all')
    setActionFilter('all')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  const hasActiveFilters =
    targetFilter !== 'all' || actionFilter !== 'all' || dateFrom || dateTo

  // Check if this action was already undone (by looking for an undo entry)
  const isAlreadyUndone = (log: AdminActivityLogWithAdmin): boolean => {
    // If the description contains "Undid" it's an undo action itself, not undoable
    if (log.description.includes('Undid')) return true
    // Check if details contain undone_activity_id (this entry IS an undo)
    const details = log.details as Record<string, unknown> | null
    if (details?.undone_activity_id) return true
    return false
  }

  const handleUndo = async (activityId: number) => {
    if (!confirm('Are you sure you want to undo this action?')) return

    setUndoingId(activityId)
    setUndoError(null)
    setUndoSuccess(null)

    try {
      const response = await fetch('/api/admin/activity/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_id: activityId }),
      })

      const data = await response.json()

      if (!response.ok) {
        setUndoError(data.error || 'Failed to undo action')
        return
      }

      setUndoSuccess('Action undone successfully!')
      // Refresh the logs to show the new undo entry
      fetchLogs()
    } catch (error) {
      setUndoError('Network error - please try again')
      console.error('Undo error:', error)
    } finally {
      setUndoingId(null)
      // Clear messages after a delay
      setTimeout(() => {
        setUndoError(null)
        setUndoSuccess(null)
      }, 5000)
    }
  }

  return (
    <div>
      {/* Success/Error Messages */}
      {undoSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm">
          {undoSuccess}
        </div>
      )}
      {undoError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
          {undoError}
        </div>
      )}

      {/* Filter Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Target Type Filter */}
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">
              Target
            </label>
            <select
              value={targetFilter}
              onChange={(e) => {
                setTargetFilter(e.target.value as FilterTarget)
                setPage(1)
              }}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Targets</option>
              <option value="user">Users</option>
              <option value="pattern">Patterns</option>
              <option value="keyword">Keywords</option>
              <option value="batch">Batches</option>
            </select>
          </div>

          {/* Action Type Filter */}
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">
              Action
            </label>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value)
                setPage(1)
              }}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Actions</option>
              {actionTypes.map((action) => (
                <option key={action} value={action}>
                  {formatActionLabel(action)}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value)
                setPage(1)
              }}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value)
                setPage(1)
              }}
              className="rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-lg transition-colors"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-sm text-stone-500 mb-4">
          {total} {total === 1 ? 'activity' : 'activities'} found
        </p>
      )}

      {/* Activity List */}
      {loading ? (
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-8 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent mb-4"></div>
          <p className="text-stone-500">Loading activity...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-12 text-center">
          <svg
            className="w-16 h-16 text-stone-300 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-lg font-medium text-stone-600">No activity found</p>
          <p className="text-stone-400 mt-1">
            {hasActiveFilters
              ? 'Try adjusting your filters'
              : 'Admin actions will appear here'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-purple-100 overflow-hidden">
          <div className="divide-y divide-purple-50">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-4 hover:bg-purple-50/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getTargetIcon(log.target_type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${getActionBadgeColor(log.action_type)}`}
                      >
                        {formatActionLabel(log.action_type)}
                      </span>
                      <span className="text-sm text-stone-500">
                        by{' '}
                        {log.profiles?.display_name ||
                          log.profiles?.email ||
                          'Unknown'}
                      </span>
                    </div>
                    <p className="mt-1 text-stone-800">{log.description}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {log.target_id && (
                        <span className="text-xs text-stone-400">
                          ID: {log.target_id}
                        </span>
                      )}
                      {hasDetails(log) && (
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1"
                        >
                          <svg
                            className={`w-3 h-3 transition-transform ${expandedId === log.id ? 'rotate-90' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          {expandedId === log.id ? 'Hide details' : 'Show details'}
                        </button>
                      )}
                    </div>
                    {/* Expandable details section */}
                    {expandedId === log.id && hasDetails(log) && (
                      <div className="mt-3 p-3 bg-stone-50 rounded-lg border border-stone-200">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-xs">
                          {formatDetails(log.details as Record<string, unknown>).map(({ label, value }) => (
                            <div key={label}>
                              <span className="text-stone-500">{label}:</span>{' '}
                              <span className="text-stone-700 font-medium">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-xs text-stone-400 whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </span>
                    {isReversible(log.action_type) && !isAlreadyUndone(log) && (
                      <button
                        onClick={() => handleUndo(log.id)}
                        disabled={undoingId === log.id}
                        className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Undo this action"
                      >
                        {undoingId === log.id ? (
                          <span className="flex items-center gap-1">
                            <svg
                              className="animate-spin h-3 w-3"
                              viewBox="0 0 24 24"
                            >
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
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            Undoing...
                          </span>
                        ) : (
                          getUndoLabel(log.action_type)
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="px-4 py-2 rounded-lg bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="px-4 py-2 text-stone-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || loading}
            className="px-4 py-2 rounded-lg bg-white border border-stone-200 text-stone-700 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
