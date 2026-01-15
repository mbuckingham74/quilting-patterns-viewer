'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AdminActivityLogWithAdmin } from '@/lib/types'

interface AdminActivityLogProps {
  initialLogs?: AdminActivityLogWithAdmin[]
}

type FilterTarget = 'all' | 'user' | 'pattern' | 'keyword' | 'batch'

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
    if (action.includes('delete') || action.includes('reject'))
      return 'bg-red-100 text-red-700'
    if (
      action.includes('approve') ||
      action.includes('create') ||
      action.includes('commit')
    )
      return 'bg-green-100 text-green-700'
    if (action.includes('update') || action.includes('transform'))
      return 'bg-blue-100 text-blue-700'
    if (action.includes('merge')) return 'bg-purple-100 text-purple-700'
    if (action.includes('review')) return 'bg-amber-100 text-amber-700'
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
    // Convert 'user.approve' to 'User Approve'
    return action
      .split('.')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
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

  return (
    <div>
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
                    {log.target_id && (
                      <p className="text-xs text-stone-400 mt-1">
                        ID: {log.target_id}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-stone-400 whitespace-nowrap">
                    {formatDate(log.created_at)}
                  </span>
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
