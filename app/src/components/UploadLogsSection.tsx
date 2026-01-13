'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

interface UploadedPattern {
  id: number
  name: string
  hasThumbnail: boolean
  thumbnailUrl: string | null
  fileSize: number
  author: string | null
}

interface SkippedPattern {
  name: string
  reason: string
}

interface ErrorPattern {
  name: string
  error: string
}

interface UploadLog {
  id: number
  zip_filename: string
  uploaded_by: string
  uploader_name: string
  uploaded_at: string
  total_patterns: number
  uploaded_count: number
  skipped_count: number
  error_count: number
  uploaded_patterns: UploadedPattern[]
  skipped_patterns: SkippedPattern[]
  error_patterns: ErrorPattern[]
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export default function UploadLogsSection() {
  const [logs, setLogs] = useState<UploadLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedLog, setExpandedLog] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'uploaded' | 'skipped' | 'errors'>('uploaded')

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/upload-logs?limit=10')
      if (!response.ok) {
        throw new Error('Failed to fetch upload logs')
      }
      const data = await response.json()
      setLogs(data.logs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-4">Recent Uploads</h2>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-red-100 p-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-4">Recent Uploads</h2>
        <p className="text-red-600">{error}</p>
        <button
          onClick={fetchLogs}
          className="mt-2 text-sm text-purple-600 hover:text-purple-800"
        >
          Try again
        </button>
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-6">
        <h2 className="text-lg font-semibold text-stone-800 mb-4">Recent Uploads</h2>
        <p className="text-stone-500">No upload logs yet. Upload patterns to see history here.</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-stone-800">Recent Uploads</h2>
        <button
          onClick={fetchLogs}
          className="text-sm text-purple-600 hover:text-purple-800 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      <div className="space-y-4">
        {logs.map((log) => (
          <div key={log.id} className="border border-stone-200 rounded-lg overflow-hidden">
            {/* Header - always visible */}
            <button
              onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              className="w-full p-4 text-left hover:bg-stone-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-stone-800">{log.zip_filename}</span>
                    <span className="text-xs text-stone-400">by {log.uploader_name}</span>
                  </div>
                  <p className="text-sm text-stone-500 mt-1">
                    {formatDate(log.uploaded_at)}
                  </p>
                </div>

                {/* Summary badges */}
                <div className="flex items-center gap-2 mr-4">
                  {log.uploaded_count > 0 && (
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                      {log.uploaded_count} uploaded
                    </span>
                  )}
                  {log.skipped_count > 0 && (
                    <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">
                      {log.skipped_count} skipped
                    </span>
                  )}
                  {log.error_count > 0 && (
                    <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                      {log.error_count} errors
                    </span>
                  )}
                </div>

                <svg
                  className={`w-5 h-5 text-stone-400 transform transition-transform ${expandedLog === log.id ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </button>

            {/* Expanded content */}
            {expandedLog === log.id && (
              <div className="border-t border-stone-200 p-4 bg-stone-50">
                {/* Tabs */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => setActiveTab('uploaded')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === 'uploaded'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-white text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    Uploaded ({log.uploaded_count})
                  </button>
                  <button
                    onClick={() => setActiveTab('skipped')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === 'skipped'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-white text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    Skipped ({log.skipped_count})
                  </button>
                  <button
                    onClick={() => setActiveTab('errors')}
                    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      activeTab === 'errors'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-white text-stone-600 hover:bg-stone-100'
                    }`}
                  >
                    Errors ({log.error_count})
                  </button>
                </div>

                {/* Tab content */}
                <div className="max-h-96 overflow-y-auto">
                  {activeTab === 'uploaded' && (
                    <div>
                      {log.uploaded_patterns.length === 0 ? (
                        <p className="text-stone-500 text-sm">No patterns uploaded</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {log.uploaded_patterns.map((pattern) => (
                            <a
                              key={pattern.id}
                              href={`/patterns/${pattern.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 p-3 bg-white rounded-lg border border-stone-200 hover:border-purple-300 hover:shadow-sm transition-all"
                            >
                              <div className="w-12 h-12 bg-stone-100 rounded flex-shrink-0 overflow-hidden">
                                {pattern.thumbnailUrl ? (
                                  <Image
                                    src={pattern.thumbnailUrl}
                                    alt={pattern.name}
                                    width={48}
                                    height={48}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-stone-400">
                                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-stone-800 truncate">{pattern.name}</p>
                                <div className="flex items-center gap-2 text-xs text-stone-500">
                                  <span>#{pattern.id}</span>
                                  <span>{formatFileSize(pattern.fileSize)}</span>
                                </div>
                                {pattern.author && (
                                  <p className="text-xs text-stone-400 truncate">{pattern.author}</p>
                                )}
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'skipped' && (
                    <div>
                      {log.skipped_patterns.length === 0 ? (
                        <p className="text-stone-500 text-sm">No patterns skipped</p>
                      ) : (
                        <div className="space-y-2">
                          {log.skipped_patterns.map((pattern, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200"
                            >
                              <span className="text-sm text-stone-700">{pattern.name}</span>
                              <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                                {pattern.reason}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {activeTab === 'errors' && (
                    <div>
                      {log.error_patterns.length === 0 ? (
                        <p className="text-stone-500 text-sm">No errors</p>
                      ) : (
                        <div className="space-y-2">
                          {log.error_patterns.map((pattern, idx) => (
                            <div
                              key={idx}
                              className="p-3 bg-white rounded-lg border border-red-200"
                            >
                              <p className="text-sm font-medium text-stone-700">{pattern.name}</p>
                              <p className="text-xs text-red-600 mt-1">{pattern.error}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
