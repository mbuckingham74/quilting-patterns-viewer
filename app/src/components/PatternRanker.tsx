'use client'

import { useState } from 'react'
import Image from 'next/image'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface Pattern {
  id: number
  position: number
  file_name: string
  thumbnail_url: string | null
  author: string | null
}

interface PatternRankerProps {
  patterns: Pattern[]
  token: string
  onSubmit: () => void
}

interface SortablePatternProps {
  pattern: Pattern
  rank: number
}

function SortablePattern({ pattern, rank }: SortablePatternProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: pattern.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 bg-white rounded-lg border ${
        isDragging ? 'border-purple-400 shadow-lg' : 'border-purple-100'
      } p-3 transition-shadow`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 p-2 text-stone-400 hover:text-purple-500 cursor-grab active:cursor-grabbing touch-none"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
        </svg>
      </button>

      {/* Rank number */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
        rank === 1 ? 'bg-yellow-100 text-yellow-700' :
        rank === 2 ? 'bg-stone-200 text-stone-700' :
        rank === 3 ? 'bg-amber-100 text-amber-700' :
        'bg-purple-50 text-purple-600'
      }`}>
        {rank}
      </div>

      {/* Thumbnail */}
      <div className="flex-shrink-0 w-16 h-16 relative bg-stone-100 rounded overflow-hidden">
        {pattern.thumbnail_url ? (
          <Image
            src={pattern.thumbnail_url}
            alt={pattern.file_name}
            fill
            className="object-contain p-1"
            sizes="64px"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-stone-400">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Pattern info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-stone-800 truncate">{pattern.file_name}</p>
        {pattern.author && (
          <p className="text-sm text-stone-500 truncate">by {pattern.author}</p>
        )}
      </div>
    </div>
  )
}

export default function PatternRanker({ patterns, token, onSubmit }: PatternRankerProps) {
  const [orderedPatterns, setOrderedPatterns] = useState(
    [...patterns].sort((a, b) => a.position - b.position)
  )
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setOrderedPatterns((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    const rankings = orderedPatterns.map((pattern, index) => ({
      pattern_id: pattern.id,
      rank: index + 1,
    }))

    try {
      const response = await fetch(`/api/shares/${token}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rankings,
          customerName: customerName.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit feedback')
      }

      onSubmit()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-purple-100 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-stone-800">Rank Your Favorites</h2>
        <p className="mt-1 text-stone-600">
          Drag and drop to reorder. Your #1 pick goes at the top!
        </p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={orderedPatterns.map(p => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3 mb-8">
            {orderedPatterns.map((pattern, index) => (
              <SortablePattern
                key={pattern.id}
                pattern={pattern}
                rank={index + 1}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Optional feedback fields */}
      <div className="border-t border-stone-200 pt-6 space-y-4">
        <div>
          <label htmlFor="customerName" className="block text-sm font-medium text-stone-700 mb-1">
            Your name (optional)
          </label>
          <input
            id="customerName"
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Enter your name"
            className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-stone-700 mb-1">
            Additional notes (optional)
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any comments or preferences..."
            rows={3}
            className="w-full px-4 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          />
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={submitting}
        className="mt-6 w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white font-semibold rounded-lg transition-colors"
      >
        {submitting ? 'Submitting...' : 'Submit My Rankings'}
      </button>
    </div>
  )
}
