'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface UploadResult {
  success: boolean
  uploaded?: Array<{ id: number; name: string; hasThumbnail: boolean }>
  skipped?: Array<{ name: string; reason: string }>
  errors?: Array<{ name: string; error: string }>
  summary?: {
    total: number
    uploaded: number
    skipped: number
    errors: number
  }
  error?: string
  details?: string
  batch_id?: number
  is_staged?: boolean
}

export default function AdminUploadForm() {
  const router = useRouter()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [skipReview, setSkipReview] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = e.dataTransfer.files
    if (files.length > 0) {
      const file = files[0]
      if (file.name.toLowerCase().endsWith('.zip')) {
        setSelectedFile(file)
        setResult(null)
      } else {
        setResult({ success: false, error: 'Please select a ZIP file' })
      }
    }
  }, [])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.name.toLowerCase().endsWith('.zip')) {
        setSelectedFile(file)
        setResult(null)
      } else {
        setResult({ success: false, error: 'Please select a ZIP file' })
      }
    }
  }, [])

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      // If skipReview is checked, set staged=false to commit immediately
      formData.append('staged', skipReview ? 'false' : 'true')

      const response = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      })

      const data: UploadResult = await response.json()
      setResult(data)

      // If upload was successful and staged, redirect to review page
      if (data.success && data.is_staged && data.batch_id && data.summary && data.summary.uploaded > 0) {
        router.push(`/admin/batches/${data.batch_id}/review`)
        return
      }

      // For non-staged uploads or if no patterns were uploaded, just show results
      if (data.success && data.summary && data.summary.uploaded > 0) {
        setSelectedFile(null)
      }
    } catch (e) {
      setResult({
        success: false,
        error: 'Upload failed',
        details: e instanceof Error ? e.message : 'Unknown error'
      })
    } finally {
      setIsUploading(false)
    }
  }

  const clearSelection = () => {
    setSelectedFile(null)
    setResult(null)
  }

  return (
    <div className="space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-all
          ${isDragging
            ? 'border-purple-500 bg-purple-50'
            : selectedFile
              ? 'border-green-400 bg-green-50'
              : 'border-purple-200 bg-white hover:border-purple-400 hover:bg-purple-50'
          }
        `}
      >
        <input
          type="file"
          accept=".zip"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isUploading}
        />

        {selectedFile ? (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-medium text-stone-800">{selectedFile.name}</p>
              <p className="text-sm text-stone-500">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-purple-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <div>
              <p className="text-lg font-medium text-stone-800">
                Drag and drop your ZIP file here
              </p>
              <p className="text-sm text-stone-500">
                or click to browse
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Skip review option */}
      {selectedFile && (
        <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
          <input
            type="checkbox"
            checked={skipReview}
            onChange={(e) => setSkipReview(e.target.checked)}
            className="rounded border-stone-300 text-purple-600 focus:ring-purple-500"
            disabled={isUploading}
          />
          Skip review (commit patterns immediately without editing)
        </label>
      )}

      {/* Action buttons */}
      {selectedFile && (
        <div className="flex gap-4">
          <button
            onClick={handleUpload}
            disabled={isUploading}
            className={`
              flex-1 py-3 px-6 rounded-lg font-medium text-white transition-all
              ${isUploading
                ? 'bg-purple-400 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-700'
              }
            `}
          >
            {isUploading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : skipReview ? (
              'Upload & Commit'
            ) : (
              'Upload & Review'
            )}
          </button>
          <button
            onClick={clearSelection}
            disabled={isUploading}
            className="py-3 px-6 rounded-lg font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 transition-all disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      )}

      {/* Results (only shown for skip-review mode or errors) */}
      {result && (
        <div className={`rounded-xl p-6 ${result.success ? 'bg-white border border-purple-100' : 'bg-red-50 border border-red-200'}`}>
          {result.error ? (
            <div className="text-red-700">
              <p className="font-medium">{result.error}</p>
              {result.details && <p className="text-sm mt-1">{result.details}</p>}
            </div>
          ) : result.summary && !result.is_staged && (
            <div className="space-y-4">
              <h3 className="font-semibold text-stone-800">Upload Complete</h3>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-green-600">{result.summary.uploaded}</p>
                  <p className="text-sm text-green-700">Uploaded</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-amber-600">{result.summary.skipped}</p>
                  <p className="text-sm text-amber-700">Skipped</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-red-600">{result.summary.errors}</p>
                  <p className="text-sm text-red-700">Errors</p>
                </div>
              </div>

              {result.uploaded && result.uploaded.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-stone-700 mb-2">Uploaded patterns:</p>
                  <ul className="text-sm text-stone-600 max-h-40 overflow-y-auto space-y-1">
                    {result.uploaded.map(p => (
                      <li key={p.id} className="flex items-center gap-2">
                        {p.hasThumbnail ? (
                          <span className="text-green-500">✓</span>
                        ) : (
                          <span className="text-amber-500">○</span>
                        )}
                        <span>{p.name}</span>
                        <span className="text-stone-400">#{p.id}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.skipped && result.skipped.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-amber-700 mb-2">
                    Skipped {result.skipped.length} duplicate(s)
                  </p>
                </div>
              )}

              {result.errors && result.errors.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-red-700 mb-2">Errors:</p>
                  <ul className="text-sm text-red-600 space-y-1">
                    {result.errors.map((e, i) => (
                      <li key={i}>{e.name}: {e.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
